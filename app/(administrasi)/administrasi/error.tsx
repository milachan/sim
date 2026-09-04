"use client";

import Link from "next/link";
import { RefreshCcw, TriangleAlert } from "lucide-react";

// Error boundary Rumah Administrasi — pesan ramah tanpa detail internal.

export default function AdministrasiError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-200">
        <TriangleAlert className="h-6 w-6" aria-hidden="true" />
      </span>
      <div role="alert" aria-live="assertive">
        <h1 className="mt-3 text-base font-extrabold text-slate-900">Terjadi gangguan pada halaman ini</h1>
        <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-500">
          Maaf, halaman tidak dapat dimuat saat ini. Coba muat ulang, atau kembali ke Dashboard Administrasi.
        </p>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="btn-primary min-h-[44px]"
        >
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          Coba Lagi
        </button>
        <Link href="/administrasi" className="btn-secondary min-h-[44px]">
          Ke Dashboard Administrasi
        </Link>
      </div>
    </div>
  );
}
