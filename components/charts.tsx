import { cn } from "@/lib/utils";

export type BarDatum = { label: string; shortLabel?: string; nilai: number; sub?: string };

export function BarChartVertikal({
  data,
  height = 160,
  color = "#059669",
  format = (v) => String(v),
  barMinW = 44,
  threshold = 6,
}: {
  data: BarDatum[];
  height?: number;
  color?: string;
  format?: (v: number) => string;
  barMinW?: number;
  threshold?: number;
}) {
  if (!data.length) {
    return <p className="py-8 text-center text-sm text-slate-400">Belum ada data</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.nilai));
  const needsScroll = data.length > threshold;
  const hint = needsScroll && "Geser grafik untuk melihat periode lainnya →";
  const innerStyle: React.CSSProperties = needsScroll
    ? { minWidth: `max(100%, ${data.length * barMinW + 8 * (data.length - 1)}px)` }
    : { minWidth: "100%" };

  return (
    <div role="img" aria-label={`Grafik batang: ${data.map((d) => `${d.shortLabel ?? d.label} ${format(d.nilai)}`).join(", ")}`}>
      <div className={needsScroll ? "overflow-x-auto overscroll-x-contain -mx-1 px-1 pb-1" : "overflow-hidden"}>
        <div style={{ ...innerStyle }}>
          <div className="flex items-end gap-1.5 sm:gap-2" style={{ height: height + 22, paddingTop: 22 }}>
            {data.map((d, i) => {
              const h = d.nilai === 0 ? 2 : Math.max(6, (d.nilai / max) * 100);
              const solid = d.nilai >= max && max > 1;
              return (
                <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end" style={needsScroll ? { minWidth: barMinW } : undefined}>
                  <span className="mb-1 text-[10px] font-extrabold leading-none text-slate-700" aria-hidden="true">
                    {format(d.nilai)}
                  </span>
                  <div className="relative flex w-full flex-1 flex-col justify-end">
                    <div
                      className={cn(
                        "w-full rounded-t-md transition-all duration-300",
                        solid ? "opacity-100" : "opacity-70"
                      )}
                      style={{
                        height: `${h}%`,
                        background: `linear-gradient(180deg, ${color}, ${color}cc)`,
                        minHeight: 3,
                      }}
                      aria-hidden="true"
                    />
                    <div className="pointer-events-none absolute left-1/2 top-0 z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-center text-[11px] font-bold text-white shadow-lg sm:group-hover:block">
                      {format(d.nilai)}
                      {d.sub && <span className="block text-[10px] font-semibold text-slate-300">{d.sub}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex gap-1.5 border-t border-slate-100 pt-1.5 sm:gap-2">
            {data.map((d, i) => (
              <div key={i} className="flex min-w-0 flex-1 flex-col items-center text-center" style={needsScroll ? { minWidth: barMinW } : undefined}>
                {(d.shortLabel ?? d.label).split("\n").slice(0, 2).map((line, li) => (
                  <span key={li} className="w-full break-words text-[10px] font-bold leading-tight text-slate-500">
                    {line}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      {hint && <p className="mt-1 text-[11px] font-semibold text-slate-500 sm:hidden">{hint}</p>}
    </div>
  );
}

export function DonutChart({
  data,
  size = 150,
}: {
  data: { label: string; nilai: number; warna: string }[];
  size?: number;
}) {
  const total = data.reduce((a, d) => a + d.nilai, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height: size }}>
        <p className="text-sm text-slate-400">Belum ada data</p>
      </div>
    );
  }

  const r = size / 2 - 6;
  const lingkar = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div role="img" aria-label={`Grafik distribusi: ${data.map((d) => `${d.label} ${d.nilai}`).join(", ")}`} className="flex max-w-full flex-col items-center gap-5 sm:flex-row sm:flex-wrap sm:justify-center">
      <div className="relative max-w-full shrink-0" style={{ width: `min(100%, ${size}px)`, height: `min(100vw - 3rem, ${size}px)` }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90 block h-full w-full" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={11} />
          {data
            .filter((d) => d.nilai > 0)
            .map((d, i) => {
              const porsi = d.nilai / total;
              const el = (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={d.warna}
                  strokeWidth={11}
                  strokeDasharray={`${porsi * lingkar} ${lingkar}`}
                  strokeDashoffset={-offset * lingkar}
                  strokeLinecap="butt"
                  className="transition-all duration-500"
                />
              );
              offset += porsi;
              return el;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold text-slate-900">{total}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">total</span>
        </div>
      </div>
      <div className="min-w-0 max-w-full space-y-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex min-w-0 items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.warna }} />
            <span className="min-w-0 flex-1 break-words font-semibold text-slate-600">{d.label}</span>
            <span className="ml-auto shrink-0 font-extrabold text-slate-800">{d.nilai}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LegendRow({ label, nilai, total, warna }: { label: string; nilai: number; total: number; warna: string }) {
  const p = total ? Math.round((nilai / total) * 100) : 0;
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: warna }} />
      <span className="min-w-0 flex-1 break-words font-semibold text-slate-600">{label}</span>
      <span className="ml-auto shrink-0 font-extrabold text-slate-800">
        {nilai} <span className="text-xs font-semibold text-slate-400">({p}%)</span>
      </span>
    </div>
  );
}
