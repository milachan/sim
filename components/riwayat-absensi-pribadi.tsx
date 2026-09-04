"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";
import { formatTanggal } from "@/lib/utils";

export type ItemRiwayat = {
  id: string;
  tanggal: string; // ISO YYYY-MM-DD
  mapel: string;
  kelas: string;
  pertemuanKe: number;
  hadir: number;
  total: number;
};

/** Jumlah baris yang tampil setiap klik "Muat lebih banyak". */
const PER_BATCH = 40;

/**
 * Riwayat Pertemuan — daftar semua data diterima dari server (jumlah asli
 * akurat), tetapi hanya sebagian dirender dulu. Pencarian memfilter berdasarkan
 * tanggal, mapel, atau kelas. Cocok untuk HP: tidak perlu tabel lebar.
 */
export default function RiwayatAbsensiPribadi({ items }: { items: ItemRiwayat[] }) {
  const [q, setQ] = useState("");
  const [batas, setBatas] = useState(PER_BATCH);

  const hasil = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((i) => {
      const tanggal = [i.tanggal, formatTanggal(i.tanggal, "d MMMM yyyy")].join(" ").toLowerCase();
      return tanggal.includes(t) || i.mapel.toLowerCase().includes(t) || i.kelas.toLowerCase().includes(t);
    });
  }, [items, q]);

  const tampil = hasil.slice(0, batas);
  const tersisa = Math.max(0, hasil.length - tampil.length);
  const adaFilter = q.trim().length > 0;

  function gantiCari(v: string) {
    setQ(v);
    setBatas(PER_BATCH);
  }

  return (
    <section>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-baseline gap-2 font-extrabold text-slate-900">
          Riwayat Pertemuan
          <span className="text-xs font-semibold text-slate-400">
            {adaFilter ? `${hasil.length} cocok` : `${hasil.length} dari ${items.length} total`}
          </span>
        </h2>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => gantiCari(e.target.value)}
            placeholder="Cari tanggal, mapel, atau kelas…"
            className="input !pl-9"
            aria-label="Cari riwayat berdasarkan tanggal, mapel, atau kelas"
          />
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState title="Belum ada pertemuan tercatat" desc="Riwayat muncul setelah Anda mengisi absensi pada halaman pertemuan." />
      ) : tampil.length === 0 ? (
        <EmptyState title="Tidak ada yang cocok" desc="Coba tanggal, mapel, atau kelas lain." />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-slate-100">
            {tampil.map((p) => (
              <Link
                key={p.id}
                href={`/pertemuan/${p.id}`}
                className="group flex items-center gap-3 px-4 py-3 transition hover:bg-emerald-50/40 sm:gap-4 sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-bold text-slate-900 group-hover:text-emerald-700">
                    {p.mapel} — {p.kelas}
                  </p>
                  <p className="mt-0.5 break-words text-xs text-slate-500">
                    {formatTanggal(p.tanggal)}
                    {p.pertemuanKe > 0 ? ` · Pertemuan ke-${p.pertemuanKe}` : ""} · {p.hadir}/{p.total} hadir
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-emerald-500" />
              </Link>
            ))}
          </div>
        </Card>
      )}

      {tersisa > 0 && (
        <button
          onClick={() => setBatas((b) => b + PER_BATCH)}
          className="btn-secondary mt-3 min-h-11 w-full justify-center"
        >
          Muat lebih banyak ({tersisa} tersisa)
        </button>
      )}
    </section>
  );
}
