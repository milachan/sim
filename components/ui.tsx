"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { useRef, type ReactNode } from "react";
import { ChevronRight, Inbox } from "lucide-react";
import { usePushToast } from "@/components/ds/toast";

export { LegacyPageHeader as PageHeader } from "@/components/ds/legacy-page-header";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("card", className)}>{children}</div>;
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("chip", className)}>{children}</span>;
}

export function StatCard({
  label,
  value,
  sub,
  color = "bg-blue-700",
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  color?: string;
  icon?: ReactNode;
}) {
  return (
    <Card className="relative flex h-full flex-col overflow-hidden">
      <div className={cn("absolute inset-x-0 top-0 h-1", color)} aria-hidden="true" />
      <div className="flex flex-1 items-start justify-between gap-2 p-4 pt-5 sm:p-5 sm:pt-6">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-600">{label}</p>
          <p className="mt-1.5 break-words text-[1.5rem] font-extrabold tracking-tight text-slate-950 sm:text-3xl">{value}</p>
          {sub && <p className="mt-1 line-clamp-2 break-words text-xs leading-snug text-slate-600">{sub}</p>}
        </div>
        {icon && (
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.85rem] text-white shadow-sm sm:h-11 sm:w-11", color)}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

export function Breadcrumb({
  items,
  className,
}: {
  items: { href?: string; label: string }[];
  className?: string;
}) {
  return (
    <nav aria-label="Breadcrumb" className={cn("mb-4 flex flex-wrap items-center gap-1.5 text-sm", className)}>
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden="true" />}
            {item.href && !last ? (
              <Link href={item.href} className="font-semibold text-slate-500 transition-colors hover:text-emerald-700">
                {item.label}
              </Link>
            ) : (
              <span className={cn(last ? "font-bold text-slate-800" : "text-slate-400")} aria-current={last ? "page" : undefined}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export function EmptyState({
  title,
  desc,
  action,
}: {
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[1.15rem] border border-dashed border-slate-300 bg-slate-50/70 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
        <Inbox className="h-7 w-7" />
      </div>
      <p className="mt-4 font-bold text-slate-800">{title}</p>
      {desc && <p className="mt-1 max-w-sm text-sm leading-5 text-slate-600">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function TableShell({ children, minWidth = "560px", hint = true }: { children: ReactNode; minWidth?: string; hint?: boolean }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="w-full border-collapse" style={{ minWidth }}>{children}</table>
      </div>
      {hint && <p className="border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-[11px] font-semibold text-slate-500 sm:hidden">Geser untuk melihat kolom lain →</p>}
    </div>
  );
}

export function TableRow({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn("border-t border-slate-100 transition-colors hover:bg-blue-50/45", className)}>{children}</tr>;
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("th whitespace-nowrap bg-slate-50/90", className)}>{children}</th>;
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("td", className)}>{children}</td>;
}

export function InfoRow({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:py-2.5">
      <span className="shrink-0 text-sm font-medium text-slate-500">{label}</span>
      <span className={cn("min-w-0 flex flex-wrap items-center justify-start gap-1.5 break-words text-sm sm:justify-end", strong ? "font-bold text-slate-900" : "font-medium text-slate-700")}>{value}</span>
    </div>
  );
}

/** Mendorong notifikasi sukses ke store toast global. Markup visual di-<render> oleh ToastHost. */
export function SuksesBanner({ message }: { message?: string | null }) {
  const ref = useRef<string | null>(null);
  usePushToast(ref, "success", message);
  return null;
}

/** Mendorong notifikasi kesalahan ke store toast global. Markup visual di-<render> oleh ToastHost. */
export function ErrorBanner({ message }: { message?: string | null }) {
  const ref = useRef<string | null>(null);
  usePushToast(ref, "error", message);
  return null;
}

export function HalamanError({ message }: { message: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600" aria-hidden="true">
        <span className="text-2xl font-black">!</span>
      </div>
      <h1 className="mt-3 text-lg font-bold text-slate-800">{message}</h1>
      <a href="/" className="btn-secondary mt-4">
        Kembali ke Beranda
      </a>
    </div>
  );
}
