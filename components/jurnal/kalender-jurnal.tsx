"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn, formatTanggal } from "@/lib/utils";
import { StatusJurnalSederhana } from "./status-jurnal";
import type { ItemJurnalList } from "./daftar-jurnal";

const NAMA_HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

/** Kalender bulanan: ringkasan status jurnal per hari, klik hari untuk melihat rinciannya. */
export default function KalenderJurnal({
  items,
  bulan,
  linkQuery = "",
  sembunyikanGuru = false,
}: {
  items: ItemJurnalList[];
  bulan: string;
  /** Query string tambahan di tautan detail (mis. ?kembali=...) agar halaman detail punya tombol kembali. */
  linkQuery?: string;
  /** Guru melihat daftarnya sendiri — nama guru di tiap baris diulang, jadi disembunyikan. */
  sembunyikanGuru?: boolean;
}) {
  const [hariDipilih, setHariDipilih] = useState<string | null>(null);

  const [tahun, bulanNum] = bulan.split("-").map(Number);
  const jmlHari = new Date(tahun, bulanNum, 0).getDate();
  const offset = (new Date(tahun, bulanNum - 1, 1).getDay() + 6) % 7; // pekan dimulai Senin
  const now = new Date();
  const hariIni = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const perHari = useMemo(() => {
    const map: Record<string, ItemJurnalList[]> = {};
    for (const it of items) (map[it.tanggal] ??= []).push(it);
    return map;
  }, [items]);

  const sel = hariDipilih ? perHari[hariDipilih] ?? [] : [];

  function ringkasan(dayItems: ItemJurnalList[]) {
    let terkirim = 0,
      belum = 0;
    for (const it of dayItems) {
      if (it.jurnalStatus === "TERKIRIM") terkirim++;
      else belum++; // draft (konsep lama) disatukan dengan belum diisi
    }
    return { terkirim, belum };
  }

  const selisihHari = (a: string, b: string) => {
    const da = new Date(a).getTime();
    const db = new Date(b).getTime();
    return Math.round((da - db) / 86400000);
  };

  return (
    <div className="space-y-4">
      <div className="card card-pad">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h3 className="break-words font-extrabold capitalize text-slate-900">{formatTanggal(`${bulan}-01`, "MMMM yyyy")}</h3>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-500">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Lengkap</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" /> Belum</span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {NAMA_HARI.map((h) => (
            <div key={h} className="pb-1 text-center text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
              {h}
            </div>
          ))}
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`kosong-${i}`} aria-hidden="true" />
          ))}
          {Array.from({ length: jmlHari }).map((_, i) => {
            const tgl = `${bulan}-${String(i + 1).padStart(2, "0")}`;
            const dayItems = perHari[tgl] ?? [];
            const r = ringkasan(dayItems);
            const aktif = hariDipilih === tgl;
            const today = tgl === hariIni;
            // Status dominan untuk dot ringkas di mobile.
            const dominan: "rose" | "emerald" | null = r.belum > 0 ? "rose" : r.terkirim > 0 ? "emerald" : null;
            const dotWarna: Record<"emerald" | "rose", string> = {
              emerald: "bg-emerald-500",
              rose: "bg-rose-400",
            };
            const dotClass = dominan ? dotWarna[dominan] : "";
            return (
              <button
                key={tgl}
                onClick={() => setHariDipilih(aktif ? null : tgl)}
                disabled={dayItems.length === 0}
                className={cn(
                  "relative flex min-h-[44px] flex-col rounded-xl p-1 text-left ring-1 ring-inset transition sm:min-h-[74px] sm:p-1.5",
                  dayItems.length === 0
                    ? "bg-slate-50/60 ring-slate-100"
                    : "cursor-pointer ring-slate-200 hover:ring-emerald-400 hover:shadow-sm",
                  aktif && "bg-emerald-600 ring-emerald-600",
                  today && !aktif && "ring-2 ring-blue-400"
                )}
                aria-label={`${tgl} — ${dayItems.length} pertemuan`}
              >
                <span className={cn("text-xs font-extrabold", aktif ? "text-white" : today ? "text-blue-600" : "text-slate-600")}>
                  {i + 1}
                </span>
                {dayItems.length > 0 && (
                  <>
                    {/* Mobile: satu dot warna (status dominan) agar cell tidak overflow. */}
                    {dominan && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-auto h-1.5 w-1.5 self-start rounded-full sm:hidden",
                          aktif ? "bg-white" : dotClass
                        )}
                      />
                    )}
                    {/* sm ke atas: 3 chip ringkasan (lebih lega). */}
                    <div className="mt-auto hidden flex-wrap gap-1 sm:flex">
                      {r.terkirim > 0 && (
                        <span className={cn("chip !px-1.5 !py-0.5 text-[10px]", aktif ? "bg-white/25 text-white" : "bg-emerald-100 text-emerald-700")}>
                          {r.terkirim}✓
                        </span>
                      )}
                      {r.belum > 0 && (
                        <span className={cn("chip !px-1.5 !py-0.5 text-[10px]", aktif ? "bg-white/25 text-white" : "bg-rose-100 text-rose-600")}>
                          {r.belum}!
                        </span>
                      )}
                    </div>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rincian hari terpilih */}
      {hariDipilih && (
        <div className="fade-up">
          <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="break-words font-extrabold text-slate-800">{formatTanggal(hariDipilih, "EEEE, d MMMM yyyy")}</h4>
            <span className="break-words text-xs font-semibold text-slate-400">
              {sel.length} pertemuan {selisihHari(hariDipilih, hariIni) > 0 ? "(mendatang)" : selisihHari(hariDipilih, hariIni) < 0 ? "(lewat)" : "(hari ini)"}
            </span>
          </div>
          <div className="space-y-2.5">
            {sel.map((p) => (
              <Link key={p.id} href={`/pertemuan/${p.id}${linkQuery ? `?${linkQuery}` : ""}`} className="card group flex items-center gap-3 p-4 transition hover:border-emerald-300 hover:shadow-md sm:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="break-words font-bold text-slate-900 group-hover:text-emerald-700">
                    {p.mapel} — {p.kelas}
                    {!sembunyikanGuru && p.guru && <span className="ml-2 break-words text-xs font-semibold text-slate-400">{p.guru}</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {p.pertemuanKe > 0 && `Pertemuan ke-${p.pertemuanKe}`}
                    {p.sumber === "MANUAL" && <span className="ml-2 chip bg-amber-100 text-amber-700">Manual</span>}
                  </p>
                </div>
                <div className="shrink-0">
                  <StatusJurnalSederhana status={p.jurnalStatus} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
