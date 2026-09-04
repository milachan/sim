"use client";

import Link from "next/link";
import { PenLine } from "lucide-react";
import { STATUS_ABSENSI_HARIAN_BADGE, type StatusAbsensiHarian } from "@/lib/constants";

/** Label pendek untuk chip di baris — ringkas di layar HP. */
const LABEL_PENDEK: Record<StatusAbsensiHarian, string> = {
  BELUM_DIISI: "Belum",
  GURU_JAM_PERTAMA: "Jam 1",
  GURU_PIKET: "Piket",
  WALI_KELAS: "Wali",
};

/**
 * Baris kelas yang ringkas (ramah HP): nama kelas + keterangan singkat di kiri,
 * chip status + tombol Isi/Koreksi di kanan — tanpa tile/teks berulang.
 */
export default function BarisKelasAbsensi({
  href,
  nama,
  sub,
  status,
}: {
  href: string;
  nama: string;
  sub?: string;
  status: StatusAbsensiHarian;
}) {
  const belum = status === "BELUM_DIISI";
  return (
    <Link
      href={href}
      className="group flex min-h-[60px] items-center gap-3 px-4 py-2.5 transition hover:bg-emerald-50/50 sm:px-5"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-extrabold text-slate-900 group-hover:text-emerald-700">{nama}</p>
        {sub && <p className="mt-0.5 truncate text-xs text-slate-500">{sub}</p>}
      </div>
      <span className={`chip shrink-0 ${STATUS_ABSENSI_HARIAN_BADGE[status]}`}>{LABEL_PENDEK[status]}</span>
      <span
        className={`btn btn-sm min-h-11 shrink-0 ${
          belum ? "btn-primary group-hover:bg-emerald-700" : "btn-secondary"
        }`}
      >
        <PenLine className="h-3.5 w-3.5" /> {belum ? "Isi" : "Koreksi"}
      </span>
    </Link>
  );
}
