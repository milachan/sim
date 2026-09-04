"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

// Tombol salin ke clipboard. Nonaktif ramah bila clipboard tidak tersedia.

export default function TombolSalin({ nilai, label }: { nilai: string; label: string }) {
  const [tersalin, setTersalin] = useState(false);
  const didukung = typeof navigator !== "undefined" && !!navigator.clipboard?.writeText;

  if (!didukung) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        Salin tidak tersedia
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(nilai);
            setTersalin(true);
            setTimeout(() => setTersalin(false), 2000);
          } catch {
            setTersalin(false);
          }
        }}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        aria-label={`Salin ${label}`}
      >
        {tersalin ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
        {tersalin ? "Tersalin" : "Salin"}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {tersalin ? `${label} tersalin ke clipboard` : ""}
      </span>
    </span>
  );
}
