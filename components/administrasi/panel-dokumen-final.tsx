import { Download, ExternalLink, FileCheck2, Info, Lock, Printer } from "lucide-react";
import { formatKodeVerifikasi } from "@/lib/administrasi/finalisasi";
import { hrefUnduhVersi } from "@/lib/administrasi/pemeriksaan";
import { formatUkuran, labelMime, potongHash } from "@/lib/administrasi/upload-helpers";
import { formatTanggal } from "@/lib/utils";
import QrVerifikasi from "./qr-verifikasi";
import TombolSalin from "./tombol-salin";

// Panel Dokumen Final — tampil saat status DIFINALKAN/DIARSIPKAN, dipakai bersama
// di detail Kamad dan detail dokumen milik guru. Tanpa storage key,
// tanpa klaim TTE/cap.

export default function PanelDokumenFinal({
  final,
  unduhVersiId,
  difinalkanOlehNama,
  dokumenId,
}: {
  final: {
    namaAsli: string;
    nomorVersi: number;
    ukuran: number;
    mime: string;
    sha256: string;
    kodeVerifikasi: string;
    difinalkanPada: Date | string;
  };
  unduhVersiId: string;
  difinalkanOlehNama: string | null;
  /** Diperlukan untuk tombol Cetak Lembar Verifikasi. */
  dokumenId: string;
}) {
  return (
    <section className="rounded-2xl border border-violet-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Dokumen final">
      <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
          <Lock className="h-4 w-4" aria-hidden="true" />
        </span>
        Dokumen Final
      </h2>
      <p className="mt-1 text-xs text-slate-500">Dokumen ini telah dikunci sebagai versi final.</p>

      <dl className="mt-3 space-y-2 rounded-xl bg-slate-50 px-3 py-3 text-xs">
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          <dt className="w-32 shrink-0 font-semibold text-slate-500">Status</dt>
          <dd className="min-w-0 flex-1 font-bold text-violet-700">Dokumen Final (terkunci)</dd>
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          <dt className="w-32 shrink-0 font-semibold text-slate-500">File final</dt>
          <dd className="min-w-0 flex-1 break-words font-bold text-slate-900">
            {final.namaAsli} <span className="font-normal text-slate-500">· v{final.nomorVersi}</span>
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          <dt className="w-32 shrink-0 font-semibold text-slate-500">Format & ukuran</dt>
          <dd className="min-w-0 flex-1 text-slate-700">
            {labelMime(final.mime)} · {formatUkuran(final.ukuran)}
          </dd>
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          <dt className="w-32 shrink-0 font-semibold text-slate-500">Difinalkan oleh</dt>
          <dd className="min-w-0 flex-1 text-slate-700">
            {difinalkanOlehNama ?? "—"} · {formatTanggal(final.difinalkanPada, "d MMM yyyy, HH:mm")}
          </dd>
        </div>
        <div className="flex flex-wrap items-start gap-x-2 gap-y-0.5">
          <dt className="w-32 shrink-0 pt-1 font-semibold text-slate-500">Checksum SHA-256</dt>
          <dd className="min-w-0 flex-1">
            <code className="block break-all rounded-lg bg-white px-2 py-1 font-mono text-[11px] text-slate-700 ring-1 ring-inset ring-slate-200">
              {final.sha256}
            </code>
            <span className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] text-slate-400">potongan: {potongHash(final.sha256, 16)}</span>
              <TombolSalin nilai={final.sha256} label="checksum" />
            </span>          </dd>
        </div>
        <div className="flex flex-wrap items-start gap-x-2 gap-y-0.5">
          <dt className="w-32 shrink-0 pt-1 font-semibold text-slate-500">Kode verifikasi</dt>
          <dd className="min-w-0 flex-1">
            <code className="block break-all rounded-lg bg-white px-2 py-1 font-mono text-[11px] font-bold tracking-wider text-violet-700 ring-1 ring-inset ring-violet-200">
              {formatKodeVerifikasi(final.kodeVerifikasi)}
            </code>
            <span className="mt-1">
              <TombolSalin nilai={final.kodeVerifikasi} label="kode verifikasi" />
            </span>
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={hrefUnduhVersi(unduhVersiId)}
          className="btn-primary btn-sm min-h-[44px]"
          aria-label={`Unduh file final versi ${final.nomorVersi}`}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Unduh File Final
        </a>
        <a
          href={`/verifikasi-dokumen?kode=${encodeURIComponent(final.kodeVerifikasi)}`}
          className="btn-secondary btn-sm min-h-[44px]"
          aria-label={`Buka halaman verifikasi kode ${formatKodeVerifikasi(final.kodeVerifikasi)}`}
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Buka Halaman Verifikasi
        </a>
        <a
          href={`/administrasi/${dokumenId}/lembar-verifikasi`}
          className="btn-secondary btn-sm min-h-[44px]"
          aria-label={`Cetak lembar verifikasi dokumen final`}
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          Cetak Lembar Verifikasi
        </a>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
          <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
          Integritas terikat checksum
        </span>
      </div>

      {/* QR verifikasi — hanya kode, tanpa dokumenId/storage key */}
      <div className="mt-4 border-t border-slate-100 pt-4">
        <QrVerifikasi kodeVerifikasi={final.kodeVerifikasi} />
      </div>

      <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Finalisasi ini merupakan penguncian internal dokumen dan belum merupakan Tanda Tangan Elektronik
        tersertifikasi. Kode verifikasi belum memiliki halaman verifikasi publik.
      </p>
    </section>
  );
}
