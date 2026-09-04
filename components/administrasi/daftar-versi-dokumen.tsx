"use client";

import { Download } from "lucide-react";
import { formatUkuran, labelMime, potongHash } from "@/lib/administrasi/upload-helpers";

type VersiItem = {
  id: string;
  nomor: number;
  namaAsli: string | null;
  mime: string | null;
  ukuran: number | null;
  sha256: string | null;
  createdAt: string | Date;
};

export default function DaftarVersiDokumen({ versi, versiAktif }: { versi: VersiItem[]; versiAktif: number }) {
  if (versi.length === 0) return <p className="text-xs text-slate-500">Belum ada versi dengan file.</p>;
  return (
    <ul className="space-y-2">
      {versi.map((v) => {
        const isLatest = v.nomor === versiAktif;
        return (
          <li key={v.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">v{v.nomor}</span>
                {isLatest && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Versi terbaru</span>}
                <span className="truncate text-sm font-semibold text-slate-800">{v.namaAsli ?? "—"}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                <span>{labelMime(v.mime)}</span>
                <span>·</span>
                <span>{v.ukuran != null ? formatUkuran(v.ukuran) : "—"}</span>
                <span>·</span>
                <span>{new Date(v.createdAt).toLocaleString("id-ID")}</span>
                <span>·</span>
                <span className="font-mono text-[11px]">sha256:{potongHash(v.sha256)}</span>
              </div>
            </div>
            <a
              href={`/api/administrasi/versi/${v.id}/download`}
              aria-label={`Unduh versi ${v.nomor}`}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Unduh
            </a>
          </li>
        );
      })}
    </ul>
  );
}
