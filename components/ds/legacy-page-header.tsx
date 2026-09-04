"use client";

import type { ReactNode } from "react";

/**
 * PageHeader legacy — dipertahankan untuk kompatibilitas dengan 36 halaman
 * yang sudah ada di `@/components/ui`. Tidak menggunakan workspace token
 * (warna hard-coded biru). Sedang dalam proses konsolidasi bertahap ke
 * `@/components/ds/page-header` yang bertoken.
 *
 * Jangan pakai untuk halaman baru — gunakan `ds/page-header` sebagai gantinya.
 */
export function LegacyPageHeader({
  title,
  subtitle,
  actions,
  icon,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.9rem] bg-blue-700 text-white shadow-lg shadow-blue-900/15">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="break-words text-[1.25rem] font-extrabold tracking-[-0.02em] text-slate-950 sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-1 max-w-3xl break-words text-sm leading-5 text-slate-600">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
