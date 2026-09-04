import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// SectionHeader bersama — judul kelompok konten + aksi opsional (mis. "Lihat semua").

export default function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: { href: string; label: ReactNode };
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[44px] flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 pb-2", className)}>
      <div className="min-w-0">
        <h2 className="text-xs font-extrabold uppercase tracking-widest text-slate-400">{title}</h2>
        {description && <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400">{description}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="inline-flex min-h-[44px] items-center gap-1 text-xs font-bold text-blue-700 transition-colors hover:text-blue-900 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
