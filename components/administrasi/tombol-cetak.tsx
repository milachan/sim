"use client";

import { Printer } from "lucide-react";

// Tombol cetak Lembar Verifikasi — tanpa auto-print saat halaman dimuat.

export default function TombolCetak() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary min-h-[44px]">
      <Printer className="h-4 w-4" aria-hidden="true" />
      Cetak
    </button>
  );
}
