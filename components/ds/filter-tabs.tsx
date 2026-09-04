import Link from "next/link";
import { cn } from "@/lib/utils";

// FilterTabs bersama — tab berbasis Link/searchParams.
// Active state: aria-current + teks tebal + latar + titik indikator
// (bukan warna saja). Overflow horizontal aman di mobile.

export default function FilterTabs({
  items,
  aktif,
  className,
  label = "Filter",
}: {
  items: { nilai: string; label: string; href: string }[];
  /** Nilai tab aktif (nilai dari searchParams yang sudah dinormalisasi helper). */
  aktif: string;
  className?: string;
  label?: string;
}) {
  return (
    <nav aria-label={label} className={cn("-mx-1 overflow-x-auto px-1 pb-1", className)}>
      <ul className="flex w-max min-w-full flex-wrap gap-2 sm:flex-wrap">
        {items.map((item) => {
          const tabAktif = item.nilai === aktif;
          return (
            <li key={item.nilai}>
              <Link
                href={item.href}
                aria-current={tabAktif ? "true" : undefined}
                className={cn(
                  "inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2",
                  tabAktif
                    ? "bg-accent-soft text-accent-foreground ring-1 ring-inset ring-accent-border"
                    : "border border-[hsl(var(--card-border))] bg-[hsl(var(--card-bg))] text-slate-600 hover:border-slate-300 hover:text-slate-900"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn("h-1.5 w-1.5 rounded-full", tabAktif ? "bg-accent" : "bg-transparent")}
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
