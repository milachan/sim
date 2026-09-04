import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { bolehBacaDokumen } from "@/lib/otorisasi";
import { JENIS_DOKUMEN_LABEL } from "@/lib/dokumen-validasi";
import { ROLE_LABEL } from "@/lib/constants";
import { formatKodeVerifikasi } from "@/lib/administrasi/finalisasi";
import { formatTanggal } from "@/lib/utils";
import { urlVerifikasiKode } from "@/lib/verifikasi/qr-url";
import QrVerifikasi from "@/components/administrasi/qr-verifikasi";
import TombolCetak from "@/components/administrasi/tombol-cetak";
import type { JenisDokumen } from "@prisma/client";

// Lembar Verifikasi cetak (A4) — internal berotorisasi:
// pemilik dokumen atau pemeriksa sesuai bolehBacaDokumen.
// Route tetap wajib login; tidak ada unduhan publik.

export default async function LembarVerifikasiPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const d = await prisma.dokumen.findUnique({
    where: { id: params.id },
    include: { dokumenFinal: true },
  });
  // notFound netral: data tidak ada ATAU tidak berhak ATAU belum final.
  if (!d || !d.dokumenFinal || !bolehBacaDokumen(user, { pengajuUserId: d.pengajuUserId, status: d.status })) {
    notFound();
  }
  if (d.status !== "DIFINALKAN" && d.status !== "DIARSIPKAN") notFound();

  const f = d.dokumenFinal;
  const [pengaju, finalisator, sekolah] = await Promise.all([
    prisma.user.findUnique({ where: { id: d.pengajuUserId }, select: { nama: true, role: true } }),
    prisma.user.findUnique({ where: { id: f.difinalkanOlehId }, select: { nama: true } }),
    prisma.sekolah.findFirst({ select: { nama: true } }),
  ]);

  return (
    <div className="space-y-4">
      {/* Aksi layar — tidak ikut tercetak */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/administrasi/${d.id}`}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-1 text-sm font-bold text-slate-600 transition-colors hover:text-slate-900"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Kembali ke Dokumen
        </Link>
        <TombolCetak />
      </div>

      {/* Lembar A4 */}
      <article className="lembar-a4 mx-auto w-full max-w-[210mm] rounded-none border border-slate-300 bg-white p-8 shadow-sm print:border-0 print:shadow-none" aria-label="Lembar verifikasi dokumen">
        <header className="border-b-2 border-slate-900 pb-4">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500">
            {sekolah?.nama ?? "Madrasah"}
          </p>
          <h1 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900">Lembar Verifikasi Dokumen</h1>
          <p className="mt-1 text-xs text-slate-500">
            Lembar ini menyatakan pencatatan dan integritas dokumen berikut pada layanan verifikasi internal.
          </p>
        </header>

        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 text-xs sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="font-semibold text-slate-500">Dokumen</dt>
            <dd className="mt-0.5 break-words text-sm font-bold text-slate-900">{d.judul}</dd>
            <dd className="mt-0.5 text-slate-500">{JENIS_DOKUMEN_LABEL[d.jenis as JenisDokumen]}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Pengaju</dt>
            <dd className="mt-0.5 text-slate-800">
              {pengaju?.nama ?? "—"}
              {pengaju && <span className="text-slate-400"> · {ROLE_LABEL[pengaju.role]}</span>}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Finalisator</dt>
            <dd className="mt-0.5 text-slate-800">{finalisator?.nama ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Versi final</dt>
            <dd className="mt-0.5 text-slate-800">v{f.nomorVersi}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-500">Tanggal finalisasi</dt>
            <dd className="mt-0.5 text-slate-800">{formatTanggal(f.difinalkanPada, "d MMMM yyyy, HH:mm")}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-semibold text-slate-500">SHA-256</dt>
            <dd className="mt-1 break-all font-mono text-[11px] text-slate-700">{f.sha256}</dd>
          </div>
        </dl>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-[1fr_auto]">
          <div className="space-y-3 self-center">
            <div>
              <p className="font-semibold text-slate-500">Kode Verifikasi</p>
              <p className="mt-1 font-mono text-base font-bold tracking-widest text-slate-900">
                {formatKodeVerifikasi(f.kodeVerifikasi)}
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-500">Tautan Verifikasi</p>
              <code className="mt-1 block break-all font-mono text-[11px] text-slate-700">
                {urlVerifikasiKode(f.kodeVerifikasi)}
              </code>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Pindai QR atau buka tautan di atas untuk memeriksa pencatatan dan integritas file dokumen.
            </p>
          </div>
          <div className="qr-cetak shrink-0 self-start">
            <QrVerifikasi kodeVerifikasi={f.kodeVerifikasi} />
          </div>
        </div>

        <footer className="mt-8 border-t border-slate-200 pt-4 text-[11px] leading-relaxed text-slate-500">
          <p>
            QR ini mengarah ke layanan verifikasi pencatatan dan integritas dokumen. QR ini bukan Tanda Tangan
            Elektronik tersertifikasi dan bukan cap digital resmi.
          </p>
        </footer>
      </article>

      {/* Print CSS */}
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          nav, header.app-topbar, aside, footer, .no-print, .safe-bottom, [role="navigation"] { display: none !important; }
          body { background: white !important; }
          .lembar-a4 { box-shadow: none !important; border: none !important; max-width: none !important; page-break-inside: avoid; }
          .qr-cetak svg { width: 38mm !important; height: 38mm !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
