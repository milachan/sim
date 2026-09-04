import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// PageHeader bersama tiga rumah — aksen mengikuti workspace token
// (data-workspace shell), bukan warna status. Responsif: actions
// turun ke baris berikutnya di mobile.

export default function PageHeader({
  title,
  subtitle,
  icon: Ikon,
  actions,
  eyebrow,
  breadcrumb,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  eyebrow?: string;
  /** Item breadcrumb; item terakhir otomatis aria-current="page". */
  breadcrumb?: { href?: string; label: string }[];
  className?: string;
}) {
  return (
    <section
      className={cn("rounded-[var(--card-radius)] border border-[hsl(var(--card-border)/0.8)] bg-[hsl(var(--card-bg))] p-5 shadow-[var(--card-shadow)] sm:p-6", className)}
    >
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-3 flex min-h-[28px] flex-wrap items-center gap-1 text-sm font-bold text-slate-500">
          {breadcrumb.map((item, i) => {
            const last = i === breadcrumb!.length - 1;
            return (
              <span key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1">
                {i > 0 && <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />}
                {item.href && !last ? (
                  <Link href={item.href} className="min-w-0 truncate rounded px-1 transition-colors hover:text-slate-900">
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current={last ? "page" : undefined} className={cn("min-w-0 truncate px-1", last && "text-slate-900")}>
                    {item.label}
                  </span>
                )}
              </span>
            );
          })}
        </nav>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {Ikon && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-foreground ring-1 ring-inset ring-accent-border">
              <Ikon className="h-5 w-5" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-accent-foreground/80">{eyebrow}</p>
            )}
            <h1 className="break-words text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
            {subtitle && <p className="mt-1 max-w-2xl break-words text-sm leading-relaxed text-slate-500">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </section>
  );
}
