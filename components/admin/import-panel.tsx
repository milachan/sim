"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCcw,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { JENIS_KELAMIN_LABEL } from "@/lib/constants";

type SemesterOption = {
  id: string;
  nama: string;
  aktif: boolean;
  mulai: string | null;
  selesai: string | null;
  _count: { jadwal: number };
};

type TahunAjaranOption = {
  id: string;
  nama: string;
  aktif: boolean;
  semester: SemesterOption[];
};

// Item hasil import siswa (NISN kunci sinkron)
type SiswaBaru = { nisn: string; nis: string; nama: string; jk: "L" | "P" | null; kelas: string };
type SiswaUpdate = {
  nisn: string;
  namaLama: string;
  namaBaru: string;
  nisLama: string;
  nisBaru: string;
  jkLama: string;
  jkBaru: string;
  kelasLama: string;
  kelasBaru: string;
  dipulihkan: boolean;
};
type SiswaKonflik = {
  nisnFile: string;
  nisFile: string;
  namaFile: string;
  jkFile: string;
  kelasFile: string;
  nisnLama: string;
  nisLama: string;
  namaLama: string;
  jkLama: string;
  kelasLama: string;
};

type Hasil = {
  ok: boolean;
  preview?: boolean;
  siapEksekusi?: boolean;
  semesterNama?: string;
  jadwalSebelumnya?: number;
  guruBaru?: string[];
  guruTidakDitemukan?: { barisKe: number; nama: string; kode: string | null }[];
  guruBedaNama?: { barisKe: number; nama: string; kode: string; namaDb: string }[];
  perluKonfirmasiKode?: boolean;
  guruCocokNama?: { barisKe: number; nama: string; kodeFile: string | null; namaDb: string; kodeDb: string | null }[];
  barisJadwal?: { barisKe: number; teks: string; status: "baru" | "wali" | "cocok" | "bentrok" | "dilewati" | "blokir" }[];
  guruCatatan?: string[];
  duplikatNama?: string[];
  mapelBaru?: string[];
  kelasBaru?: string[];
  waliKelas?: string[];
  jadwalBaru?: number;
  bentrok?: number;
  // siswa (NISN)
  baru?: SiswaBaru[];
  update?: SiswaUpdate[];
  konflik?: SiswaKonflik[];
  sama?: number;
  // umum
  dibuat?: number;
  diperbarui?: number;
  dilewati?: number;
  error?: string[];
  teks?: string;
};

const TIPE = {
  siswa: {
    label: "Import Siswa",
    desc: "Tambah/perbarui siswa massal — kolom NISN, NIS, NAMA, JENIS KELAMIN, KELAS. Kunci sinkron = NISN.",
    template: "/api/import/template?t=siswa",
  },
  jadwal: {
    label: "Import Jadwal",
    desc: "Upload jadwal terbaru: Guru, Kode, Hari, Jam Ke, Mapel/Kegiatan, Kelas (tanpa kolom Waktu) — patokan sinkron guru adalah Kode, hanya jadwal yang dibuat. Waktu tampil otomatis dari jam ke & hari.",
    template: "/api/import/template?t=jadwal",
  },
} as const;

type TipeKey = keyof typeof TIPE;

