function Skeleton({ className }: { className: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-xl bg-slate-200/80 ${className}`} />;
}

export default function AppLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Memuat halaman">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-80 max-w-[70vw]" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-32" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Skeleton className="h-72 lg:col-span-3" />
        <Skeleton className="h-72 lg:col-span-2" />
      </div>
    </div>
  );
}
