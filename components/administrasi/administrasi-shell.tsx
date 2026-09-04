"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FolderOpen, Menu, X } from "lucide-react";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { ROLE_BADGE, ROLE_LABEL } from "@/lib/constants";
import { alamatRumahJurnal } from "@/lib/workspace-config";
import { getAdministrasiBottomNav, getAdministrasiNav, isNavAktif } from "@/lib/administrasi/nav-config";
import TombolNotifikasi from "./tombol-notifikasi";
import WorkspaceSwitcher from "@/components/workspace-switcher";
import TombolKembali from "@/components/ds/tombol-kembali";

// Shell milik Rumah Administrasi — TERPISAH dari sidebar jurnal
// (components/app-shell.tsx tidak digunakan sama sekali di rumah ini).
// data-workspace="administrasi" mengaktifkan aksen amber via design token.
// Desktop: sidebar tetap 256px (token --shell-sidebar-w). Mobile:
// header sticky + drawer + bottom nav.

type UserShell = { nama: string; username: string; role: Role };

function inisial(nama: string): string {
  return nama
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((k) => k[0]?.toUpperCase() ?? "")
    .join("");
}

function IsiNavigasi({
  role,
  pathname,
  onPilih,
}: {
  role: Role;
  pathname: string;
  onPilih?: () => void;
}) {
  const kelompok = getAdministrasiNav(role);
  return (
    <nav aria-label="Navigasi Rumah Administrasi" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {kelompok.map((g) => (
        <div key={g.label}>
          <p className="px-2.5 pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">{g.label}</p>
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const aktif = isNavAktif(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onPilih}
                    aria-current={aktif ? "page" : undefined}
                    className={cn(
                      "relative flex min-h-[44px] items-center gap-2.5 rounded-xl px-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2",
                      aktif ? "bg-accent-soft font-bold text-accent-foreground" : "font-semibold text-slate-600 hover:bg-[hsl(var(--nav-hover-bg))] hover:text-slate-900"
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn("absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full", aktif ? "bg-accent" : "bg-transparent")}
                    />
                    <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function PanelIdentitas({ aksi }: { aksi?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 px-4 pt-4">
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-foreground ring-1 ring-inset ring-accent-border">
          <FolderOpen className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-extrabold leading-tight text-slate-900">Rumah Administrasi</span>
          <span className="block truncate text-[10px] font-semibold uppercase tracking-widest text-accent-foreground/80">Administrasi Madrasah</span>
        </span>
      </span>
      {aksi}
    </div>
  );
}

function AreaProfil({ user }: { user: UserShell }) {
  const rumahUtama = alamatRumahJurnal(user.role);
  return (
    <div className="space-y-2.5 border-t border-slate-100 px-3 py-3">
      <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-2.5 py-2">
        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-extrabold text-slate-700">
          {inisial(user.nama)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-bold text-slate-900">{user.nama}</span>
          <span className="mt-0.5 block">
            <span className={cn("chip !px-1.5 !py-0.5 text-[10px]", ROLE_BADGE[user.role])}>{ROLE_LABEL[user.role]}</span>
          </span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <WorkspaceSwitcher role={user.role} />
        {/* Tombol bertulisan "Rumah Jurnal" harus SELALU ke rumah jurnal,
            bukan berganti menjadi router.back() — fallbackHref memaksa mode href. */}
        <TombolKembali
          fallbackHref={rumahUtama}
          label="Rumah Jurnal"
          tampilkanLabel="always"
          kunciLabel
          ariaLabel="Kembali ke rumah jurnal"
          className="flex-1 border border-slate-200 px-2 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-500"
        />
      </div>
    </div>
  );
}

export default function AdministrasiShell({
  user,
  jumlahNotifikasiBelum,
  children,
}: {
  user: UserShell;
  /** Angka unread dari server — bukan data mentah notifikasi. */
  jumlahNotifikasiBelum: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/administrasi";
  const [drawerTerbuka, setDrawerTerbuka] = useState(false);
  const tombolTutupRef = useRef<HTMLButtonElement>(null);
  const bottomNav = getAdministrasiBottomNav(user.role);

  useEffect(() => {
    setDrawerTerbuka(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerTerbuka) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerTerbuka(false);
    };
    document.addEventListener("keydown", escape);
    document.body.style.overflow = "hidden";
    tombolTutupRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", escape);
      document.body.style.overflow = "";
    };
  }, [drawerTerbuka]);

  const tutupDrawer = useCallback(() => setDrawerTerbuka(false), []);

  return (
    <div data-workspace="administrasi" className="min-h-screen bg-slate-50">
      <a
        href="#konten-administrasi"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-bold focus:text-slate-900 focus:shadow"
      >
        Lewati ke konten utama
      </a>

      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[var(--shell-sidebar-w)] flex-col border-r border-[hsl(var(--card-border))] bg-white lg:flex">
        <PanelIdentitas aksi={<TombolNotifikasi jumlah={jumlahNotifikasiBelum} className="mr-1 mt-0.5" />} />
        <IsiNavigasi role={user.role} pathname={pathname} />
        <AreaProfil user={user} />
      </aside>

      {/* Drawer mobile */}
      {drawerTerbuka && (
        <div id="drawer-administrasi" className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu navigasi Rumah Administrasi">
          <button
            type="button"
            aria-label="Tutup menu navigasi"
            onClick={tutupDrawer}
            className="absolute inset-0 h-full w-full cursor-default bg-slate-900/60"
            tabIndex={-1}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between pr-2">
              <PanelIdentitas />
              <button
                ref={tombolTutupRef}
                autoFocus
                type="button"
                onClick={tutupDrawer}
                aria-label="Tutup menu"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <IsiNavigasi role={user.role} pathname={pathname} onPilih={tutupDrawer} />
            <AreaProfil user={user} />
          </div>
        </div>
      )}

      {/* Kolom konten */}
      <div className="flex min-h-screen flex-col lg:pl-[var(--shell-sidebar-w)]">
        {/* Header mobile */}
        <header className="sticky top-0 z-40 border-b border-[hsl(var(--card-border))] bg-white/95 shadow-sm backdrop-blur lg:hidden">
          <div className="flex min-h-[var(--shell-header-h)] items-center gap-1.5 px-3 py-2 sm:px-6">
            <button
              type="button"
              onClick={() => setDrawerTerbuka(true)}
              aria-label="Buka menu navigasi"
              aria-expanded={drawerTerbuka}
              aria-controls="drawer-administrasi"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <TombolKembali
              rumahHref={alamatRumahJurnal(user.role)}
              className="w-11 text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-500"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold text-slate-900">Rumah Administrasi</p>
              <p className="truncate text-[11px] text-slate-500">{user.nama}</p>
            </div>
            <TombolNotifikasi jumlah={jumlahNotifikasiBelum} />
            <WorkspaceSwitcher role={user.role} />
          </div>
        </header>

        <main id="konten-administrasi" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-5 sm:px-6 lg:pb-8">
          {children}
        </main>

        <footer className="border-t border-[hsl(var(--card-border))] bg-white py-3 text-center text-[11px] text-slate-400">
          Rumah Administrasi — terpisah dari rumah Jurnal
        </footer>

        {/* Bottom navigation mobile */}
        <nav
          aria-label="Navigasi bawah Rumah Administrasi"
          className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-[hsl(var(--card-border))] bg-white/95 backdrop-blur lg:hidden"
        >
          <ul className="grid" style={{ gridTemplateColumns: `repeat(${bottomNav.length}, minmax(0, 1fr))` }}>
            {bottomNav.map((item) => {
              const aktif = isNavAktif(pathname, item.href);
              return (
                <li key={item.href} className="relative">
                  {aktif && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-3 top-0 h-0.5 rounded-b-full bg-accent"
                    />
                  )}
                  <Link
                    href={item.href}
                    aria-current={aktif ? "page" : undefined}
                    className={cn(
                      "flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 pt-1.5 text-[10px] font-bold",
                      aktif ? "text-accent-foreground" : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                    <span className="max-w-full truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