export function ImportPanel({ tahunAjaran }: { tahunAjaran: TahunAjaranOption[] }) {
  const [tipe, setTipe] = useState<TipeKey>("siswa");
  const [file, setFile] = useState<File | null>(null);
  const [semesterId, setSemesterId] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [bukaDetail, setBukaDetail] = useState(false);
  const [bukaBaris, setBukaBaris] = useState(false);
  const [konfirmKode, setKonfirmKode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const meta = TIPE[tipe];
  const jadwal = tipe === "jadwal";
  const totalSemester = tahunAjaran.reduce((n, t) => n + t.semester.length, 0);
  const hasilPreview = hasil?.ok && hasil.preview;

  const STATUS_BARIS_CLS: Record<string, string> = {
    baru: "bg-emerald-100 text-emerald-700",
    wali: "bg-violet-100 text-violet-700",
    cocok: "bg-amber-100 text-amber-800",
    bentrok: "bg-rose-100 text-rose-700",
    dilewati: "bg-slate-200 text-slate-600",
    blokir: "bg-rose-50 text-rose-800 ring-1 ring-inset ring-rose-300",
  };
  const labelStatusBaris = (s: string): string => {
    switch (s) {
      case "baru":
        return hasil?.preview ? "baru (akan dibuat)" : "dibuat";
      case "cocok":
        return hasil?.preview ? "dicocokkan via nama" : "dibuat — via nama";
      case "wali":
        return "wali kelas";
      case "bentrok":
        return "bentrok (dilewati)";
      case "dilewati":
        return "dilewati";
      case "blokir":
        return "diblokir";
      default:
        return s;
    }
  };

  // Warna & pesan panel hasil mengikuti KESIAPAN nyata, bukan sekadar "ok" —
  // hijau = siap, kuning = jalan dengan catatan, merah = diblokir.
  const kondisiPanel = (h: Hasil) => {
    if (!h.ok)
      return {
        cls: "border-rose-200 bg-rose-50 text-rose-900",
        ikon: "err" as const,
        judul: "Import gagal",
        sub: h.teks ?? "Periksa rincian di bawah, lalu coba lagi.",
      };
    if (tipe === "siswa") {
      if (h.preview) {
        const jml = h.konflik?.length ?? 0;
        if (jml > 0)
          return {
            cls: "border-amber-200 bg-amber-50 text-amber-900",
            ikon: "warn" as const,
            judul: `Pratinjau import siswa — ${jml} konflik nama`,
            sub: "Mengonfirmasi import akan memperbarui/replace data lama sesuai NISN di file. Baris lain tetap diproses.",
          };
        return {
          cls: "border-emerald-200 bg-emerald-50 text-emerald-900",
          ikon: "ok" as const,
          judul: "Pratinjau import siswa — siap dieksekusi",
          sub: undefined as string | undefined,
        };
      }
      return {
        cls: "border-emerald-200 bg-emerald-50 text-emerald-900",
        ikon: "ok" as const,
        judul: "Import siswa selesai",
        sub: undefined as string | undefined,
      };
    }
    if (h.preview) {
      const blokirNyata =
        (h.guruTidakDitemukan?.length ?? 0) + (h.duplikatNama?.length ?? 0) + (h.bentrok ?? 0);
      // Satu-satunya penghalang = kode-vs-nama yang butuh konfirmasi admin (bukan error).
      if (h.perluKonfirmasiKode && h.siapEksekusi !== true && blokirNyata === 0) {
        return {
          cls: "border-amber-200 bg-amber-50 text-amber-900",
          ikon: "warn" as const,
          judul: "Pratinjau import jadwal — menunggu konfirmasi kode",
          sub: `${h.guruBedaNama?.length ?? 0} baris memakai kode guru dengan nama berbeda di file. Jadwal tetap akan dibuat memakai nama dari data guru — centang konfirmasi di bawah untuk mengizinkan.`,
        };
      }
      if (h.siapEksekusi !== true) {
        return {
          cls: "border-rose-200 bg-rose-50 text-rose-900",
          ikon: "err" as const,
          judul: "Pratinjau import jadwal — tidak bisa dieksekusi",
          sub: blokirNyata > 0
            ? `${blokirNyata} baris menghalangi (guru hilang / nama ambigu / bentrok). Tombol Konfirmasi Import dinonaktifkan sampai bersih.`
            : "Ada kesalahan yang menghalangi — tombol Konfirmasi Import dinonaktifkan sampai bersih.",
        };
      }
      const catatan = (h.guruCatatan?.length ?? 0) + (h.guruCocokNama?.length ?? 0);
      if (catatan > 0)
        return {
          cls: "border-amber-200 bg-amber-50 text-amber-900",
          ikon: "warn" as const,
          judul: "Pratinjau import jadwal — siap, dengan catatan",
          sub: `${catatan} baris punya perbedaan nama/kode (mis. kode di file tidak dikenal, dicocokkan lewat nama). Jadwal tetap bisa disimpan — cek rinciannya dulu.`,
        };
      return {
        cls: "border-emerald-200 bg-emerald-50 text-emerald-900",
        ikon: "ok" as const,
        judul: "Pratinjau import jadwal — siap dieksekusi",
        sub: undefined as string | undefined,
      };
    }
    const adaError = (h.error?.length ?? 0) > 0;
    if (adaError)
      return {
        cls: "border-amber-200 bg-amber-50 text-amber-900",
        ikon: "warn" as const,
        judul: "Import jadwal selesai sebagian",
        sub: "Beberapa baris dilewati — lihat detail per baris di bawah.",
      };
    if (h.dilewati && !h.jadwalBaru)
      return {
        cls: "border-amber-200 bg-amber-50 text-amber-900",
        ikon: "warn" as const,
        judul: "Import jadwal selesai — tidak ada jadwal baru",
        sub: `${h.dilewati} baris dilewati karena sudah ada / identik dengan data yang tersimpan.`,
      };
    return {
      cls: "border-emerald-200 bg-emerald-50 text-emerald-900",
      ikon: "ok" as const,
      judul: "Import jadwal selesai",
      sub:
        h.dilewati && h.jadwalBaru
          ? `${h.dilewati} baris dilewati (sudah ada) — sisanya tersimpan.`
          : undefined,
    };
  };
  const kondisi = hasil ? kondisiPanel(hasil) : null;

  const submit = async (exec: boolean, konfirmOverride?: boolean) => {
    if (!file) return;
    if (jadwal && !semesterId) {
      setHasil({ ok: false, teks: "Pilih tahun ajaran & periode tujuan terlebih dahulu — jadwal harus masuk ke periode tertentu." });
      return;
    }
    setSibuk(true);
    setHasil(null);
    setBukaDetail(false);
    try {
      const fd = new FormData();
      fd.append("tipe", tipe);
      fd.append("file", file);
      if (jadwal) fd.append("semesterId", semesterId);
      if (jadwal && (konfirmOverride ?? konfirmKode)) fd.append("konfirmasiKodeBedaNama", "1");
      if (!exec) fd.append("preview", "1");
      const r = await fetch("/api/import", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setHasil({ ok: false, teks: d?.error ?? "Import gagal. Periksa format file.", error: d?.error ?? d?.teks ? [d.teks] : undefined, ...d });
        return;
      }
      setHasil(d);
    } catch {
      setHasil({ ok: false, teks: "Gagal terhubung ke server." });
    } finally {
      setSibuk(false);
    }
  };

  const gantiTipe = (k: TipeKey) => {
    setTipe(k);
    setFile(null);
    setHasil(null);
    setBukaDetail(false);
    setKonfirmKode(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const ringkasan = (h: Hasil) => {
    if (tipe === "siswa") {
      const b: string[] = [];
      if (h.baru?.length) b.push(`${h.baru.length} siswa baru`);
      if (h.update?.length) b.push(`${h.update.length} diperbarui`);
      if (h.konflik?.length) b.push(`${h.konflik.length} konflik nama`);
      if (h.sama) b.push(`${h.sama} sama`);
      if (h.dilewati) b.push(`${h.dilewati} dilewati`);
      return b.join(" · ") || "tidak ada perubahan";
    }
    const bagian: string[] = [];
    if (h.jadwalBaru) bagian.push(`${h.jadwalBaru} jadwal baru`);
    if (h.guruBaru?.length) bagian.push(`${h.guruBaru.length} guru baru`);
    if (h.duplikatNama?.length) bagian.push(`${h.duplikatNama.length} nama berduplikat`);
    if (h.mapelBaru?.length) bagian.push(`${h.mapelBaru.length} mapel baru`);
    if (h.kelasBaru?.length) bagian.push(`${h.kelasBaru.length} kelas baru`);
    if (h.waliKelas?.length) bagian.push(`${h.waliKelas.length} wali kelas diisi`);
    if (h.dilewati) bagian.push(`${h.dilewati} dilewati`);
    if (h.bentrok) bagian.push(`${h.bentrok} bentrok`);
    return bagian.join(" · ") || "tidak ada perubahan";
  };

  const chips = (items: string[], cap = 8) => {
    const tampil = items.slice(0, cap);
    const sisa = items.length - tampil.length;
    return (
      <div className="mt-1 flex flex-wrap gap-1">
        {tampil.map((x, i) => (
          <span key={i} className="chip bg-white text-slate-600 ring-1 ring-inset ring-slate-200">{x}</span>
        ))}
        {sisa > 0 && <span className="chip bg-slate-100 text-slate-500">+{sisa} lainnya</span>}
      </div>
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Pilih jenis */}
      <div className="space-y-4 lg:col-span-1">
        <div className="card card-pad space-y-2">
          <h3 className="font-extrabold text-slate-900">Pilih jenis data</h3>
          {(Object.keys(TIPE) as TipeKey[]).map((k) => (
            <button
              key={k}
              onClick={() => gantiTipe(k)}
              className={`w-full rounded-xl border p-4 text-left transition ${
                tipe === k
                  ? "border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20"
                  : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30"
              }`}
            >
              <p className="flex items-center gap-2 font-bold text-slate-900">
                <FileSpreadsheet className={`h-4 w-4 ${tipe === k ? "text-emerald-600" : "text-slate-400"}`} />
                {TIPE[k].label}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{TIPE[k].desc}</p>
            </button>
          ))}
        </div>

        {/* Pilih periode tujuan (khusus jadwal) */}
        {jadwal && (
          <div className="card card-pad">
            <label className="label flex items-center gap-1.5">
              <CalendarRange className="h-4 w-4 text-emerald-600" /> Tahun ajaran & periode tujuan *
            </label>
            {totalSemester === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">
                Belum ada periode. Buat tahun ajaran & periode dulu di{" "}
                <a href="/admin/tahun-ajaran" className="font-bold underline">Tahun Ajaran</a> — jadwal yang diupload
                harus masuk ke periode tertentu.
              </div>
            ) : (
              <select
                className="input"
                value={semesterId}
                onChange={(e) => {
                  setSemesterId(e.target.value);
                  setHasil(null);
                }}
              >
                <option value="">— Pilih periode —</option>
                {tahunAjaran.map((ta) => (
                  <optgroup key={ta.id} label={`${ta.nama}${ta.aktif ? " (tahun berjalan)" : ""}`}>
                    {ta.semester.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nama}
                        {s.aktif ? " • Aktif" : ""}
                        {s._count.jadwal > 0 ? ` • ${s._count.jadwal} jadwal` : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
            <p className="mt-1.5 text-xs leading-5 text-slate-500">
              Periode yang dipilih adalah tujuan jadwal terbaru. Bila sudah punya jadwal akan muncul peringatan saat
              diperiksa.
            </p>
          </div>
        )}

        <a href={meta.template} className="btn-secondary w-full">
          <Download className="h-4 w-4" /> Unduh Template {tipe === "siswa" ? "Siswa" : "Jadwal"}
        </a>
      </div>

      {/* Upload */}
      <div className="lg:col-span-2">
        <div
          className="card card-pad flex flex-col items-center justify-center border-2 border-dashed !border-slate-300 bg-slate-50/50 py-12 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) {
              setFile(f);
              setHasil(null);
              setBukaDetail(false);
            }
          }}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
            <UploadCloud className="h-8 w-8" />
          </div>
          <h3 className="mt-4 font-extrabold text-slate-900">{file ? file.name : "Tarik file ke sini"}</h3>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            {file
              ? `${(file.size / 1024).toFixed(0)} KB · siap diimport`
              : `Pilih file Excel (.xlsx) sesuai template ${meta.label}, atau tarik & lepas di area ini.`}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFile(f);
                setHasil(null);
                setBukaDetail(false);
                setKonfirmKode(false);
              }
            }}
          />
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button onClick={() => inputRef.current?.click()} className="btn-secondary">
              <FileSpreadsheet className="h-4 w-4" /> Pilih File
            </button>
            <button onClick={() => submit(false)} disabled={!file || sibuk} className="btn-primary">
              {sibuk ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              {sibuk ? "Memeriksa…" : hasilPreview ? "Periksa Ulang" : "Periksa & Pratinjau"}
            </button>
            {hasilPreview && (
              <button
                onClick={() => submit(true)}
                disabled={sibuk || hasil?.siapEksekusi !== true}
                title={
                  hasil?.siapEksekusi !== true
                    ? "Periksa kembali — masih ada yang menghalangi import (error, atau centang konfirmasi kode terlebih dahulu)"
                    : undefined
                }
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sibuk ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                {sibuk ? "Menyimpan…" : "Konfirmasi Import"}
              </button>
            )}
          </div>
        </div>

        {/* Hasil */}
        {hasil && kondisi && (
          <div className={`fade-up mt-4 rounded-xl border px-4 py-3 text-sm ${kondisi.cls}`}>
            {hasil.ok ? (
              <>
                <p className="flex items-center gap-2 font-extrabold">
                  {kondisi.ikon === "err" ? (
                    <XCircle className="h-5 w-5 shrink-0" />
                  ) : kondisi.ikon === "warn" ? (
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                  )}
                  {kondisi.judul}
                  {hasil.semesterNama && (
                    <span className="chip bg-white/70 text-emerald-700 ring-1 ring-inset ring-emerald-200">{hasil.semesterNama}</span>
                  )}
                </p>
                {kondisi.sub && <p className="mt-1.5 text-xs font-semibold opacity-90">{kondisi.sub}</p>}

                {hasil.preview && hasil.jadwalSebelumnya != null && hasil.jadwalSebelumnya > 0 && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      <b>Periode ini sudah punya {hasil.jadwalSebelumnya} jadwal.</b> File akan digabung — jadwal yang
                      sudah ada dilewati, sisanya ditambah. Tidak ada data lama yang dihapus.
                    </p>
                  </div>
                )}

                {!!hasil.guruTidakDitemukan?.length && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2.5 text-rose-900">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="text-xs leading-5">
                      <p>
                        <b>{hasil.guruTidakDitemukan.length} guru tidak ditemukan.</b> Jalankan Import Guru terlebih dahulu
                        — Import Jadwal hanya menghubungkan ke Guru yang sudah ada.
                      </p>
                      <ul className="mt-1.5 max-h-40 space-y-0.5 overflow-y-auto">
                        {hasil.guruTidakDitemukan.slice(0, 8).map((g, i) => (
                          <li key={i} className="font-semibold">
                            Baris {g.barisKe}: {g.nama} {g.kode ? `(${g.kode})` : ""}
                          </li>
                        ))}
                        {hasil.guruTidakDitemukan.length > 8 && <li>… dan {hasil.guruTidakDitemukan.length - 8} lainnya.</li>}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Konflik nama — NISN beda tapi nama sama (khusus siswa) */}
                {!!hasil.konflik?.length && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2.5 text-orange-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="text-xs leading-5">
                      <p>
                        <b>{hasil.konflik.length} siswa punya NISN berbeda tapi nama sama dengan data yang ada.</b>{" "}
                        Mengonfirmasi import akan <b>memperbarui/replace data lama</b> dengan NISN dari file (dianggap
                        yang benar).
                      </p>
                      <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto">
                        {hasil.konflik.slice(0, 6).map((k, i) => (
                          <p key={i} className="rounded-md bg-white/70 px-2 py-1 font-semibold">
                            {k.namaFile} <span className="text-slate-500">(NISN {k.nisnFile || "-"})</span> → menggantikan{" "}
                            {k.namaLama} <span className="text-slate-500">(NISN {k.nisnLama})</span>
                          </p>
                        ))}
                        {hasil.konflik.length > 6 && <p>… dan {hasil.konflik.length - 6} lainnya.</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* Kode cocok tapi nama di file beda total dari pemilik kode di database —
                    jadwal tetap dibuat memakai guru dari kode, butuh konfirmasi admin. */}
                {!!hasil.guruBedaNama?.length && (
                  <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-amber-900">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="text-xs leading-5">
                        <p>
                          <b>{hasil.guruBedaNama.length} baris memakai kode guru yang nama di file-nya beda dari database.</b>{" "}
                          Jadwal tetap akan dibuat memakai guru sesuai <b>Kode</b> (nama diambil dari data guru) — nama di
                          file diabaikan. Pastikan Kode di file <b>bukan typo</b>, karena jadwal akan menempel ke pemilik
                          kode berikut:
                        </p>
                        <ul className="mt-1.5 max-h-40 space-y-0.5 overflow-y-auto">
                          {hasil.guruBedaNama.slice(0, 8).map((g, i) => (
                            <li key={i} className="font-semibold">
                              Baris {g.barisKe}: "{g.nama}" ({g.kode}) → dipakai: {g.namaDb}
                            </li>
                          ))}
                          {hasil.guruBedaNama.length > 8 && <li>… dan {hasil.guruBedaNama.length - 8} lainnya.</li>}
                        </ul>
                      </div>
                    </div>
                    {hasil.preview && (
                      <label className="mt-2.5 flex cursor-pointer items-start gap-2 rounded-lg border border-amber-300 bg-white/70 px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={konfirmKode}
                          onChange={(e) => {
                            setKonfirmKode(e.target.checked);
                            if (jadwal && hasilPreview) void submit(false, e.target.checked);
                          }}
                          className="mt-0.5 h-4 w-4 accent-amber-600"
                        />
                        <span className="text-xs font-semibold leading-5 text-amber-900">
                          Saya yakin KODE di file sudah benar — buat jadwal memakai nama guru dari data guru sesuai kode.
                        </span>
                      </label>
                    )}
                  </div>
                )}

                {/* Kode di file tidak dikenal tapi nama cocok ke satu guru — jadwal menempel lewat nama */}
                {!!hasil.guruCocokNama?.length && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="text-xs leading-5">
                      <p>
                        <b>{hasil.guruCocokNama.length} baris memakai Kode yang tidak dikenal di database</b> — jadwalnya
                        dicocokkan lewat nama ke guru berikut. Bila kodenya typo, perbaiki di file:
                      </p>
                      <ul className="mt-1.5 max-h-40 space-y-0.5 overflow-y-auto">
                        {hasil.guruCocokNama.slice(0, 8).map((g, i) => (
                          <li key={i} className="font-semibold">
                            Baris {g.barisKe}: {g.nama} ({g.kodeFile}) → DB: {g.namaDb}
                            {g.kodeDb ? ` (kode ${g.kodeDb})` : " (tanpa kode)"}
                          </li>
                        ))}
                        {hasil.guruCocokNama.length > 8 && (
                          <li>… dan {hasil.guruCocokNama.length - 8} lainnya.</li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}

                {!!hasil.duplikatNama?.length && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2.5 text-orange-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p className="text-xs leading-5">
                      <b>Nama yang sama muncul dengan kode berbeda di file ini</b> — bisa jadi guru yang sama tapi
                      kodenya typo, sehingga akan dibuat dua guru terpisah. Periksa sebelum mengonfirmasi:
                    </p>
                    <ul className="mt-1 list-inside list-disc space-y-0.5">
                      {hasil.duplikatNama.slice(0, 6).map((x, i) => (
                        <li key={i} className="font-semibold">{x}</li>
                      ))}
                      {hasil.duplikatNama.length > 6 && (
                        <li>… dan {hasil.duplikatNama.length - 6} lainnya.</li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="mt-3 space-y-2.5">
                  <p className="font-bold text-slate-800">
                    {hasil.preview ? "Rencana perubahan:" : `Ringkasan: ${ringkasan(hasil)}`}
                  </p>
                  {hasil.preview && (
                    <p className="rounded-lg bg-white/60 px-3 py-2 font-semibold text-slate-700">
                      {ringkasan(hasil)}
                    </p>
                  )}

                  {/* Detail siswa baru / update / konflik */}
                  {tipe === "siswa" && (hasil.baru?.length || hasil.update?.length || hasil.konflik?.length) ? (
                    <button
                      onClick={() => setBukaDetail(!bukaDetail)}
                      className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
                    >
                      {bukaDetail ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      {bukaDetail ? "Sembunyikan detail" : "Lihat detail perubahan"}
                    </button>
                  ) : null}
                  {bukaDetail && tipe === "siswa" && (
                    <div className="space-y-3">
                      {!!hasil.baru?.length && (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Siswa baru (akan dibuat)</p>
                          {chips(
                            hasil.baru.map((b) => `${b.nama}${b.nisn ? ` (${b.nisn})` : ""}${b.jk ? ` · ${JENIS_KELAMIN_LABEL[b.jk]}` : ""}${b.kelas ? ` · ${b.kelas}` : ""}`)
                          )}
                        </div>
                      )}
                      {!!hasil.update?.length && (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-sky-700">Siswa diperbarui</p>
                          <div className="mt-1 max-h-56 space-y-1.5 overflow-y-auto">
                            {hasil.update.map((u, i) => (
                              <div key={i} className="rounded-lg bg-white/70 px-3 py-2 text-xs leading-5">
                                <p className="font-bold text-slate-800">
                                  {u.nisn !== "-" ? `${u.nisn} — ` : ""}{u.namaLama} → <span className="text-emerald-700">{u.namaBaru}</span>
                                  {u.dipulihkan && <span className="chip ml-1.5 bg-amber-100 text-amber-700">dipulihkan</span>}
                                </p>
                                <p className="text-slate-500">
                                  NIS: {u.nisLama} → {u.nisBaru}
                                  {u.jkLama !== "-" || u.jkBaru !== "(tetap)" ? ` · JK: ${u.jkLama} → ${u.jkBaru}` : ""} · Kelas: {u.kelasLama} → {u.kelasBaru}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {!!hasil.konflik?.length && (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wide text-orange-700">Konflik nama — akan di-replace</p>
                          <div className="mt-1 max-h-56 space-y-1.5 overflow-y-auto">
                            {hasil.konflik.map((k, i) => (
                              <div key={i} className="rounded-lg bg-white/70 px-3 py-2 text-xs leading-5">
                                <p className="font-bold text-slate-800">
                                  {k.namaFile} <span className="text-slate-500">(NISN {k.nisnFile || "-"})</span>
                                </p>
                                <p className="text-slate-500">
                                  Menggantikan {k.namaLama} — NISN lama {k.nisnLama} · NIS {k.nisLama}
                                  {k.jkFile || k.jkLama ? ` · JK: ${k.jkLama || "-"} → ${k.jkFile || "(tetap)"}` : ""} · Kelas {k.kelasLama} → {k.kelasFile || "(tetap)"}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}


                  {!!hasil.guruCatatan?.length && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-sky-700">
                        Nama di file berbeda dengan database (info saja — tidak diubah)
                      </p>
                      {chips(hasil.guruCatatan)}
                    </div>
                  )}
                  {!!hasil.mapelBaru?.length && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-violet-700">Mapel baru</p>
                      {chips(hasil.mapelBaru)}
                    </div>
                  )}
                  {!!hasil.kelasBaru?.length && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Kelas baru</p>
                      {chips(hasil.kelasBaru)}
                    </div>
                  )}
                  {!!hasil.waliKelas?.length && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Wali kelas rombel diisi</p>
                      {chips(hasil.waliKelas)}
                    </div>
                  )}
                  {hasil.preview && (
                    <p className="text-xs text-slate-500">
                      {jadwal
                        ? `${hasil.jadwalBaru} jadwal akan ditambah · ${hasil.dilewati} dilewati${hasil.bentrok ? ` · ${hasil.bentrok} bentrok` : ""} · data master guru yang sudah ada tidak diubah`
                        : `Data lama hanya berubah bila dikonfirmasi — baris tidak valid dilewati dan dicatat.`}
                    </p>
                  )}

                  {tipe === "jadwal" && !!hasil.barisJadwal?.length && (
                    <div className="pt-1">
                      <button
                        onClick={() => setBukaBaris(!bukaBaris)}
                        className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
                      >
                        {bukaBaris ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {bukaBaris ? "Sembunyikan detail per baris" : `Lihat detail per baris (${hasil.barisJadwal.length} baris)`}
                      </button>
                      {bukaBaris && (
                        <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white/70">
                          <table className="w-full min-w-[420px] text-left text-xs">
                            <thead className="sticky top-0 bg-slate-100 text-slate-500">
                              <tr>
                                <th className="px-2.5 py-1.5 font-bold">Baris</th>
                                <th className="px-2.5 py-1.5 font-bold">Isi file</th>
                                <th className="px-2.5 py-1.5 font-bold">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[...hasil.barisJadwal]
                                .sort((a, b) => a.barisKe - b.barisKe)
                                .map((r, i) => (
                                  <tr key={i} className="border-t border-slate-100">
                                    <td className="px-2.5 py-1 font-mono text-slate-400">#{r.barisKe}</td>
                                    <td className="px-2.5 py-1 font-semibold text-slate-700">{r.teks}</td>
                                    <td className="px-2.5 py-1">
                                      <span className={`chip ${STATUS_BARIS_CLS[r.status] ?? "bg-slate-100 text-slate-500"}`}>
                                        {labelStatusBaris(r.status)}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="flex items-center gap-2 font-extrabold">
                <XCircle className="h-5 w-5 shrink-0" /> Gagal
              </p>
            )}

            {hasil.error && hasil.error.length > 0 && (
              <div className="mt-3 max-h-40 overflow-y-auto rounded-lg bg-white/60 px-3 py-2 text-xs leading-5 text-rose-800">
                {hasil.error.slice(0, 10).map((e, i) => (
                  <p key={i}>• {e}</p>
                ))}
                {hasil.error.length > 10 && <p>… dan {hasil.error.length - 10} pesan lainnya.</p>}
              </div>
            )}
            {hasil.teks && <p className="mt-2 font-semibold">{hasil.teks}</p>}
          </div>
        )}

        <div className="card card-pad mt-4">
          <h4 className="font-extrabold text-slate-900">Petunjuk cepat</h4>
          <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm text-slate-600">
            <li>Unduh template, isi sesuai contoh, lalu upload kembali — nama kolom harus sama.</li>
            {jadwal ? (
              <>
                <li>
                  Kolom <b>Kode</b> adalah kunci sinkron guru (mis. <i>K5</i>); nama hanya untuk pengecekan. Format lama
                  <i> Akhmadi, S.Pd. (K5)</i> dalam satu kolom tetap didukung.
                </li>
                <li>Guru tidak dibuat dari Import Jadwal — guru harus sudah ada via Import Guru/Hak Akses; yang dibuat hanya jadwal, mapel, kelas, dan wali kelas.</li>
                <li>Mapel & kelas yang belum ada dibuat otomatis; baris <i>Wali Kelas</i> mengisi wali kelas rombel.</li>
                <li>Wajib pilih tahun ajaran & periode tujuan — hasilnya diperiksa dulu (pratinjau) sebelum disimpan.</li>
                <li>Baris dengan data tidak valid akan dilewati dan dicatat; bentrok jam pada kelas yang sama dicegah.</li>
              </>
            ) : (
              <>
                <li>
                  Kolom <b>NISN</b> (10 digit) adalah <b>kunci sinkron</b> — siswa dengan NISN sama diperbarui, yang belum
                  ada dibuat. NIS & KELAS opsional.
                </li>
                <li>Kelas harus sudah dibuat di menu Kelas & Rombel (nama harus persis, mis. 7A).</li>
                <li>
                  NISN berbeda tapi <b>nama sama</b> dengan data yang ada = <b>konflik</b> — perlu konfirmasi untuk
                  memperbarui/replace data lama. Hasil selalu diperiksa dulu (pratinjau) sebelum disimpan.
                </li>
                <li>Baris dengan data tidak valid akan dilewati dan dicatat di laporan hasil import.</li>
              </>
            )}
          </ul>
          <div className="mt-4 border-t border-slate-200 pt-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Baca warna hasil</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
              <span className="chip bg-emerald-100 text-emerald-700">hijau</span> siap dieksekusi ·
              <span className="chip bg-amber-100 text-amber-800">kuning</span> jalan, tapi perlu diperhatikan ·
              <span className="chip bg-rose-100 text-rose-700">merah</span> diblokir — perbaiki dulu
            </div>
            {jadwal && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                Status baris:{" "}
                <span className="chip bg-emerald-100 text-emerald-700">baru</span>
                <span className="chip bg-violet-100 text-violet-700">wali kelas</span>
                <span className="chip bg-amber-100 text-amber-800">dicocokkan via nama</span>
                <span className="chip bg-rose-100 text-rose-700">bentrok/diblokir</span>
                <span className="chip bg-slate-200 text-slate-600">dilewati</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
