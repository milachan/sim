"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tombol kembali generik untuk semua rumah (Jurnal, Administrasi, Analisis).
 *
 * Strategi fallback berjenjang — yang paling aman lebih dulu:
 *   1. `fallbackHref` eksplisit dari parent (mis. halaman detail tahu halaman
 *      induknya, mis. "/jurnal" untuk "/jurnal/[id]").
 *   2. `router.back()` aman jika referrer same-origin DAN ada riwayat internal.
 *      Referrer external / hash-only diabaikan agar tidak memutar ke halaman
 *      di luar aplikasi.
 *   3. `rumahHref` (rumah workspace user) sebagai jaring pengaman terakhir.
 *
 * Komponen tidak merender apa pun bila tidak ada target sama sekali — misal
 * deep link eksternal ke landing tanpa fallback. Ini menghindari tombol mati.
 */
export type TombolKembaliProps = {
  /** URL eksplisit halaman induk. Dipakai bila `router.back()` tidak aman. */
  fallbackHref?: string;
  /** URL rumah workspace user (dipakai saat referrer & history tidak tersedia). */
  rumahHref?: string;
  /** Label tombol. Default "Kembali". */
  label?: string;
  /** Tampilkan label teks (default: hanya di `sm:` ke atas). */
  tampilkanLabel?: boolean | "always";
  /**
   * Jika `true`, label yang ditampilkan selalu `label` (tidak berubah ke
   * generik "Kembali" saat mode `back`). Pakai untuk konteks di mana tombol
   * punya makna tetap, mis. "Rumah Jurnal" di sidebar profil.
   */
  kunciLabel?: boolean;
  /** Kelas tambahan untuk styling sesuai konteks shell. */
  className?: string;
  /** aria-label override. Default adalah `label`. */
  ariaLabel?: string;
};

type Mode = "back" | "href" | "rumah" | "none";

function pathFromReferrer(referrer: string): string | null {
  try {
    const url = new URL(referrer);
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}

export default function TombolKembali({
  fallbackHref,
  rumahHref,
  label = "Kembali",
  tampilkanLabel = false,
  kunciLabel = false,
  className,
  ariaLabel,
}: TombolKembaliProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<Mode>("none");

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Fallback eksplisit selalu paling aman — parent yang tahu konteksnya.
    if (fallbackHref) {
      setMode("href");
      return;
    }

    // 2. Router.back aman hanya jika referrer same-origin DAN path berbeda
    //    (mencegah memutar ke halaman yang sama, dan mencegah lompat ke situs
    //    lain).
    const refPath = pathFromReferrer(document.referrer);
    const sameOrigin = document.referrer.startsWith(window.location.origin);
    const punyaRiwayat = window.history.length > 1;
    const bukanHalamanSama = refPath !== null && refPath !== pathname;

    if (sameOrigin && punyaRiwayat && bukanHalamanSama) {
      setMode("back");
      return;
    }

    // 3. Jaring pengaman: rumah workspace user.
    if (rumahHref) {
      setMode("rumah");
      return;
    }

    setMode("none");
  }, [pathname, fallbackHref, rumahHref]);

  if (mode === "none") return null;

  const labelText = ariaLabel ?? label;
  const showText = tampilkanLabel === "always" || tampilkanLabel === true;

  const baseClass = cn(
    "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    showText ? "px-3" : "w-11",
    className
  );

  if (mode === "back") {
    function onClick(e: MouseEvent<HTMLButtonElement>) {
      e.preventDefault();
      router.back();
    }
    const textTampil = kunciLabel ? label : "Kembali";
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={kunciLabel ? labelText : "Kembali ke halaman sebelumnya"}
        title={textTampil}
        className={baseClass}
      >
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        {showText && <span className="text-xs font-bold">{textTampil}</span>}
      </button>
    );
  }

  const href = mode === "href" ? fallbackHref! : rumahHref!;
  return (
    <Link
      href={href}
      aria-label={labelText}
      title={label}
      className={baseClass}
    >
      <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      {showText && <span className="text-xs font-bold">{label}</span>}
    </Link>
  );
}
