import Link from "next/link";
import { Download, FileCheck2, Hash, KeyRound, User } from "lucide-react";
import { STATUS_DOKUMEN_BADGE, STATUS_DOKUMEN_LABEL } from "@/lib/dokumen-validasi";
import { formatUkuran, labelMime, potongHash } from "@/lib/administrasi/upload-helpers";
import { formatKodeVerifikasi } from "@/lib/administrasi/finalisasi";
import { cn, formatTanggal } from "@/lib/utils";
import type { StatusDokumen } from "@prisma/client";

// Kartu arsip dokumen final — metadata aman saja (tanpa storage key / ID internal).

export default function KartuArsip({
  href,
  unduhHref,
  judul,
  jenisLabel,
  status,
  pengajuNama,
  nomorVersi,
  namaFile,
  mime,
  ukuran,
  sha256,
  kodeVerifikasi,
  difinalkanPada,
  finalisatorNama,
}: {
  href: string;
  unduhHref: string;
  judul: string;
  jenisLabel: string;
  status: StatusDokumen;
  pengajuNama?: string | null;
  nomorVersi: number;
  namaFile: string | null;
  mime: string | null;
  ukuran: number | null;
  sha256: string | null;
  kodeVerifikasi: string;
  difinalkanPada: Date | string;
  finalisatorNama: string | null;
}) {
  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <h2 className="line-clamp-2 min-w-0 break-words text-sm font-bold leading-snug text-slate-900">
          <Link href={href} className="transition-colors hover:text-blue-800">
            {judul}
          </Link>
        </h2>
        <span className={cn("chip shrink-0", STATUS_DOKUMEN_BADGE[status])}>{STATUS_DOKUMEN_LABEL[status]}</span>
      </div>

      <p className="mt-1 truncate text-xs font-semibold text-slate-500">{jenisLabel}</p>

      <dl className="mt-3 space-y-1.5 rounded-xl bg-slate-50 px-3 py-2.5 text-xs">
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          <dt className="w-28 shrink-0 font-semibold text-slate-500">Versi final</dt>
          <dd className="min-w-0 flex-1 truncate font-bold text-slate-800">
            v{nomorVersi}
            {namaFile && <span className="font-normal text-slate-500"> · {namaFile}</span>}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          <dt className="w-28 shrink-0 font-semibold text-slate-500">Format</dt>
          <dd className="min-w-0 flex-1 text-slate-600">
            {labelMime(mime)}
            {ukuran != null && <span> · {formatUkuran(ukuran)}</span>}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          <dt className="w-28 shrink-0 font-semibold text-slate-500">Difinalkan</dt>
          <dd className="min-w-0 flex-1 text-slate-600">
            {formatTanggal(difinalkanPada)}
            {finalisatorNama && <span className="text-slate-400"> · oleh {finalisatorNama}</span>}
          </dd>
        </div>
        {pengajuNama && (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            <dt className="w-28 shrink-0 font-semibold text-slate-500">Pengaju</dt>
            <dd className="inline-flex min-w-0 flex-1 items-center gap-1 text-slate-600">
              <User className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{pengajuNama}</span>
            </dd>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <dt className="inline-flex w-28 shrink-0 items-center gap-1 font-semibold text-slate-500">
            <Hash className="h-3 w-3" aria-hidden="true" />
            Checksum
          </dt>
          <dd className="min-w-0 flex-1 break-all font-mono text-[11px] text-slate-500">sha256:{potongHash(sha256, 16)}</dd>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <dt className="inline-flex w-28 shrink-0 items-center gap-1 font-semibold text-slate-500">
            <KeyRound className="h-3 w-3" aria-hidden="true" />
            Kode
          </dt>
          <dd className="min-w-0 flex-1">
            <code className="break-all rounded-lg bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wider text-emerald-700 ring-1 ring-inset ring-emerald-200">
              {formatKodeVerifikasi(kodeVerifikasi)}
            </code>
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <Link
          href={href}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <FileCheck2 className="h-4 w-4" aria-hidden="true" />
          Buka Detail
        </Link>
        <a
          href={unduhHref}
          aria-label={`Unduh file final ${judul}`}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Unduh
        </a>
      </div>
    </article>
  );
}
