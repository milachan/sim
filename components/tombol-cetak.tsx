"use client";

import { Printer } from "lucide-react";

/** Tombol cetak/PDF — client component agar bisa pakai window.print(). */
export function TombolCetak({ className = "btn-secondary btn-sm no-print", label = "Cetak PDF" }: { className?: string; label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      <Printer className="h-4 w-4" /> {label}
    </button>
  );
}
