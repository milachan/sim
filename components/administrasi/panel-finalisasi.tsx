"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { finalisasiDokumen } from "@/lib/actions/dokumen";
import { formatUkuran, labelMime, potongHash } from "@/lib/administrasi/upload-helpers";
import KonfirmasiDuaLangkah from "./konfirmasi-dua-langkah";

// Panel finalisasi dokumen (DISETUJUI → DIFINALKAN) untuk pemeriksa.
// Hanya mengirim dokumenId ke server action — versi & checksum dipilih server.
// Info versi di bawah hanya untuk TINJAUAN, bukan data yang dikirim balik.

export default function PanelFinalisasi({
  dokumenId,
  versi,
}: {
  dokumenId: string;
  versi: { id: string; nomor: number; namaAsli: string | null; mime: string | null; ukuran: number | null; sha256: string | null };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [sukses, setSukses] = useState(false);

  return (
    <div className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
        <Lock className="h-4 w-4 text-violet-600" aria-hidden="true" />
        Finalisasi Dokumen
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        Dokumen disetujui dan siap dikunci. Finalisasi mengikat versi PDF berikut sebagai dokumen final.
      </p>

      <dl className="mt-3 space-y-1.5 rounded-xl bg-slate-50 px-3 py-2.5 text-xs">
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 font-semibold text-slate-500">File</dt>
          <dd className="min-w-0 flex-1 break-words font-bold text-slate-900">{versi.namaAsli ?? "—"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 font-semibold text-slate-500">Versi</dt>
          <dd className="flex-1 text-slate-700">v{versi.nomor} · {labelMime(versi.mime)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 font-semibold text-slate-500">Ukuran</dt>
          <dd className="flex-1 text-slate-700">{versi.ukuran != null ? formatUkuran(versi.ukuran) : "—"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 font-semibold text-slate-500">Checksum</dt>
          <dd className="min-w-0 flex-1 break-all font-mono text-[11px] text-slate-700">sha256:{potongHash(versi.sha256)}</dd>
        </div>
      </dl>

      <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-amber-800">
        Finalisasi tidak dapat dibatalkan melalui UI. Finalisasi ini merupakan penguncian internal dokumen dan belum
        merupakan Tanda Tangan Elektronik tersertifikasi.
      </p>

      <div className="mt-3">
        <KonfirmasiDuaLangkah
          labelTombol="Finalisasi Dokumen"
          ikon={Lock}
          tonal="blue"
          judulTinjau="Tinjau Finalisasi"
          deskripsiTinjau="Pastikan versi PDF di atas sudah final. Setelah dikunci, versi tidak dapat diganti."
          labelKonfirmasi="Kunci sebagai Dokumen Final"
          pendingLabel="Mengunci…"
          pending={pending}
          error={err}
          onKonfirmasi={() => {
            setErr(null);
            start(async () => {
              try {
                await finalisasiDokumen(dokumenId);
                setSukses(true);
                router.refresh();
              } catch (ex: unknown) {
                setErr(ex instanceof Error ? ex.message : "Gagal memfinalisasi dokumen.");
              }
            });
          }}
        />
      </div>

      <p role="status" aria-live="polite" className={sukses ? "mt-2 text-xs font-semibold text-emerald-700" : "sr-only"}>
        {sukses ? "Dokumen berhasil difinalkan." : ""}
      </p>
    </div>
  );
}
