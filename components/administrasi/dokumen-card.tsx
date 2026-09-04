import Link from "next/link";
import { Clock3, GitBranch, User } from "lucide-react";
import type { StatusDokumen } from "@prisma/client";
import { JENIS_DOKUMEN_LABEL, STATUS_DOKUMEN_BADGE, STATUS_DOKUMEN_LABEL } from "@/lib/dokumen-validasi";
import { indikatorStatus } from "@/lib/administrasi/dashboard";
import { cn, formatTanggal } from "@/lib/utils";

// Kartu dokumen untuk daftar (Dashboard / Dokumen Saya).
// Teks panjang dibatasi line-clamp agar tidak merusak layout;
// seluruh kartu adalah link dengan target sentuh >= 44px.

const INDIKATOR_TONAL = {
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
} as const;

export default function DokumenCard({
  href,
  judul,
  jenis,
  status,
  ringkasan,
  versiAktif,
  updatedAt,
  catatan,
  pengajuNama,
  labelAksi,
  metaTambahan,
}: {
  href: string;
  judul: string;
  jenis: string;
  status: StatusDokumen;
  ringkasan?: string | null;
  versiAktif?: number | null;
  updatedAt: Date | string;
  catatan?: string | null;
  pengajuNama?: string | null;
  /** Override indikator default (mis. "Perlu tindakan" di kotak masuk). */
  labelAksi?: string | null;
  /** Teks meta tambahan (mis. "menunggu 3 hari"). */
  metaTambahan?: string | null;
}) {
  const indikator = labelAksi !== undefined ? (labelAksi ? { label: labelAksi, tonal: "blue" as const } : null) : indikatorStatus(status);
  const jenisLabel = jenis in JENIS_DOKUMEN_LABEL ? JENIS_DOKUMEN_LABEL[jenis as keyof typeof JENIS_DOKUMEN_LABEL] : jenis;
  return (
    <Link
      href={href}
      className="flex min-h-[44px] flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-amber-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="line-clamp-2 min-w-0 break-words text-sm font-bold leading-snug text-slate-900">{judul}</h2>
        <span className={cn("chip shrink-0", STATUS_DOKUMEN_BADGE[status])}>{STATUS_DOKUMEN_LABEL[status]}</span>
      </div>

      <p className="mt-1 truncate text-xs font-semibold text-slate-500">{jenisLabel}</p>

      {ringkasan && <p className="mt-2 line-clamp-2 break-words text-xs leading-relaxed text-slate-600">{ringkasan}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-slate-100 pt-2.5">
        {pengajuNama && (
          <span className="inline-flex min-w-0 max-w-full items-center gap-1 text-[11px] font-semibold text-slate-500">
            <User className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{pengajuNama}</span>
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
          {formatTanggal(updatedAt)}
        </span>
        {metaTambahan && <span className="text-[11px] font-semibold text-slate-400">· {metaTambahan}</span>}
        {typeof versiAktif === "number" && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
            <GitBranch className="h-3.5 w-3.5 rotate-90" aria-hidden="true" />
            Versi {versiAktif}
          </span>
        )}
        {catatan && <span className="min-w-0 truncate text-[11px] font-semibold text-slate-400">{catatan}</span>}
      </div>

      {indikator && (
        <p
          className={cn(
            "mt-2.5 inline-flex w-fit items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset",
            INDIKATOR_TONAL[indikator.tonal]
          )}
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
          {indikator.label}
        </p>
      )}
    </Link>
  );
}
