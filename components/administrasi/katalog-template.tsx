"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  ClipboardList,
  FilePlus2,
  FileText,
  Search,
  SearchX,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { filterKatalogTemplate, type ItemKatalogTemplate } from "@/lib/administrasi/arsip";

// Katalog Template Dokumen — memfilter konfigurasi nyata dari server
// (berasal dari JENIS_DOKUMEN_LABEL). Belum ada file template: tanpa tombol unduh.

const IKON: Record<string, LucideIcon> = {
  "file-plus": FilePlus2,
  "book-open": BookOpen,
  "clipboard-list": ClipboardList,
  "file-text": FileText,
};

export default function KatalogTemplate({ katalog }: { katalog: ItemKatalogTemplate[] }) {
  const [q, setQ] = useState("");
  const hasil = useMemo(() => filterKatalogTemplate(katalog, q), [katalog, q]);

  return (
    <section aria-label="Katalog jenis dokumen" className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <label htmlFor="cari-template" className="sr-only">
          Cari jenis dokumen
        </label>
        <input
          id="cari-template"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari jenis dokumen…"
          autoComplete="off"
          className="input pl-9"
        />
      </div>

      <p role="status" aria-live="polite" className="px-1 text-xs text-slate-500">
        {q.trim() ? `${hasil.length} jenis cocok dengan pencarian` : `${katalog.length} jenis dokumen dikenali sistem`}
      </p>

      {hasil.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-inset ring-slate-200">
            <SearchX className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm font-bold text-slate-900">Jenis dokumen tidak ditemukan</p>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
            Tidak ada jenis dokumen yang cocok dengan “{q.trim()}”. Coba kata kunci lain.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {hasil.map((k) => {
            const Ikon = IKON[k.ikon] ?? FileText;
            return (
              <li key={k.jenis} className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200">
                    <Ikon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-sm font-bold text-slate-900">{k.label}</h2>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{k.deskripsi}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
                    Template belum tersedia
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">Segera dari admin madrasah</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
