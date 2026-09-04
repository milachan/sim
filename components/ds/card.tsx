import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Card bersama tiga rumah — memakai component token (--card-*).
// variant "interactive" WAJIB dipakai bersama href (kartu jadi link).

type CardVariant = "default" | "outline" | "interactive" | "elevated";

const VARSI_KELAS: Record<CardVariant, string> = {
  default: "border border-[hsl(var(--card-border)/0.8)] bg-[hsl(var(--card-bg))] shadow-[var(--card-shadow)]",
  outline: "border border-[hsl(var(--card-border))] bg-[hsl(var(--card-bg))]",
  interactive:
    "border border-[hsl(var(--card-border)/0.8)] bg-[hsl(var(--card-bg))] shadow-[var(--card-shadow)] transition hover:border-accent-border hover:shadow-[var(--p-shadow-topbar)]",
  elevated: "border border-[hsl(var(--card-border)/0.6)] bg-[hsl(var(--card-bg))] shadow-[0_20px_48px_-28px_rgba(15,23,42,0.45)]",
};

const PADDING: Record<string, string> = {
  none: "",
  sm: "p-3 sm:p-4",
  md: "p-4 sm:p-5",
  lg: "p-5 sm:p-6",
};

function kelasDalam(variant: CardVariant, padding: keyof typeof PADDING, className?: string) {
  return cn("rounded-[var(--card-radius)]", VARSI_KELAS[variant], PADDING[padding], className);
}

export default function Card({
  variant = "default",
  padding = "md",
  href,
  ariaLabel,
  className,
  children,
}: {
  variant?: CardVariant;
  padding?: keyof typeof PADDING;
  /** Wajib untuk variant "interactive" — kartu menjadi tautan utuh. */
  href?: string;
  ariaLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  if (variant === "interactive") {
    if (!href) {
      // Mencegah kartu interaktif mati (lihat-lihat tanpa aksi).
      throw new Error('Card variant "interactive" memerlukan href.');
    }
    return (
      <Link href={href} aria-label={ariaLabel} className={cn(kelasDalam(variant, padding, className), "block min-h-[44px]")}>
        {children}
      </Link>
    );
  }
  return (
    <div className={kelasDalam(variant, padding, className)} aria-label={ariaLabel}>
      {children}
    </div>
  );
}

/** Header bagian dalam card — judul + deskripsi opsional. */
export function CardHeader({ title, description, className }: { title: ReactNode; description?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <h2 className="text-sm font-extrabold text-slate-900">{title}</h2>
      {description && <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>}
    </div>
  );
}
