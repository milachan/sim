import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// StatCard bersama tiga rumah. Tone SEMANTIK (bukan warna identitas rumah):
// slate netral, blue proses/info, emerald sukses, amber perhatian,
// violet data khusus, rose bahaya.

const TONE_RING: Record<string, string> = {
  slate: "bg-slate-100 text-slate-600",
  blue: "bg-blue-100 text-blue-700",
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  violet: "bg-violet-100 text-violet-700",
  rose: "bg-rose-100 text-rose-700",
};

export type ToneStat = keyof typeof TONE_RING;

export default function StatCard({
  label,
  value,
  description,
  icon: Ikon,
  tone = "slate",
  href,
}: {
  label: string;
  value: number | string | React.ReactNode;
  description?: string;
  icon: LucideIcon;
  tone?: ToneStat;
  /** Bila diberikan, seluruh kartu menjadi tautan (target sentuh >= 44px). */
  href?: string;
}) {
  const isi = (
    <>
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-black/5", TONE_RING[tone])}>
        <Ikon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-2xl font-extrabold leading-tight text-slate-900">{value}</span>
        <span className="block truncate text-xs font-semibold text-slate-500">{label}</span>
        {description && <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-400">{description}</span>}
      </span>
    </>
  );

  const kelas = cn(
    "flex items-center gap-3 rounded-[var(--card-radius)] border border-[hsl(var(--card-border)/0.8)] bg-[hsl(var(--card-bg))] p-4 shadow-[var(--card-shadow)]",
    href && "min-h-[44px] transition hover:border-slate-300 hover:shadow-[var(--p-shadow-topbar)]"
  );

  if (href) {
    return (
      <Link href={href} className={kelas}>
        {isi}
      </Link>
    );
  }
  return <div className={kelas}>{isi}</div>;
}
