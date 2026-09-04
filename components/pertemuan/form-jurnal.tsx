"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, History, ImagePlus, Loader2, Plus, Save } from "lucide-react";
import { cn, formatTanggal } from "@/lib/utils";
import { simpanJurnal, type DataJurnal } from "@/lib/actions/jurnal";
import { STATUS_ABSENSI_LABEL } from "@/lib/constants";
import type { ItemRiwayatJurnal, JurnalState, Rekap } from "./types";
import type { StatusAbsensi } from "@prisma/client";

const STATUSES: StatusAbsensi[] = ["HADIR", "SAKIT", "IZIN", "ALPA", "TERLAMBAT", "DISPENSASI"];

const OPSI_METODE = ["Ceramah", "Diskusi", "Praktik", "Demonstrasi", "Proyek", "Presentasi", "Tanya Jawab"];
const OPSI_MEDIA = ["Buku", "LKPD", "Laptop", "Proyektor", "Internet", "Video", "Papan Tulis"];

/** Label field yang ringkas dan konsisten dengan design system */
function Field({
  label,
  wajib = false,
  optional = false,
  children,
}: {
  label: string;
  wajib?: boolean;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="label">
        {label}
        {wajib ? (
          <span className="text-rose-500"> *</span>
        ) : optional ? (
          <span className="font-normal text-slate-400"> (opsional)</span>
        ) : null}
      </label>
      {children}
    </div>
  );
}

/** Textarea pendek yang otomatis bertambah tinggi saat mengetik — tanpa scroll internal yang mengganggu */
function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Sesuaikan tinggi saat nilai berubah (termasuk hasil isi-otomatis dari riwayat / edit jurnal lama)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => {
        onChange(e.target.value);
        const el = e.target;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }}
      className="input resize-none overflow-hidden"
    />
  );
}

/**
 * Quick-select multi-pilihan: chip preset + opsi "+ Lainnya" dengan input kecil.
 * Disimpan sebagai string dipisah koma (mis. "Diskusi, Praktik") — kompatibel dengan backend existing.
 */
function ChipSelect({
  opsi,
  nilai,
  onChange,
  placeholderLainnya,
}: {
  opsi: string[];
  nilai: string;
  onChange: (v: string) => void;
  placeholderLainnya: string;
}) {
  // Dedupe agar tidak ada token ganda (mis. kustom mengetik ulang nama preset)
  const daftar = useMemo(() => [...new Set(nilai.split(",").map((s) => s.trim()).filter(Boolean))], [nilai]);
  const preset = daftar.filter((d) => opsi.includes(d));
  const kustomGabung = daftar.filter((d) => !opsi.includes(d)).join(", ");
  const [lainnyaBuka, setLainnyaBuka] = useState(kustomGabung !== "");
  const inputRef = useRef<HTMLInputElement>(null);

  function setDaftar(p: string[], k: string) {
    const bersih = k.trim();
    onChange([...new Set([...p, ...(bersih ? [bersih] : [])])].join(", "));
  }

  function toggle(o: string) {
    const ada = preset.includes(o);
    setDaftar(ada ? preset.filter((x) => x !== o) : [...preset, o], kustomGabung);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {opsi.map((o) => {
        const aktif = preset.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            aria-pressed={aktif}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-bold transition",
              aktif
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-200/70"
            )}
          >
            {o}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => {
          setLainnyaBuka((b) => !b);
          if (!lainnyaBuka) setTimeout(() => inputRef.current?.focus(), 0);
        }}
        aria-pressed={lainnyaBuka || kustomGabung !== ""}
        className={cn(
          "flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition",
          kustomGabung !== ""
            ? "bg-emerald-600 text-white shadow-sm"
            : "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-200/70"
        )}
      >
        <Plus className="h-3 w-3" /> Lainnya
      </button>
      {(lainnyaBuka || kustomGabung !== "") && (
        <input
          ref={inputRef}
          className="input !min-h-11 w-full text-sm sm:w-44 sm:!min-h-8 sm:!py-1.5 sm:text-xs"
          placeholder={placeholderLainnya}
          value={kustomGabung}
          onChange={(e) => setDaftar(preset, e.target.value)}
        />
      )}
    </div>
  );
}

