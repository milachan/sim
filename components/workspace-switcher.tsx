"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, LayoutGrid } from "lucide-react";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { getWorkspaces, tentukanWorkspaceAktif } from "@/lib/workspace-config";

// Pemilih aplikasi antar rumah (Jurnal / Administrasi / Analisis Nilai).
// Hanya berpindah Link — tidak menyentuh sesi sehingga tidak ada logout/login ulang.
export default function WorkspaceSwitcher({
  role,
  isAkunPiket = false,
}: {
  role: Role;
  isAkunPiket?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const wadahRef = useRef<HTMLDivElement>(null);
  const itemPertamaRef = useRef<HTMLAnchorElement>(null);

  const workspaces = getWorkspaces({ role, isAkunPiket });
  const idAktif = tentukanWorkspaceAktif(pathname, workspaces);

  useEffect(() => {
    if (!open) return;
    const tutup = (e: MouseEvent) => {
      if (wadahRef.current && !wadahRef.current.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", tutup);
    document.addEventListener("keydown", escape);
    itemPertamaRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", tutup);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div ref={wadahRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Pilih aplikasi"
        className={cn(
          "inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2",
          open ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
        )}
      >
        <LayoutGrid className="h-4 w-4" aria-hidden="true" />
        <span>Aplikasi</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Daftar aplikasi"
          className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        >
          <p className="border-b border-slate-100 px-4 py-2 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
            Pindah rumah
          </p>
          <div className="p-1.5">
            {workspaces.map((w, i) => {
              const aktif = w.id === idAktif;
              return (
                <Link
                  key={w.id}
                  ref={i === 0 ? itemPertamaRef : undefined}
                  href={w.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  aria-current={aktif ? "page" : undefined}
                  className={cn(
                    "flex min-h-[44px] items-start gap-3 rounded-xl px-3 py-2.5 transition-colors focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2",
                    aktif ? "bg-slate-100" : "hover:bg-slate-50"
                  )}
                >
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${w.warnaAksen}1A`, color: w.warnaAksen }}
                  >
                    <w.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-bold text-slate-900">{w.label}</span>
                      {aktif && <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Sedang aktif" />}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{w.deskripsi}</span>
                  </span>
                </Link>
              );
            })}
          </div>
          <Link
            href="/ruang-kerja"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-100 px-4 py-2.5 text-center text-xs font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            Lihat semua aplikasi
          </Link>
        </div>
      )}
    </div>
  );
}
