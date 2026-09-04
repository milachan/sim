"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { DonutChart } from "@/components/charts";
import BarisKelasAbsensi from "@/components/absensi-harian/baris-kelas-absensi";
import { STATUS_ABSENSI_HARIAN_LABEL, type StatusAbsensiHarian } from "@/lib/constants";

const WARNA_STATUS: Record<StatusAbsensiHarian, string> = {
  BELUM_DIISI: "#94a3b8",
  GURU_JAM_PERTAMA: "#059669",
  GURU_PIKET: "#f59e0b",
  WALI_KELAS: "#8b5cf6",
};

export type BarisKelasPiket = {
  id: string;
  nama: string;
  tingkat: number;
  mapelNama: string | null;
  guruJPNama: string | null;
  status: StatusAbsensiHarian;
  pengisiNama: string | null;
};

/**
 * Daftar kelas untuk akun petugas piket: pencarian & filter status interaktif.
 * Ringkas & ramah HP — grafik donat hanya ditampilkan di layar lebar.
 */
export default function DaftarKelasPiket({
  rows,
  tanggalStr,
}: {
  rows: BarisKelasPiket[];
  tanggalStr: string;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"SEMUA" | "BELUM" | "SUDAH">("SEMUA");

  const donut = (Object.keys(WARNA_STATUS) as StatusAbsensiHarian[]).map((s) => ({
    label: STATUS_ABSENSI_HARIAN_LABEL[s],
    nilai: rows.filter((r) => r.status === s).length,
    warna: WARNA_STATUS[s],
  }));

  const terfilter = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (t && !r.nama.toLowerCase().includes(t)) return false;
      if (filter === "BELUM" && r.status !== "BELUM_DIISI") return false;
      if (filter === "SUDAH" && r.status === "BELUM_DIISI") return false;
      return true;
    });
  }, [rows, q, filter]);

  const jumlahSudah = rows.filter((r) => r.status !== "BELUM_DIISI").length;
  const adaPenyaring = q.trim() !== "" || filter !== "SEMUA";

  return (
    <CardPiket>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <h2 className="font-extrabold text-slate-900">Semua Kelas</h2>
        <span className="chip bg-blue-50 text-blue-700">
          {jumlahSudah}/{rows.length} terisi
        </span>
      </div>

      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 lg:grid lg:grid-cols-2">
        <div className="hidden justify-center lg:flex">
          <DonutChart data={donut} size={150} />
        </div>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="input !pl-9"
              placeholder="Cari kelas… (mis. 9A)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: "SEMUA", label: "Semua" },
                { id: "BELUM", label: "Belum" },
                { id: "SUDAH", label: "Sudah" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "min-h-11 rounded-lg px-4 py-2 text-xs font-bold transition",
                  filter === f.id ? "bg-blue-700 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          {adaPenyaring && (
            <p className="text-xs text-slate-400">
              {terfilter.length} dari {rows.length} kelas
            </p>
          )}
        </div>
      </div>

      {terfilter.length === 0 ? (
        <p className="p-8 text-center text-sm text-slate-400">Tidak ada kelas yang cocok.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {terfilter.map((r) => (
            <BarisKelasAbsensi
              key={r.id}
              href={`/absensi-harian/${r.id}?tanggal=${tanggalStr}`}
              nama={r.nama}
              sub={
                r.guruJPNama
                  ? r.mapelNama
                    ? `${r.mapelNama} · ${r.guruJPNama}`
                    : r.guruJPNama
                  : "Tanpa guru jam pertama — backup piket/wali"
              }
              status={r.status}
            />
          ))}
        </div>
      )}
    </CardPiket>
  );
}

function CardPiket({ children }: { children: React.ReactNode }) {
  return <div className="card overflow-hidden">{children}</div>;
}
