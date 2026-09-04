"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ItemGuru = {
  guruId: string;
  nama: string;
  total: number;
  lengkap: number;
  persen: number;
  href: string;
};

/**
 * Panel "Guru Perlu Perhatian" — ringkas.
 *
 * Di halaman utama hanya menampilkan maksimal 5 guru dengan persentase
 * kelengkapan terendah; jumlah total ditampilkan sebagai chip. Bila jumlahnya
 * lebih banyak, tombol "Lihat Semua" membuka modal berisi daftar lengkap,
 * sehingga daftar jurnal di bawah tetap langsung terlihat tanpa scroll jauh.
 */
export default function PanelGuruPerhatian({
  bulanLabel,
  daftarGuru,
  jumlahLengkap,
  jumlahPerhatian,
  guruAktifId,
}: {
  bulanLabel: string;
  daftarGuru: ItemGuru[];
  /** Guru yang sudah lengkap (persen 100) — hanya untuk chip agregat. */
  jumlahLengkap: number;
  /** Total guru yang masih punya jurnal belum lengkap. */
  jumlahPerhatian: number;
  guruAktifId?: string;
}) {
  const MAX = 5;
  const [buka, setBuka] = useState(false);
  const ringkas = daftarGuru.slice(0, MAX);
  const lihatSemua = daftarGuru.length > MAX;

  function Kartu({ g }: { g: ItemGuru }) {
    const aktif = g.guruId === guruAktifId;
    return (
      <Link
        href={g.href}
        onClick={() => setBuka(false)}
        className={cn(
          "group rounded-xl p-3 ring-1 ring-inset transition",
          aktif ? "bg-emerald-50 ring-emerald-300" : "ring-slate-200 hover:bg-slate-50 hover:ring-emerald-300"
        )}
      >
        <div className="mb-1 flex items-center justify-between gap-2 text-sm">
          <span className="truncate font-bold text-slate-700 group-hover:text-emerald-700">{g.nama}</span>
          <span className={cn("shrink-0 font-extrabold", aktif ? "text-emerald-700" : "text-slate-500")}>{g.persen}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn("h-full rounded-full transition-all", g.persen >= 80 ? "bg-emerald-500" : g.persen >= 60 ? "bg-amber-400" : "bg-rose-500")}
            style={{ width: `${g.persen}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-slate-400">
          {g.lengkap}/{g.total} jurnal lengkap
        </p>
      </Link>
    );
  }

  return (
    <div className="card card-pad mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-extrabold text-slate-900">
          <Users className="h-5 w-5 text-emerald-600" />
          Guru Perlu Perhatian — {bulanLabel}
        </h3>
        {lihatSemua && (
          <button onClick={() => setBuka(true)} className="btn-secondary btn-sm !min-h-9">
            <Eye className="h-3.5 w-3.5" /> Lihat Semua ({daftarGuru.length})
          </button>
        )}
      </div>

      {/* Ringkasan agregat — Waka tidak perlu menelusuri semua guru */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="chip bg-emerald-100 text-emerald-700">{jumlahLengkap} guru sudah lengkap ✓</span>
        {jumlahPerhatian > 0 && <span className="chip bg-rose-100 text-rose-600">{jumlahPerhatian} guru perlu perhatian</span>}
      </div>

      {ringkas.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Semua guru sudah melengkapi jurnal — tidak ada yang perlu ditindaklanjuti.</p>
      ) : (
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {ringkas.map((g) => (
            <Kartu key={g.guruId} g={g} />
          ))}
        </div>
      )}

      {/* Modal daftar lengkap */}
      {buka && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setBuka(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Semua guru perlu perhatian"
        >
          <div
            className="fade-up flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
              <div>
                <h4 className="font-extrabold text-slate-900">Semua Guru Perlu Perhatian</h4>
                <p className="text-xs text-slate-500">
                  {daftarGuru.length} guru belum lengkap · {bulanLabel}
                </p>
              </div>
              <button onClick={() => setBuka(false)} className="btn-ghost btn-sm !min-h-9 !px-2.5" aria-label="Tutup">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-2.5 overflow-y-auto p-4 sm:grid-cols-2">
              {daftarGuru.map((g) => (
                <Kartu key={g.guruId} g={g} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
