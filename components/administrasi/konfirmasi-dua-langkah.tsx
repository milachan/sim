"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Konfirmasi aksi dua langkah yang dipakai bersama (Setujui / Finalisasi).
// Tahap 1: tombol pemicu. Tahap 2: panel tinjauan berisi ringkasan +
// tombol konfirmasi akhir + batal. Mencegah double-submit via `pending`.

const TONAL_TOMBOL = {
  blue: "bg-blue-700 text-white hover:bg-blue-800 focus-visible:ring-blue-600",
  emerald: "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500",
  amber: "bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-500",
  rose: "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500",
} as const;

export default function KonfirmasiDuaLangkah({
  labelTombol,
  ikon: Ikon,
  tonal = "blue",
  judulTinjau,
  deskripsiTinjau,
  labelKonfirmasi,
  pendingLabel,
  pending,
  error,
  onKonfirmasi,
  children,
}: {
  labelTombol: string;
  ikon?: LucideIcon;
  tonal?: keyof typeof TONAL_TOMBOL;
  judulTinjau: string;
  deskripsiTinjau?: string;
  labelKonfirmasi: string;
  pendingLabel: string;
  pending: boolean;
  error?: string | null;
  onKonfirmasi: () => void;
  children?: React.ReactNode;
}) {
  const [terbuka, setTerbuka] = useState(false);
  const judulRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (terbuka) judulRef.current?.focus();
  }, [terbuka]);

  if (!terbuka) {
    return (
      <button
        type="button"
        onClick={() => setTerbuka(true)}
        disabled={pending}
        className={cn(
          "btn w-full focus-visible:ring-2 focus-visible:ring-offset-2",
          TONAL_TOMBOL[tonal]
        )}
      >
        {Ikon && <Ikon className="h-4 w-4" aria-hidden="true" />}
        {labelTombol}
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 fade-up" role="group" aria-label={judulTinjau}>
      <h4 ref={judulRef} tabIndex={-1} className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900 outline-none">
        <ShieldCheck className="h-4 w-4 text-slate-500" aria-hidden="true" />
        {judulTinjau}
      </h4>
      {deskripsiTinjau && <p className="mt-1 text-xs leading-relaxed text-slate-500">{deskripsiTinjau}</p>}

      {children}

      {error && (
        <p role="alert" className="mt-3 flex items-start gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onKonfirmasi}
          disabled={pending}
          className={cn("btn flex-1 focus-visible:ring-2 focus-visible:ring-offset-2", TONAL_TOMBOL[tonal])}
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {pending ? pendingLabel : labelKonfirmasi}
        </button>
        <button
          type="button"
          onClick={() => setTerbuka(false)}
          disabled={pending}
          className="btn-secondary shrink-0"
        >
          Batal
        </button>
      </div>
    </div>
  );
}
