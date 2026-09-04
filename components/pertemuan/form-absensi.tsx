"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, ChevronDown, Loader2, Save, Search, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { simpanAbsensi, type EntryAbsensi } from "@/lib/actions/absensi";
import { STATUS_ABSENSI_BADGE, STATUS_ABSENSI_LABEL } from "@/lib/constants";
import type { DataSiswa } from "./types";
import type { StatusAbsensi } from "@prisma/client";

const STATUSES: StatusAbsensi[] = ["HADIR", "SAKIT", "IZIN", "ALPA", "TERLAMBAT", "DISPENSASI"];

/** Warna titik rekap ringkas — selaras dengan chip status di komponen lain */
const DOT: Record<StatusAbsensi, string> = {
  HADIR: "bg-emerald-500",
  SAKIT: "bg-amber-500",
  IZIN: "bg-sky-500",
  ALPA: "bg-rose-500",
  TERLAMBAT: "bg-orange-500",
  DISPENSASI: "bg-violet-500",
};

export default function FormAbsensi({
  pertemuanId,
  dataSiswa,
  absensiSudahAda,
}: {
  pertemuanId: string;
  dataSiswa: DataSiswa[];
  absensiSudahAda: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<DataSiswa[]>(dataSiswa);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bukaId, setBukaId] = useState<string | null>(null);

  function navigasiSukses(pesan: string) {
    router.push(`/pertemuan/${pertemuanId}?sukses=${encodeURIComponent(pesan)}`);
  }

  const terfilter = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => r.nama.toLowerCase().includes(t) || (r.nis ?? "").includes(t));
  }, [rows, q]);

  const jumlahDitandai = rows.filter((r) => r.status !== null).length;
  const jumlahHadir = rows.filter((r) => r.status === "HADIR").length;

  function tandaiSemuaHadir() {
    setRows((prev) => prev.map((r) => ({ ...r, status: "HADIR" as const, catatan: "" })));
  }

  function ubahStatus(id: string, status: StatusAbsensi) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status, catatan: status === "HADIR" ? "" : r.catatan } : r)));
  }

  async function simpan() {
    // Absensi opsional: hanya siswa yang ditandai yang ikut tersimpan.
    const entries: EntryAbsensi[] = rows
      .filter((r) => r.status !== null)
      .map((r) => ({ siswaId: r.id, status: r.status!, catatan: r.catatan || null }));

    if (entries.length === 0) {
      // Tidak ada yang ditandai — kosongkan bila sebelumnya ada catatan, agar
      // absensi tidak pernah otomatis tersimpan sebagai \"semua hadir\".
      if (!absensiSudahAda) {
        setError("Belum ada siswa yang ditandai — gunakan \"Tandai Semua Hadir\" atau pilih status per siswa.");
        return;
      }
      const yakin = window.confirm(
        "Tidak ada siswa yang ditandai. Hapus seluruh catatan absensi pertemuan ini?"
      );
      if (!yakin) return;
    }

    setLoading(true);
    setError(null);
    try {
      const hasil = await simpanAbsensi(pertemuanId, entries, false);
      setLoading(false);
      if (hasil.ok) navigasiSukses(entries.length === 0 ? "Catatan absensi dikosongkan." : "Absensi berhasil disimpan.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan absensi.");
      setLoading(false);
    }
  }

  async function tandaiTidakTerlaksana() {
    // Menandai tidak terlaksana akan menghapus semua catatan absensi pertemuan ini
    const yakin = window.confirm(
      "Tandai pertemuan ini TIDAK TERLAKSANA?\n\nArtinya pembelajaran batal (guru berhalangan, diganti, atau kegiatan madrasah). Semua catatan absensi pertemuan ini akan dihapus."
    );
    if (!yakin) return;
    setLoading(true);
    setError(null);
    try {
      const hasil = await simpanAbsensi(pertemuanId, [], true);
      setLoading(false);
      if (hasil.ok) navigasiSukses("Pertemuan ditandai tidak terlaksana.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Ringkasan + aksi */}
      <div className="card card-pad">
        <p className="text-sm font-bold text-slate-700">
          {absensiSudahAda ? "Absensi tersimpan — ubah bila perlu" : "Absensi opsional — tandai siswa yang perlu dicatat"}
        </p>

        {/* Aksi cepat — tombol besar & tegas agar mudah terlihat */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={tandaiSemuaHadir}
            className="btn min-h-11 flex-1 !bg-emerald-600 text-white shadow-sm shadow-emerald-900/20 hover:!bg-emerald-700 active:!bg-emerald-800"
            title="Tandai seluruh siswa hadir"
          >
            <CheckCheck className="h-5 w-5" /> Tandai Semua Hadir
          </button>
          <button
            onClick={tandaiTidakTerlaksana}
            disabled={loading}
            className="btn min-h-11 flex-1 !bg-rose-600 text-white shadow-sm shadow-rose-900/20 hover:!bg-rose-700 active:!bg-rose-800"
            title="Pembelajaran batal: guru berhalangan, diganti, atau kegiatan madrasah"
          >
            <UserX className="h-5 w-5" /> Tidak Terlaksana
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-slate-500">
          <span className="text-slate-700">{rows.length} siswa · {jumlahDitandai} ditandai</span>
          {STATUSES.map((s) => {
            const n = rows.filter((r) => r.status === s).length;
            return n > 0 ? (
              <span key={s} className="flex items-center gap-1">
                <span className={cn("h-1.5 w-1.5 rounded-full", DOT[s])} />
                {STATUS_ABSENSI_LABEL[s]} {n}
              </span>
            ) : null;
          })}
        </div>

        {error && (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700">{error}</p>
        )}

        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input !pl-9" placeholder="Cari nama atau NIS siswa…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {/* Daftar siswa */}
      <div className="card overflow-hidden">
        <div className="divide-y divide-slate-100">
          {terfilter.length === 0 && <p className="p-8 text-center text-sm text-slate-400">Tidak ada siswa ditemukan.</p>}
          {terfilter.map((r) => {
            const nomor = rows.indexOf(r) + 1;
            const terbuka = bukaId === r.id;
            return (
              <div key={r.id}>
                <button
                  type="button"
                  onClick={() => setBukaId(terbuka ? null : r.id)}
                  aria-expanded={terbuka}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left sm:px-5"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-extrabold text-slate-500">
                    {nomor}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-bold text-slate-800">{r.nama}</span>
                    <span className="block text-xs text-slate-400">{r.nis ?? "—"}</span>
                  </span>
                  <span
                    className={cn("chip shrink-0", r.status ? STATUS_ABSENSI_BADGE[r.status] : "bg-slate-100 text-slate-500")}
                  >
                    {r.status ? STATUS_ABSENSI_LABEL[r.status] : "Belum"}
                  </span>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", terbuka && "rotate-180")} />
                </button>
                {terbuka && (
                  <div className="fade-up px-4 pb-4 sm:px-5">
                    <div className="grid grid-cols-3 gap-1.5">
                      {STATUSES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => ubahStatus(r.id, s)}
                          className={cn(
                            "flex min-h-11 items-center justify-center rounded-lg px-2 py-2 text-[11px] font-bold transition-all",
                            r.status === s
                              ? STATUS_ABSENSI_BADGE[s] + " ring-1 ring-inset ring-current"
                              : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                          )}
                        >
                          {STATUS_ABSENSI_LABEL[s]}
                        </button>
                      ))}
                    </div>
                    {r.status !== null && r.status !== "HADIR" && (
                      <input
                        className="input mt-2 !py-1.5 text-xs"
                        placeholder={`Catatan untuk ${r.nama} (opsional)`}
                        value={r.catatan}
                        onChange={(e) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, catatan: e.target.value } : x)))}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Simpan */}
      <div className="card card-pad safe-bottom sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 flex flex-col gap-2 sm:static sm:flex-row sm:items-center lg:bottom-0">
        <p className="flex-1 break-words text-sm text-slate-500">
          {jumlahHadir} dari {rows.length} siswa ditandai hadir
        </p>
        <button onClick={simpan} disabled={loading} className="btn-primary btn-lg min-h-11 w-full sm:w-auto">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          Simpan Absensi
        </button>
      </div>
    </div>
  );
}
