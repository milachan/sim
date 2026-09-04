"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LogOut, Menu, X } from "lucide-react";
import type { JenisGuru, Role } from "@prisma/client";
import { cn, formatTanggalPanjang } from "@/lib/utils";
import { ROLE_BADGE, ROLE_LABEL } from "@/lib/constants";
import { PwaInstallButton } from "@/components/pwa";
import { getBottomNavConfig, getSidebarNav } from "@/lib/nav-config";
import { alamatRumahJurnal } from "@/lib/workspace-config";
import WorkspaceSwitcher from "@/components/workspace-switcher";
import TombolKembali from "@/components/ds/tombol-kembali";

// Shell Rumah Jurnal. data-workspace="jurnal" mengaktifkan aksen biru
// via design token (app/globals.css). Perubahan hanya presentasional —
// menu, badge, state, dan perilaku berasal dari lib/nav-config.

export default function AppShell({
  user,
  jenisGuru = "BIASA",
  isAkunPiket = false,
  absensiHarianBadge = 0,
  guruId,
  children,
}: {
  user: { nama: string; username: string; role: Role };
  jenisGuru?: JenisGuru;
  isAkunPiket?: boolean;
  absensiHarianBadge?: number;
  guruId?: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const tombolTutupRef = useRef<HTMLButtonElement>(null);
  // Susunan menu dari lib/nav-config (murni & dites): WAKA terhubung memperoleh
  // dua kelompok (Pengajaran Saya + Pemantauan Waka), tanpa href duplikat.
  const groups = getSidebarNav(user.role, { jenisGuru, isAkunPiket, guruId });

  // A11y drawer mobile: escape, kunci scroll, fokus ke tombol tutup.
  useEffect(() => {
    if (!open) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", escape);
    document.body.style.overflow = "hidden";
    tombolTutupRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", escape);
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  const SidebarContent = (
    <>
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-inset ring-white/15">
        <Image src="/logo.png" alt="Logo Sistem Administrasi Guru" width={512} height={512} className="h-8 w-8 object-contain" />
      </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-white">Sistem Administrasi Guru</p>
          <p className="truncate text-[11px] text-blue-200/80">MTs Negeri 2 Kebumen</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="px-3 pb-1.5 text-[10px] font-extrabold uppercase tracking-widest text-blue-200/60">
              {g.label}
            </p>
            <div className="space-y-0.5">
              {g.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                      active
                        ? "bg-blue-400/15 text-white ring-1 ring-inset ring-blue-200/30"
                        : "text-blue-100/75 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <item.icon className={cn("h-5 w-5 shrink-0", active ? "text-blue-200" : "text-blue-200/60 group-hover:text-blue-100")} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-400/20 text-sm font-extrabold text-blue-100">
            {user.nama
              .split(" ")
              .slice(0, 2)
              .map((k) => k[0])
              .join("")
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{user.nama}</p>
            <p className={cn("chip mt-0.5", ROLE_BADGE[user.role])}>{ROLE_LABEL[user.role]}</p>
          </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Keluar"
              aria-label="Keluar dari aplikasi"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-blue-100/70 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-5 w-5" />
            </button>
        </div>
      </div>
    </>
  );

  return (
    <div data-workspace="jurnal" className="min-h-screen">
      {/* Sidebar desktop */}
      <a href="#main-content" className="sr-only z-[60] rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-900 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Lewati ke konten utama
      </a>

      <aside className="app-sidebar fixed inset-y-0 left-0 z-40 hidden w-[var(--shell-sidebar-w)] flex-col lg:flex">
        {SidebarContent}
      </aside>

      {/* Drawer mobile */}
      {open && (
        <div id="drawer-jurnal" className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu navigasi mobile">
          <button
            type="button"
            aria-label="Tutup menu navigasi"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-slate-900/60 backdrop-blur-sm"
            tabIndex={-1}
          />
          <aside className="app-sidebar safe-top absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col shadow-2xl fade-up" aria-label="Menu navigasi mobile">
            <button
              ref={tombolTutupRef}
              autoFocus
              onClick={() => setOpen(false)}
              aria-label="Tutup menu navigasi"
              className="absolute right-3 top-4 rounded-lg p-2 text-blue-100 hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
            {SidebarContent}
          </aside>
        </div>
      )}

      <div className="lg:pl-[var(--shell-sidebar-w)]">
        {/* Topbar — safe-area top for PWA notch */}
        <header className="app-topbar safe-top no-print sticky top-0 z-30 flex min-h-[var(--shell-header-h)] items-center justify-between gap-3 border-b px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              aria-label="Buka menu navigasi"
              aria-expanded={open}
              aria-controls="drawer-jurnal"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <TombolKembali
              rumahHref={alamatRumahJurnal(user.role, isAkunPiket)}
              className="text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-500"
            />
            <p className="hidden text-sm font-medium text-slate-500 sm:block">{formatTanggalPanjang(new Date())}</p>
          </div>
          <div className="flex items-center gap-2">
            <WorkspaceSwitcher role={user.role} isAkunPiket={isAkunPiket} />
            <PwaInstallButton compact />
            <span className={cn("chip hidden sm:inline-flex", ROLE_BADGE[user.role])}>{ROLE_LABEL[user.role]}</span>
            <span className="hidden text-sm font-bold text-slate-700 md:block">{user.nama}</span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              aria-label="Keluar dari aplikasi"
              className="btn-secondary !min-h-[44px] !px-3"
              title="Keluar"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>

        {(() => {
          const hasBottomNav = !!getBottomNavConfig(user.role, jenisGuru, isAkunPiket, guruId);
          return (
            <main id="main-content" className={cn("mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:pb-10", hasBottomNav ? "pb-24 lg:pb-10" : "pb-6")}>
              {children}
            </main>
          );
        })()}
      </div>

      {(() => {
        const navItems = getBottomNavConfig(user.role, jenisGuru, isAkunPiket, guruId);
        if (!navItems) return null;
        const colMap: Record<number, string> = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" };
        const cols = colMap[navItems.length] ?? "grid-cols-4";
        return (
          <nav aria-label="Navigasi utama" className={`safe-bottom no-print fixed inset-x-0 bottom-0 z-40 grid ${cols} border-[hsl(var(--card-border))] border-t bg-white/95 backdrop-blur-md lg:hidden`}>
            {navItems.map((item) => {
              const active = isActive(item.href);
              const showBadge =
                item.href === "/absensi-harian" &&
                absensiHarianBadge > 0 &&
                (user.role === "GURU" || user.role === "WAKA") &&
                !isAkunPiket;
              const ariaLabel = showBadge ? `Absensi Harian, ${absensiHarianBadge} kelas belum diisi` : item.ariaLabel;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={ariaLabel}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-[44px] flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-bold leading-none",
                    active ? "text-blue-700" : "text-slate-500"
                  )}
                >
                  <span className="relative inline-flex">
                    <item.icon className={cn("h-5 w-5", active && "fill-blue-100")} aria-hidden="true" />
                    {showBadge && (
                      <span className="absolute -right-2 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-extrabold leading-none text-white ring-2 ring-white" aria-hidden="true">
                        {absensiHarianBadge > 9 ? "9+" : absensiHarianBadge}
                      </span>
                    )}
                  </span>
                  <span className="truncate px-0.5 text-center">{item.shortLabel}</span>
                </Link>
              );
            })}
          </nav>
        );
      })()}
    </div>
  );
}
