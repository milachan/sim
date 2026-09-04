"use client";

import Link from "next/link";
import { CalendarDays, ClipboardCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { Hari, StatusPertemuan } from "@prisma/client";
import { Card, EmptyState } from "@/components/ui";
import { PertemuanBadge, UpacaraBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import { apakahJamUpacara, jamKeBerjalan } from "@/lib/constants";

export type ItemJadwalBeranda = {
  id: string;
  href: string;
  hari: Hari;
  mapel: string;
  kelas: string;
  kelasId: string;
  jamKeMulai: number;
  jamKeSelesai: number;
  rentang: string | null;
  pertemuanKe: number;
  status: StatusPertemuan;
  /** Kelas jam-pertama milik guru ini yang absensi hariannya belum lengkap → wajib isi dulu. */
  wajibAbsenDulu: boolean;
};

/**
 * Kartu "Jadwal Hari Ini" di beranda guru.
 *
 * Baris jam pelajaran yang sedang berjalan ditandai otomatis ("menyala") agar
 * guru langsung tahu pertemuan mana yang harus diisi jurnalnya sekarang.
 * Penanda dihitung ulang tiap 30 detik dari jam dinding WIB sehingga ikut
 * berpindah antar jam tanpa perlu muat ulang halaman. Nilai awal (jamAwal)
 * dikirim server agar markup pertama konsisten saat SSR/hidrasi.
 *
 * Baris yang `wajibAbsenDulu` (kelas jam-pertama guru ini, absensi harian belum
 * lengkap) menjadi gerbang: klik membuka pengisian absensi kelas, bukan halaman
 * jurnal — absensi harus diisi dahulu sebelum bisa masuk ke pengisian jurnal.
 */
export default function JadwalHariIniBeranda({
  hari,
  items,
  jamAwal,
}: {
  hari: Hari | null;
  items: ItemJadwalBeranda[];
  jamAwal: number | null;
}) {
  const [jamAktif, setJamAktif] = useState<number | null>(jamAwal);

  useEffect(() => {
    if (!hari) return;
    const perbarui = () => setJamAktif(jamKeBerjalan(hari, new Date()));
    perbarui();
    const id = setInterval(perbarui, 30_000);
    return () => clearInterval(id);
  }, [hari]);

  return (
    <Card className="mt-4 overflow-hidden">
      <h2 className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 font-extrabold text-slate-900">
        <CalendarDays className="h-5 w-5 text-emerald-600" /> Jadwal Hari Ini
      </h2>

      {items.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="Tidak ada jadwal mengajar hari ini"
            desc="Manfaatkan waktu untuk melengkapi administrasi yang tertinggal di bawah."
          />
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((item) => {
            const gated = item.wajibAbsenDulu;
            const sedang =
              !gated && jamAktif !== null && item.jamKeMulai <= jamAktif && jamAktif <= item.jamKeSelesai;
            // Gerbang jurnal: baris ini membawa id pertemuan agar setelah absensi harian
            // kelas diisi, guru bisa langsung melanjutkan ke pengisian jurnal pertemuan itu.
            const tujuan = gated ? `/absensi-harian/${item.kelasId}?pertemuan=${item.id}` : item.href;
            const belum = item.status !== "LENGKAP" && item.status !== "TIDAK_TERLAKSANA";
            return (
              <Link
                key={item.id}
                href={tujuan}
                className={cn(
                  "group flex items-center gap-4 px-5 py-4 transition",
                  gated
                    ? "bg-blue-50/60 hover:bg-blue-100/70"
                    : sedang
                      ? "bg-emerald-50/70 hover:bg-emerald-100/70"
                      : "hover:bg-emerald-50/50"
                )}
              >
                <div
                  className={cn(
                    "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl ring-1 ring-inset transition-colors",
                    gated
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-900/20 ring-blue-600"
                      : sedang
                        ? "bg-emerald-600 text-white shadow-sm shadow-emerald-900/20 ring-emerald-600"
                        : "bg-emerald-50 text-emerald-700 ring-emerald-100"
                  )}
                >
                  <span className="text-[10px] font-bold uppercase">Jam</span>
                  <span className="text-sm font-extrabold leading-none">
                    {item.jamKeMulai}
                    {item.jamKeSelesai > item.jamKeMulai ? `–${item.jamKeSelesai}` : ""}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2">
                    <span
                      className={cn(
                        "truncate font-bold",
                        gated
                          ? "text-blue-900"
                          : sedang
                            ? "text-emerald-900"
                            : "text-slate-900 group-hover:text-emerald-700"
                      )}
                    >
                      {item.mapel}
                    </span>
                    {apakahJamUpacara(item.hari, item.jamKeMulai) && <UpacaraBadge />}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {item.kelas} · {item.rentang ?? `Jam ${item.jamKeMulai}`} · Pertemuan ke-{item.pertemuanKe}
                  </p>
                </div>

                {gated ? (
                  <span className="chip shrink-0 bg-blue-600 text-white shadow-sm">
                    <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" /> Isi absensi dulu
                  </span>
                ) : sedang ? (
                  <span className="chip shrink-0 bg-emerald-600 text-white shadow-sm">
                    <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                    </span>
                    Sedang berlangsung
                  </span>
                ) : belum ? (
                  <span className="chip bg-amber-100 text-amber-700 group-hover:bg-amber-200/70">Perlu diisi</span>
                ) : (
                  <PertemuanBadge status={item.status} />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}
