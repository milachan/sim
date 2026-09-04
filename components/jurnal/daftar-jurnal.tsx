"use client";

import Link from "next/link";
import { formatTanggal } from "@/lib/utils";
import { StatusJurnalSederhana } from "@/components/jurnal/status-jurnal";

export type ItemJurnalList = {
  id: string;
  tanggal: string; // ISO YYYY-MM-DD
  mapel: string;
  kelas: string;
  guru: string;
  pertemuanKe: number;
  hari: string;
  sumber: "MANUAL" | "OTOMATIS";
  jurnalStatus: "DRAFT" | "TERKIRIM" | null;
};

export default function DaftarJurnal({
  items,
  linkQuery = "",
  sembunyikanGuru = false,
}: {
  items: ItemJurnalList[];
  /** Query string tambahan di tautan detail (mis. ?kembali=...) agar halaman detail punya tombol kembali. */
  linkQuery?: string;
  /** Guru melihat daftarnya sendiri — nama guru di tiap baris diulang, jadi disembunyikan. */
  sembunyikanGuru?: boolean;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="divide-y divide-slate-100">
        {items.map((p) => (
          <div key={p.id} className="group flex items-stretch transition hover:bg-emerald-50/40">
            <Link
              href={`/pertemuan/${p.id}${linkQuery ? `?${linkQuery}` : ""}`}
              className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 sm:gap-4 sm:px-5 sm:py-4"
            >
              <div className="flex h-11 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-emerald-50 ring-1 ring-inset ring-emerald-100">
                <span className="text-lg font-extrabold leading-none text-emerald-700">{formatTanggal(p.tanggal, "d")}</span>
                <span className="mt-0.5 text-[10px] font-bold uppercase text-emerald-500">{formatTanggal(p.tanggal, "MMM")}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="break-words font-bold leading-snug text-slate-900 group-hover:text-emerald-700">
                  {p.mapel} — {p.kelas}
                  {!sembunyikanGuru && p.guru && <span className="ml-2 break-words text-xs font-semibold text-slate-400">{p.guru}</span>}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 break-words text-xs text-slate-500">
                  {p.hari && <span className="break-words">{p.hari}</span>}
                  {p.pertemuanKe > 0 && <span className="break-words">Pertemuan ke-{p.pertemuanKe}</span>}
                  {p.sumber === "MANUAL" && <span className="chip bg-amber-100 text-amber-700">Manual</span>}
                </p>
              </div>
              <div className="shrink-0">
                <StatusJurnalSederhana status={p.jurnalStatus} />
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
