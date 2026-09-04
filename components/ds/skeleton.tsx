import { cn } from "@/lib/utils";

// Skeleton bersama — reduced-motion friendly (animate-pulse dibungkus
// motion-safe; global CSS juga menonaktifkan animasi saat reduce).

export function SkeletonBar({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("rounded-full bg-slate-100 motion-safe:animate-pulse", className)} />;
}

export function SkeletonPageHeader() {
  return (
    <div className="rounded-[var(--card-radius)] border border-[hsl(var(--card-border)/0.8)] bg-[hsl(var(--card-bg))] p-5 shadow-[var(--card-shadow)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2.5">
          <SkeletonBar className="h-3 w-40" />
          <SkeletonBar className="h-6 w-64 max-w-full" />
          <SkeletonBar className="h-3 w-full max-w-md" />
        </div>
        <SkeletonBar className="h-11 w-40 shrink-0 rounded-[var(--control-radius)]" />
      </div>
    </div>
  );
}

export function SkeletonStatGrid({ jumlah = 4 }: { jumlah?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: jumlah }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-[var(--card-radius)] border border-[hsl(var(--card-border)/0.8)] bg-[hsl(var(--card-bg))] p-4 shadow-[var(--card-shadow)]">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-slate-100 motion-safe:animate-pulse" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <SkeletonBar className="h-6 w-12" />
            <SkeletonBar className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonCardGrid({ jumlah = 6 }: { jumlah?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: jumlah }).map((_, i) => (
        <div key={i} className="rounded-[var(--card-radius)] border border-[hsl(var(--card-border)/0.8)] bg-[hsl(var(--card-bg))] p-4 shadow-[var(--card-shadow)]">
          <SkeletonBar className="h-4 w-3/4" />
          <SkeletonBar className="mt-2 h-3 w-24" />
          <SkeletonBar className="mt-4 h-3 w-full" />
          <SkeletonBar className="mt-1.5 h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/** Susunan skeleton halaman standar: header + statistik + daftar. */
export default function SkeletonPage({ cards = 6 }: { cards?: number }) {
  return (
    <div className="space-y-6" role="status" aria-label="Memuat halaman">
      <span className="sr-only">Memuat…</span>
      <SkeletonPageHeader />
      <SkeletonStatGrid />
      <SkeletonCardGrid jumlah={cards} />
    </div>
  );
}
