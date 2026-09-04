"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronDown, Clock, NotebookPen, PenLine } from "lucide-react";
import { useState } from "react";
import { Card, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

export type ItemPerluBeranda = {
  id: string;
  href: string;
  judul: string;
  detail: string;
};

export type GrupPerluBeranda = {
  /** Kunci unik per tanggal, mis. "2026-09-04". */
  tanggal: string;
  /** Label tanggal utk ditampilkan, mis. "Jumat, 4 September 2026". */
  label: string;
  items: ItemPerluBeranda[];
};

/**
 * Kartu "Perlu Dilengkapi" di beranda guru — daftar pertemuan tertinggal
 * dikelompokkan per tanggal. Klik baris tanggal untuk membuka/ menutup
 * (dropdown) rincian pertemuan yang harus dilengkapi hari itu.
 * Tombol "Semua jurnal" diletakkan di bagian paling bawah kartu.
 */
export default function PerluDilengkapiBeranda({ grups }: { grups: GrupPerluBeranda[] }) {
  // Semua baris tertutup saat awal; klik tanggal untuk membuka/menutup rincian.
  const [terbuka, setTerbuka] = useState<string | null>(null);

  return (
    <Card className="mt-4 overflow-hidden">
      <h2 className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 font-extrabold text-slate-900">
        <Clock className="h-5 w-5 text-amber-500" /> Perlu Dilengkapi
      </h2>

      {grups.length === 0 ? (
        <div className="p-5">
          <EmptyState title="Tidak ada jurnal tertinggal" desc="Semua administrasi pertemuan Anda sudah lengkap." />
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {grups.map((grup) => {
            const buka = terbuka === grup.tanggal;
            return (
              <div key={grup.tanggal}>
                <button
                  type="button"
                  onClick={() => setTerbuka(buka ? null : grup.tanggal)}
                  aria-expanded={buka}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-amber-50/50"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100">
                    <CalendarDays className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-bold text-slate-900">{grup.label}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {grup.items.length} pertemuan belum lengkap
                    </span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200",
                      buka && "rotate-180"
                    )}
                    aria-hidden="true"
                  />
                </button>

                {buka && (
                  <div className="bg-amber-50/40">
                    {grup.items.map((item) => (
                      <Link
                        key={item.id}
                        href={item.href}
                        className="group flex items-center gap-3 border-t border-amber-100/80 py-3 pl-[4.75rem] pr-5 transition first:border-t-0 hover:bg-amber-100/50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block break-words text-sm font-bold text-slate-800 group-hover:text-amber-900">
                            {item.judul}
                          </span>
                          <span className="mt-0.5 block break-words text-xs text-slate-500">{item.detail}</span>
                        </span>
                        <span className="btn-primary btn-sm min-h-11 shrink-0 group-hover:bg-emerald-700">
                          <PenLine className="h-3.5 w-3.5" /> Lengkapi
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Akses semua jurnal — di bagian paling bawah kartu */}
      <div className="border-t border-slate-100 p-3">
        <Link
          href="/jurnal"
          className="btn min-h-11 w-full justify-center gap-2 border border-amber-200 bg-amber-50 font-bold text-amber-800 shadow-sm transition hover:border-amber-300 hover:bg-amber-100 focus-visible:ring-amber-600"
        >
          <NotebookPen className="h-4 w-4" aria-hidden="true" /> Semua jurnal
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </Card>
  );
}
