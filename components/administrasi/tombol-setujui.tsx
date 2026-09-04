"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { setujuiDokumen } from "@/lib/actions/dokumen";
import { formatUkuran } from "@/lib/administrasi/upload-helpers";
import KonfirmasiDuaLangkah from "./konfirmasi-dua-langkah";

// Tombol Setujui dengan tinjauan dua langkah di dalam UI.
// Server action setujuiDokumen tidak diubah — hanya menerima id dokumen.

export default function TombolSetujui({
  id,
  ringkasan,
}: {
  id: string;
  ringkasan: { judul: string; jenisLabel: string; pengajuNama: string; namaFile: string; ukuran: number | null };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [sukses, setSukses] = useState(false);

  return (
    <div>
      <KonfirmasiDuaLangkah
        labelTombol="Tinjau Persetujuan"
        ikon={CheckCircle2}
        tonal="emerald"
        judulTinjau="Tinjau Persetujuan"
        deskripsiTinjau="Periksa ringkasan berikut sebelum menyetujui dokumen."
        labelKonfirmasi="Ya, Setujui"
        pendingLabel="Menyetujui…"
        pending={pending}
        error={err}
        onKonfirmasi={() => {
          setErr(null);
          start(async () => {
            try {
              await setujuiDokumen(id);
              setSukses(true);
              router.refresh();
            } catch (ex: unknown) {
              setErr(ex instanceof Error ? ex.message : "Gagal menyetujui dokumen.");
            }
          });
        }}
      >
        <dl className="mt-3 space-y-1.5 rounded-xl bg-white px-3 py-2.5 text-xs">
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 font-semibold text-slate-500">Dokumen</dt>
            <dd className="min-w-0 flex-1 break-words font-bold text-slate-900">{ringkasan.judul}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 font-semibold text-slate-500">Jenis</dt>
            <dd className="flex-1 text-slate-700">{ringkasan.jenisLabel}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 font-semibold text-slate-500">Pengaju</dt>
            <dd className="min-w-0 flex-1 truncate text-slate-700">{ringkasan.pengajuNama}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 font-semibold text-slate-500">File</dt>
            <dd className="min-w-0 flex-1 break-words text-slate-700">
              {ringkasan.namaFile}
              {ringkasan.ukuran != null && <span className="text-slate-400"> · {formatUkuran(ringkasan.ukuran)}</span>}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          Setelah disetujui, dokumen masuk daftar menunggu finalisasi. Pengaju tidak dapat mengubah dokumen lagi.
        </p>
      </KonfirmasiDuaLangkah>

      <p role="status" aria-live="polite" className={sukses ? "mt-2 text-xs font-semibold text-emerald-700" : "sr-only"}>
        {sukses ? "Dokumen berhasil disetujui." : ""}
      </p>
    </div>
  );
}
