import { CalendarDays, Clock } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Card } from "@/components/ui";
import { cn, formatJam } from "@/lib/utils";

/**
 * Bar informasi Hari/Tanggal/Jam (WIB) — satu baris ringkas untuk layar HP,
 * dipakai seragam di beranda semua role.
 */
export default function InfoWaktu({ className = "mt-4" }: { className?: string }) {
  const sekarang = new Date();
  return (
    <Card className={cn("flex items-center gap-x-2 overflow-hidden px-4 py-2.5 sm:px-5", className)}>
      <CalendarDays className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">
        {format(sekarang, "EEEE, d MMMM yyyy", { locale: localeId })}
      </p>
      <span className="shrink-0 text-slate-300" aria-hidden="true">
        ·
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <Clock className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        <span className="font-mono text-sm font-bold tabular-nums text-slate-900">{formatJam(sekarang)}</span>
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">WIB</span>
      </span>
    </Card>
  );
}
