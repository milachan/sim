"use client";

import { ChartPie } from "lucide-react";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { ROLE_BADGE, ROLE_LABEL } from "@/lib/constants";
import { alamatRumahJurnal } from "@/lib/workspace-config";
import WorkspaceSwitcher from "@/components/workspace-switcher";
import TombolKembali from "@/components/ds/tombol-kembali";

// Shell milik Rumah Analisis Nilai — TERPISAH dari sidebar jurnal
// (components/app-shell.tsx tidak digunakan sama sekali di rumah ini).
// data-workspace="analisis-nilai" mengaktifkan aksen violet via design token.
export default function AnalisisShell({
  user,
  children,
}: {
  user: { nama: string; username: string; role: Role };
  children: React.ReactNode;
}) {
  const rumahUtama = alamatRumahJurnal(user.role);

  return (
    <div data-workspace="analisis-nilai" className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-accent-border bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex min-h-[var(--shell-header-h)] w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent ring-1 ring-inset ring-accent-border">
            <ChartPie className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold text-slate-900">Rumah Analisis Nilai</p>
            <p className="truncate text-[11px] text-slate-500">
              {user.nama}{" "}
              <span className={cn("ml-1 inline-block rounded-full px-1.5 py-0.5 align-middle text-[10px] font-bold", ROLE_BADGE[user.role])}>
                {ROLE_LABEL[user.role]}
              </span>
            </p>
          </div>
          <WorkspaceSwitcher role={user.role} />
          {/* Bertuliskan "Rumah Utama" — harus selalu navigasi ke rumah utama,
              bukan jadi router.back() saat ada riwayat. fallbackHref memaksanya. */}
          <TombolKembali
            fallbackHref={rumahUtama}
            label="Rumah Utama"
            kunciLabel
            tampilkanLabel="always"
            ariaLabel="Kembali ke rumah utama"
            className="shrink-0 border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-500"
          />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">{children}</main>

      <footer className="border-t border-[hsl(var(--card-border))] py-4 text-center text-[11px] text-slate-400">
        Rumah Analisis Nilai — terpisah dari rumah Jurnal
      </footer>
    </div>
  );
}
