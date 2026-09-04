"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, CheckCheck, Loader2, Save, Search, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { simpanAbsensiHarian, type EntryAbsensiHarian } from "@/lib/actions/absensi-harian";
import { STATUS_ABSENSI_BADGE, STATUS_ABSENSI_LABEL } from "@/lib/constants";
import type { StatusAbsensi } from "@prisma/client";

const STATUSES: StatusAbsensi[] = ["HADIR", "SAKIT", "IZIN", "ALPA", "TERLAMBAT", "DISPENSASI"];

type SiswaAbsensiHarian = { id: string; nama: string; nis: string | null; status: StatusAbsensi | null; catatan: string };

export default function FormAbsensiHarian({
  kelasId,
  tanggal,
  namaKelas,
  statusText,
  statusChipClass,
  pengisiInfo,
  instruksi,
  siswa,
  sudahAda,
  backUrl,
  lanjutUrl = null,
}: {
  kelasId: string;
  tanggal: string;
  namaKelas: string;
  /** Status awal dari server (mis. "Belum Diisi" / "Sudah Diisi Guru Jam 1"). */
  statusText: string;
  statusChipClass: string;
  /** Nama pengisi terakhir / calon pengisi utama. */
  pengisiInfo: string | null;
  /** Satu kalimat panduan singkat sesuai peran. */
  instruksi: string;
  siswa: SiswaAbsensiHarian[];
  sudahAda: boolean;
  backUrl: string;
  /** Bila dibuka dari gerbang jurnal beranda: tujuan setelah simpan = pengisian jurnal pertemuan ini. */
  lanjutUrl?: string | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<SiswaAbsensiHarian[]>(siswa);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const terfilter = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => r.nama.toLowerCase().includes(t) || (r.nis ?? "").includes(t));
  }, [rows, q]);

  const total = rows.length;
  const ditandai = rows.filter((r) => r.status !== null).length;
  const belum = total - ditandai;

  const hitung = (s: StatusAbsensi) => rows.filter((r) => r.status === s).length;

  // Chip status utama — mengikuti kondisi terkini di formulir.
  const chipStatus = belum > 0
    ? { teks: "Belum Lengkap", cls: "bg-amber-100 text-amber-700" }
    : statusText === "Belum Diisi"
      ? { teks: "Semua Ditandai", cls: "bg-emerald-100 text-emerald-700" }
      : { teks: statusText, cls: statusChipClass };

  function tandaiSemuaHadir() {
    setRows((prev) => prev.map((r) => ({ ...r, status: "HADIR" as const, catatan: "" })));
  }

  function ubahStatus(id: string, status: StatusAbsensi) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status, catatan: status === "HADIR" ? "" : r.catatan } : r)));
  }

  async function simpan() {
    const entries: EntryAbsensiHarian[] = rows
      .filter((r) => r.status !== null)
      .map((r) => ({ siswaId: r.id, status: r.status!, catatan: r.catatan || null }));
    if (entries.length === 0) {
      if (!sudahAda) {
        setError('Belum ada siswa yang ditandai — gunakan "Tandai Semua Hadir" atau pilih status per siswa.');
        return;
      }
      const yakin = window.confirm("Tidak ada siswa yang ditandai.\n\nHapus seluruh catatan absensi harian kelas ini?");
      if (!yakin) return;
    } else if (entries.length !== total) {
      const yakin = window.confirm(`Absensi Harian belum lengkap. Masih ada ${total - entries.length} siswa yang belum diberi status. Simpan tetap akan ditolak server. Lanjutkan?`);
      if (!yakin) return;
    }
    setLoading(true);
    setError(null);
    try {
      const hasil = await simpanAbsensiHarian(kelasId, tanggal, entries);
      setLoading(false);
      if (hasil.ok) {
        const pesan = entries.length === 0 ? "Catatan absensi harian dikosongkan." : `Absensi harian ${namaKelas} berhasil disimpan.`;
        // Tujuan mengikuti asal halaman:
        // - gerbang jurnal beranda (?pertemuan=... + lanjutUrl) → langsung ke pengisian
        //   jurnal pertemuan itu (absensi selesai = gerbang terbuka);
        // - daftar absensi (?tanggal=...) → pulang ke daftar tanggal itu;
        // - kartu beranda (tanpa param) → kembali ke beranda.
        const dariGerbangJurnal = !!lanjutUrl && window.location.search.includes("pertemuan=");
        const dariDaftarAbsensi = window.location.search.includes("tanggal=");
        const tujuan = dariGerbangJurnal ? lanjutUrl! : dariDaftarAbsensi ? backUrl : "/";
        router.push(`${tujuan}${tujuan.includes("?") ? "&" : "?"}sukses=${encodeURIComponent(pesan)}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan absensi harian.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Satu kartu utama: status + pengisi + rekap + aksi */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3.5 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={cn("chip", chipStatus.cls)}>{chipStatus.teks}</span>
            <span className="text-xs font-bold text-slate-400">{total} siswa</span>
          </div>

          {pengisiInfo && (
            <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-slate-600">
              <UserRound className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="min-w-0 break-words">{pengisiInfo}</span>
            </p>
          )}

          <p className="mt-1.5 text-xs leading-5 text-slate-500">{instruksi}</p>
        </div>

        <div className="px-4 py-4 sm:px-5">
          {belum > 0 ? (
            <button
              type="button"
              onClick={tandaiSemuaHadir}
              title="Tandai seluruh siswa hadir"
              className="btn min-h-11 w-full !bg-emerald-600 text-white shadow-sm shadow-emerald-900/20 hover:!bg-emerald-700 active:!bg-emerald-800"
            >
              <CheckCheck className="h-5 w-5" /> Tandai Semua Hadir
              <span className="ml-auto rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-extrabold">sisa {belum}</span>
            </button>
          ) : (
            <p className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-bold text-emerald-700">
              <CheckCheck className="h-5 w-5 shrink-0" /> Semua siswa sudah ditandai
            </p>
          )}

          {error && (
            <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">{error}</p>
          )}

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input !pl-9" placeholder="Cari nama atau NIS siswa…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          {/* Rekap kehadiran — di bawah kolom pencarian */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {STATUSES.filter((s) => hitung(s) > 0).map((s) => (
              <span key={s} className={cn("chip", STATUS_ABSENSI_BADGE[s])}>
                {STATUS_ABSENSI_LABEL[s]} {hitung(s)}
              </span>
            ))}
            {belum > 0 && <span className="chip bg-slate-200 text-slate-600">Belum {belum}</span>}
          </div>
        </div>
      </div>

      {/* Daftar siswa */}
      <div className="card overflow-hidden">
        <div className="divide-y divide-slate-100">
          {terfilter.length === 0 && <p className="p-8 text-center text-sm text-slate-400">Tidak ada siswa ditemukan.</p>}
          {terfilter.map((r) => {
            const nomor = rows.indexOf(r) + 1;
            return (
              <div key={r.id} className="px-4 py-3 sm:px-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-extrabold text-slate-500">{nomor}</div>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-bold text-slate-800">{r.nama}</p>
                      <p className="text-xs text-slate-400">{r.nis ?? "—"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:justify-end">
                    {STATUSES.map((s) => (
                      <button key={s} type="button" onClick={() => ubahStatus(r.id, s)} className={cn("flex min-h-11 items-center justify-center rounded-lg px-2 py-2 text-[11px] font-bold transition-all", r.status === s ? STATUS_ABSENSI_BADGE[s] + " ring-1 ring-inset ring-current" : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700")}>
                        {STATUS_ABSENSI_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </div>
                {r.status !== null && r.status !== "HADIR" && (
                  <input className="input mt-2 !py-1.5 text-xs" placeholder={`Catatan untuk ${r.nama} (opsional)`} value={r.catatan} onChange={(e) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, catatan: e.target.value } : x)))} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Aksi bawah: kembali • simpan (utama setelah data lengkap) */}
      <div className="card card-pad safe-bottom sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 flex flex-col gap-2 sm:static sm:flex-row sm:items-center lg:bottom-0">
        <TombolKembali backUrl={backUrl} />
        <button
          onClick={simpan}
          disabled={loading}
          className={cn(
            "btn btn-lg min-h-11 w-full sm:w-auto",
            belum > 0 ? "btn-secondary" : "btn-primary"
          )}
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />} Simpan Absensi Harian
        </button>
      </div>
    </div>
  );
}

function TombolKembali({ backUrl }: { backUrl: string }) {
  const router = useRouter();
  const pathname = usePathname();
  // Kembali ke halaman asal HANYA bila riwayat aman (referrer same-origin, path
  // berbeda, dan ada riwayat) — mencegah nyasar ke /login atau halaman luar.
  // Selain itu fallback ke backUrl yang sudah disesuaikan server dengan asal
  // halaman (beranda "/" bila dibuka dari beranda/gerbang, daftar absensi bila
  // dibuka dari daftar) — tidak lagi selalu nyasar ke daftar absensi.
  const [punyaRiwayat, setPunyaRiwayat] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let refPath: string | null = null;
    try {
      refPath = new URL(document.referrer).pathname + new URL(document.referrer).search;
    } catch {
      refPath = null;
    }
    const sameOrigin = document.referrer.startsWith(window.location.origin);
    setPunyaRiwayat(sameOrigin && window.history.length > 1 && refPath !== null && refPath !== pathname);
  }, [pathname]);

  function kembali() {
    if (punyaRiwayat) router.back();
    else router.push(backUrl);
  }

  return (
    <button type="button" onClick={kembali} className="btn-secondary btn-lg w-full sm:w-auto">
      <ArrowLeft className="h-5 w-5" /> Kembali
    </button>
  );
}
