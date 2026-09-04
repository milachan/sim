import Link from "next/link";
import { ArrowLeft, Hammer } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Placeholder halaman Rumah Administrasi yang belum diimplementasikan.
// Murni visual: judul, deskripsi, icon, status "Dalam pengembangan",
// daftar fungsi mendatang, dan navigasi kembali — tanpa tombol palsu.

export default function HalamanPlaceholder({
  judul,
  deskripsi,
  ikon: Ikon,
  fiturMendatang,
  kembaliHref,
  kembaliLabel,
}: {
  judul: string;
  deskripsi: string;
  ikon: LucideIcon;
  fiturMendatang: string[];
  kembaliHref: string;
  kembaliLabel: string;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        href={kembaliHref}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-1 text-sm font-bold text-slate-600 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Kembali ke {kembaliLabel}
      </Link>

      <section className="card card-pad fade-up">
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200">
            <Ikon className="h-6 w-6" aria-hidden="true" />
          </span>
          <span className="chip bg-amber-100 font-bold text-amber-700">
            <Hammer className="h-3.5 w-3.5" aria-hidden="true" />
            Dalam pengembangan
          </span>
        </div>
        <h1 className="mt-4 text-lg font-extrabold text-slate-900 sm:text-xl">{judul}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{deskripsi}</p>

        <h2 className="mt-5 text-xs font-extrabold uppercase tracking-widest text-slate-400">Yang akan tersedia</h2>
        <ul className="mt-2 space-y-2">
          {fiturMendatang.map((f) => (
            <li key={f} className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
              <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <p className="mt-5 border-t border-slate-100 pt-3 text-xs text-slate-400">
          Halaman ini masih berupa kerangka. Konten fungsional menyusul pada tahap pengembangan berikutnya.
        </p>
      </section>
    </div>
  );
}
