import { AlertTriangle, CheckCircle2, Info, Square, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Alert/Notice bersama tiga rumah — warna SEMANTIK tetap, tidak mengikuti
// aksen workspace. variant "destructive" memakai role="alert";
// variant lain role="status" (pengumuman pasif).

const VARSI: Record<
  string,
  { kotak: string; ikon: string; Ikon: LucideIcon }
> = {
  info: { kotak: "border-blue-200 bg-blue-50 text-blue-800", ikon: "text-blue-600", Ikon: Info },
  success: { kotak: "border-emerald-200 bg-emerald-50 text-emerald-800", ikon: "text-emerald-600", Ikon: CheckCircle2 },
  warning: { kotak: "border-amber-200 bg-amber-50 text-amber-800", ikon: "text-amber-600", Ikon: AlertTriangle },
  destructive: { kotak: "border-rose-200 bg-rose-50 text-rose-800", ikon: "text-rose-600", Ikon: XCircle },
  neutral: { kotak: "border-[hsl(var(--card-border))] bg-slate-50 text-slate-600", ikon: "text-slate-400", Ikon: Square },
};

export default function Alert({
  variant = "info",
  title,
  children,
  className,
}: {
  variant?: keyof typeof VARSI;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const v = VARSI[variant] ?? VARSI.info;
  return (
    <div
      role={variant === "destructive" ? "alert" : "status"}
      aria-live={variant === "destructive" ? "assertive" : "polite"}
      className={cn("flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-xs font-semibold leading-relaxed", v.kotak, className)}
    >
      <v.Ikon className={cn("mt-0.5 h-4 w-4 shrink-0", v.ikon)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-extrabold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "font-semibold")}>{children}</div>}
      </div>
    </div>
  );
}
