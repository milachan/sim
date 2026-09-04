import type { LucideIcon } from "lucide-react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// EmptyState bersama tiga rumah.
// variant "success" = positif (semua tugas beres), "filter" = hasil kosong,
// "default" = belum ada data.

export default function EmptyState({
  icon: Ikon,
  title,
  description,
  action,
  variant = "default",
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "filter" | "success";
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--card-radius)] border border-dashed bg-[hsl(var(--card-bg))] p-8 text-center",
        variant === "success" ? "border-emerald-200" : "border-slate-300"
      )}
    >
      <span
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ring-inset",
          variant === "success"
            ? "bg-emerald-50 text-emerald-600 ring-emerald-200"
            : variant === "filter"
              ? "bg-slate-50 text-slate-400 ring-slate-200"
              : "bg-accent-soft text-accent-foreground ring-accent-border"
        )}
      >
        {variant === "success" && !Ikon ? <CheckCircle2 className="h-6 w-6" aria-hidden="true" /> : <Ikon className="h-6 w-6" aria-hidden="true" />}
      </span>
      <p className="mt-3 text-sm font-bold text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{description}</p>}
      {action && <div className="mt-4 flex min-h-[44px] items-center">{action}</div>}
    </div>
  );
}