export default function FormJurnal({
  pertemuanId,
  rekap,
  absensiSudahAda,
  jurnal,
  riwayat = [],
  sumber,
  alasanManual,
}: {
  pertemuanId: string;
  rekap: Rekap;
  absensiSudahAda: boolean;
  jurnal: JurnalState | null;
  /** Riwayat pengisian jurnal akun ini (2 minggu terakhir) — klik untuk mengisi otomatis. */
  riwayat?: ItemRiwayatJurnal[];
  sumber: string;
  alasanManual: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<DataJurnal>({
    materi: jurnal?.materi ?? "",
    tujuan: jurnal?.tujuan ?? "",
    kegiatan: jurnal?.kegiatan ?? "",
    metode: jurnal?.metode ?? "",
    media: jurnal?.media ?? "",
    hasil: jurnal?.hasil ?? "",
    kendala: jurnal?.kendala ?? "",
    tindakLanjut: jurnal?.tindakLanjut ?? "",
    catatan: jurnal?.catatan ?? "",
    dokumentasiUrl: jurnal?.dokumentasiUrl ?? "",
  });
  const [loading, setLoading] = useState<"draft" | "kirim" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [infoSalin, setInfoSalin] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [detailBuka, setDetailBuka] = useState(false);
  // Saran riwayat muncul saat kolom Materi difokus/diketik.
  const [materiFokus, setMateriFokus] = useState(false);

  async function uploadFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      // pertemuanId dipakai /api/upload untuk memastikan hanya pengelola
      // pertemuan ini (atau admin) yang boleh mengunggah dokumentasi.
      fd.append("pertemuanId", pertemuanId);
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal mengunggah file.");
      set("dokumentasiUrl", data.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Gagal mengunggah file.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function set<K extends keyof DataJurnal>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** Isi formulir dari satu entri riwayat pengisian (tanpa menyimpan). */
  function pakaiRiwayat(r: ItemRiwayatJurnal) {
    setForm({
      materi: r.materi,
      tujuan: r.tujuan,
      kegiatan: r.kegiatan,
      metode: r.metode,
      media: r.media,
      hasil: r.hasil,
      kendala: r.kendala,
      tindakLanjut: r.tindakLanjut,
      catatan: r.catatan,
      dokumentasiUrl: r.dokumentasiUrl,
    });
    setInfoSalin(
      `Diisi dari riwayat: ${r.mapel} — ${r.kelas} · ${formatTanggal(r.tanggal, "EEE, d MMM yyyy")}. Sesuaikan bila perlu, lalu simpan.`
    );
    setMateriFokus(false);
  }

  // Simpan tunggal: jurnal langsung tersimpan & terkirim (lengkap). Tidak ada
  // lagi dua pilihan yang membingungkan — kalau belum mau dikirim, cukup kembali.
  async function simpan() {
    if (!form.materi.trim()) {
      setError("Materi wajib diisi minimal untuk menyimpan jurnal.");
      return;
    }
    setLoading("kirim");
    setError(null);
    try {
      const hasil = await simpanJurnal(pertemuanId, form, "TERKIRIM");
      setLoading(null);
      if (hasil.ok) {
        router.push(`/pertemuan/${pertemuanId}?sukses=${encodeURIComponent("Jurnal berhasil disimpan.")}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan jurnal.");
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Rekap absensi — satu baris ringkas, hanya muncul bila ada catatan (opsional dijelaskan di tab Absensi) */}
      {absensiSudahAda && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-500 ring-1 ring-inset ring-slate-100">
          <span className="text-slate-700">Rekap:</span>
          {STATUSES.filter((s) => rekap[s] > 0).map((s) => (
            <span key={s}>
              <b className="text-slate-800">{rekap[s]}</b> {STATUS_ABSENSI_LABEL[s].toLowerCase()}
            </span>
          ))}
        </div>
      )}

      {sumber === "MANUAL" && alasanManual && (
        <div className="card card-pad border-amber-200 bg-amber-50">
          <p className="text-sm font-semibold text-amber-800">
            📌 Jurnal manual — alasan: <span className="font-bold">{alasanManual}</span>
          </p>
        </div>
      )}

      {/* Form jurnal — jurnal harian cepat */}
      <div className="card card-pad">
        <div className="mb-4">
          <h3 className="font-extrabold text-slate-900">Isi Jurnal</h3>
        </div>
        {infoSalin && <p className="mb-3 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">{infoSalin}</p>}
        {jurnal && (
          <p className="mb-3 flex items-center gap-1.5 text-xs text-slate-400">
            <History className="h-3.5 w-3.5" /> Terakhir diubah: {jurnal.status === "TERKIRIM" ? "jurnal terkirim" : "jurnal belum dikirim"} — setiap perubahan tersimpan dicatat di riwayat.
          </p>
        )}
        {error && <p className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700">{error}</p>}

        <div className="space-y-3">
          {/* 1. Materi / Tema — wajib, satu baris; saran riwayat 14 hari saat mengetik */}
          <Field label="Materi / Tema" wajib>
            <div className="relative">
              <input
                className="input"
                placeholder="mis. Struktur Data Tree"
                value={form.materi}
                onChange={(e) => set("materi", e.target.value)}
                onFocus={() => setMateriFokus(true)}
                onBlur={() => setTimeout(() => setMateriFokus(false), 150)}
                autoComplete="off"
                aria-label="Materi atau tema pembelajaran"
              />
              {materiFokus && riwayat.length > 0 && (() => {
                const ketik = form.materi.trim().toLowerCase();
                const cocok = ketik
                  ? riwayat.filter((r) => r.materi.toLowerCase().includes(ketik))
                  : riwayat;
                const tampil = cocok.slice(0, 6);
                return tampil.length > 0 ? (
                  <div className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                    <p className="border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      {ketik ? "Pilih riwayat yang cocok" : "Riwayat pengisian 14 hari terakhir"}
                    </p>
                    <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto">
                      {tampil.map((r) => (
                        <li key={r.pertemuanId}>
                          <button
                            type="button"
                            onClick={() => pakaiRiwayat(r)}
                            className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition hover:bg-emerald-50/70"
                          >
                            <span className="text-sm font-bold text-slate-800">{r.materi || "(tanpa materi)"}</span>
                            <span className="text-[11px] text-slate-500">
                              {formatTanggal(r.tanggal, "EEE, d MMM")} · {r.mapel} — {r.kelas}
                              {r.pertemuanKe > 0 ? ` · ke-${r.pertemuanKe}` : ""}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null;
              })()}
            </div>
          </Field>

          {/* 2. Tujuan Pembelajaran — pendek */}
          <Field label="Tujuan Pembelajaran" optional>
            <AutoGrowTextarea
              rows={1}
              placeholder="mis. Siswa mampu memahami konsep tree dan penerapannya."
              value={form.tujuan}
              onChange={(v) => set("tujuan", v)}
            />
          </Field>

          {/* 3. Kegiatan Pembelajaran — utama, 2–3 baris */}
          <Field label="Kegiatan Pembelajaran" optional>
            <AutoGrowTextarea
              rows={2}
              placeholder="mis. Siswa mempelajari konsep tree kemudian membuat contoh struktur folder."
              value={form.kegiatan}
              onChange={(v) => set("kegiatan", v)}
            />
          </Field>

          {/* 4. Hasil Pembelajaran */}
          <Field label="Hasil Pembelajaran" optional>
            <AutoGrowTextarea
              rows={2}
              placeholder="mis. Sebagian besar siswa mampu membuat struktur tree dengan benar."
              value={form.hasil}
              onChange={(v) => set("hasil", v)}
            />
          </Field>

          {/* 5. Metode — quick-select */}
          <Field label="Metode" optional>
            <ChipSelect
              opsi={OPSI_METODE}
              nilai={form.metode}
              onChange={(v) => set("metode", v)}
              placeholderLainnya="Metode lain…"
            />
          </Field>

          {/* 6. Kendala / Tindak Lanjut — satu section, dua kolom di desktop */}
          <div>
            <span className="label">Kendala / Tindak Lanjut <span className="font-normal text-slate-400">(opsional)</span></span>
            <div className="grid gap-3 md:grid-cols-2">
              <AutoGrowTextarea
                rows={2}
                placeholder="Kendala — mis. Beberapa siswa masih kesulitan memahami konsep parent-child."
                value={form.kendala}
                onChange={(v) => set("kendala", v)}
              />
              <AutoGrowTextarea
                rows={2}
                placeholder="Tindak Lanjut — mis. Diberikan latihan tambahan pada pertemuan berikutnya."
                value={form.tindakLanjut}
                onChange={(v) => set("tindakLanjut", v)}
              />
            </div>
          </div>

          {/* 7. Detail Tambahan — collapsible, tertutup secara default */}
          <div className="overflow-hidden rounded-xl ring-1 ring-inset ring-slate-200">
            <button
              type="button"
              onClick={() => setDetailBuka((b) => !b)}
              aria-expanded={detailBuka}
              className="flex w-full items-center justify-between gap-2 bg-slate-50/70 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
            >
              <span className="flex items-center gap-1.5">
                <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform duration-200", detailBuka && "rotate-180")} />
                Detail Tambahan <span className="font-normal text-slate-400">(opsional)</span>
              </span>
              <span className="hidden text-[11px] font-semibold text-slate-400 sm:inline">Media · Catatan · Dokumentasi</span>
            </button>
            {detailBuka && (
              <div className="fade-up space-y-3.5 border-t border-slate-100 p-4">
                {/* Media / Sumber Belajar — quick-select */}
                <Field label="Media / Sumber Belajar" optional>
                  <ChipSelect
                    opsi={OPSI_MEDIA}
                    nilai={form.media}
                    onChange={(v) => set("media", v)}
                    placeholderLainnya="Media lain…"
                  />
                </Field>

                {/* Catatan */}
                <Field label="Catatan" optional>
                  <AutoGrowTextarea
                    rows={2}
                    placeholder="Catatan tambahan (opsional)"
                    value={form.catatan}
                    onChange={(v) => set("catatan", v)}
                  />
                </Field>

                {/* Dokumentasi Kegiatan — upload/URL/preview existing */}
                <Field label="Dokumentasi Kegiatan" optional>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center transition hover:border-emerald-400 hover:bg-emerald-50/50 sm:max-w-xs">
                      {uploading ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                          <span className="break-words text-xs font-semibold text-slate-500">Mengunggah…</span>
                        </>
                      ) : (
                        <>
                          <ImagePlus className="h-5 w-5 text-slate-400" />
                          <span className="break-words text-xs font-semibold text-slate-600">Klik untuk unggah foto (JPG/PNG/WEBP/GIF · maks 2 MB)</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        onChange={uploadFile}
                        disabled={uploading}
                      />
                    </label>
                    <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0 flex-1">
                        <input
                          className="input"
                          placeholder="atau tempel URL: https://…"
                          value={form.dokumentasiUrl}
                          onChange={(e) => set("dokumentasiUrl", e.target.value)}
                        />
                        {form.dokumentasiUrl && (
                          <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Dokumentasi terpasang ·
                            <button type="button" onClick={() => set("dokumentasiUrl", "")} className="font-bold text-rose-500 hover:underline">
                              hapus
                            </button>
                          </p>
                        )}
                      </div>
                      {form.dokumentasiUrl && (
                        <a
                          href={form.dokumentasiUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-inset ring-slate-200"
                          title="Lihat dokumentasi"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={form.dokumentasiUrl} alt="Pratinjau dokumentasi" className="h-full w-full object-cover" />
                        </a>
                      )}
                    </div>
                  </div>
                  {uploadError && <p className="mt-2 text-xs font-semibold text-rose-600">{uploadError}</p>}
                </Field>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Aksi — satu tombol simpan saja agar tidak membingungkan */}
      <div className="card card-pad">
        <button
          onClick={simpan}
          disabled={loading !== null}
          className="btn-primary btn-lg min-h-12 w-full justify-center"
        >
          {loading === "kirim" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          Simpan Jurnal
        </button>
      </div>
    </div>
  );
}
