import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatJumlahBadge } from "@/lib/administrasi/notifikasi-ui";

// Tombol lonceng pusat notifikasi Rumah Administrasi — Link penuh ke
// /administrasi/notifikasi (tanpa dropdown/popover pada milestone ini).
// Target sentuh 44px (h-11 w-11). aria-label selalu menyebut jumlah unread;
// badge hanya tampil saat 1–99 ("1".."99") atau ≥100 ("99+").

export default function TombolNotifikasi({ jumlah, className }: { jumlah: number; className?: string }) {
  const badge = formatJumlahBadge(jumlah);
  const label =
    jumlah > 0
      ? `Notifikasi: ${jumlah} belum dibaca`
      : "Notifikasi: tidak ada yang belum dibaca";

  return (
    <Link
      href="/administrasi/notifikasi"
      aria-label={label}
      className={cn(
        "relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2",
        className
      )}
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {badge !== null && (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-accent px-1 py-px text-[10px] font-extrabold leading-[14px] text-white ring-2 ring-white"
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
