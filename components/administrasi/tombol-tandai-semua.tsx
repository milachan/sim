"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2 } from "lucide-react";
import { tandaiSemuaNotifikasiSaya } from "@/lib/actions/notifikasi";

// Tombol Tandai Semua Dibaca — server hanya merender tombol saat unread > 0
// (komponen tetap dirender sebagai live region kosong saat nol).
// Pending: disabled + label berubah; hasil diumumkan via aria-live yang
// STABIL (tidak ikut unmount saat router.refresh menghapus tombol);
// router.refresh menyegarkan angka badge & daftar setelah selesai.

export default function TombolTandaiSemua({ jumlah }: { jumlah: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pesan, setPesan] = useState<string | null>(null);

  const areaStatus = (
    <p role="status" aria-live="polite" className={pesan ? "text-xs font-bold text-emerald-700" : "sr-only"}>
      {pesan ?? ""}
    </p>
  );

  if (jumlah <= 0) {
    return <div className="flex flex-col items-start gap-1 sm:items-end">{areaStatus}</div>;
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setPesan(null);
          start(async () => {
            try {
              const r = await tandaiSemuaNotifikasiSaya();
              setPesan(`${r.jumlah} notifikasi ditandai sudah dibaca.`);
              router.refresh();
            } catch {
              setPesan("Gagal menandai notifikasi. Coba lagi.");
            }
          });
        }}
        className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-[hsl(var(--card-bg))] px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <CheckCheck className="h-4 w-4" aria-hidden="true" />
        )}
        {pending ? "Menandai…" : "Tandai Semua Dibaca"}
      </button>
      {areaStatus}
    </div>
  );
}
