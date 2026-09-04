import { ShieldCheck, SearchX, FileWarning, Ban } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { verifikasiKodeDokumen } from "@/lib/verifikasi/service";
import { formatTanggal } from "@/lib/utils";
import Card, { CardHeader } from "@/components/ds/card";
import Alert from "@/components/ds/alert";
import { JENIS_DOKUMEN_LABEL } from "@/lib/dokumen-validasi";
import type { JenisDokumen } from "@prisma/client";

// Halaman publik terbatas: cek kode Dokumen Final. Tanpa login.
// Tidak menampilkan judul, nama pengaju, storage key, tombol unduh, atau isi dokumen.

const DISCLAIMER =
  "Verifikasi ini memastikan dokumen tercatat dan file tidak berubah sejak finalisasi internal. Verifikasi ini bukan Tanda Tangan Elektronik tersertifikasi.";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function VerifikasiDokumenPage({
  searchParams,
}: {
  searchParams?: { kode?: string; kelebihan?: string };
}) {
  const kodeRaw = searchParams?.kode ?? "";
  const melebihiLaju = searchParams?.kelebihan === "1";

  let hasil: Awaited<ReturnType<typeof verifikasiKodeDokumen>> | null = null;
  if (kodeRaw && !melebihiLaju) {
    const user = await getCurrentUser();
    const infoUser = user ? { id: user.id, role: user.role, guruId: user.guru?.id ?? null } : null;
    hasil = await verifikasiKodeDokumen(kodeRaw, infoUser);
  }

  return (
    <main id="konten-verifikasi" className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      {/* Branding madrasah — netral, tanpa shell rumah */}
      <header className="mb-6 flex items-center justify-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-700 text-white shadow-lg shadow-blue-900/15">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">Verifikasi Dokumen Final</h1>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Madrasah — Rumah Administrasi</p>
        </div>
      </header>

      {/* Form pencarian — GET agar URL dapat dibagikan */}
      <Card padding="lg" className="mb-5">
        <CardHeader
          title="Periksa kode verifikasi"
          description="Masukkan kode yang tertera pada detail dokumen final. Spasi dan tanda hubung boleh diabaikan."
        />
        <form method="get" action="/verifikasi-dokumen" role="search" className="mt-4 space-y-3">
          <div>
            <label htmlFor="kode-verifikasi" className="label">
              Kode Verifikasi <span className="font-bold text-slate-500">(wajib)</span>
            </label>
            <input
              id="kode-verifikasi"
              name="kode"
              defaultValue={kodeRaw}
              required
              autoComplete="off"
              spellCheck={false}
              maxLength={32}
              className="input font-mono uppercase tracking-widest"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              aria-describedby="kode-bantuan"
            />
            <p id="kode-bantuan" className="mt-1 text-xs text-slate-500">
              16 karakter huruf dan angka. Huruf kecil otomatis dibaca sebagai huruf besar.
            </p>
          </div>
          <button type="submit" className="btn-primary w-full">
            Periksa Kode
          </button>
        </form>
      </Card>

      {/* Rate limit */}
      {melebihiLaju && (
        <Alert variant="warning" title="Terlalu banyak percobaan" className="mb-5">
          Batas percobaan verifikasi tercapai. Silakan tunggu beberapa menit lalu coba lagi.
        </Alert>
      )}

      {/* Hasil */}
      {hasil?.status === "VALID" && (
        <Card padding="lg" className="mb-5 border-emerald-200" aria-label="Hasil verifikasi">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-emerald-800">Dokumen tercatat dan utuh</p>
              <p className="mt-0.5 text-xs text-slate-500">File privat identik dengan kondisi saat finalisasi.</p>
            </div>
          </div>

          <dl className="mt-4 space-y-2 rounded-xl bg-slate-50 px-3 py-3 text-xs">
            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
              <dt className="w-32 shrink-0 font-semibold text-slate-500">Kode verifikasi</dt>
              <dd className="min-w-0 flex-1 break-all font-mono font-bold tracking-wider text-emerald-700">{hasil.publik.kodeTerformat}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
              <dt className="w-32 shrink-0 font-semibold text-slate-500">Jenis dokumen</dt>
              <dd className="min-w-0 flex-1 text-slate-700">{JENIS_DOKUMEN_LABEL[hasil.publik.jenisDokumen as JenisDokumen] ?? hasil.publik.jenisDokumen}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
              <dt className="w-32 shrink-0 font-semibold text-slate-500">Versi final</dt>
              <dd className="min-w-0 flex-1 text-slate-700">v{hasil.publik.nomorVersiFinal}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
              <dt className="w-32 shrink-0 font-semibold text-slate-500">Difinalkan</dt>
              <dd className="min-w-0 flex-1 text-slate-700">{formatTanggal(hasil.publik.difinalkanPada, "d MMMM yyyy, HH:mm")}</dd>
            </div>
            {hasil.publik.namaInstansi && (
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                <dt className="w-32 shrink-0 font-semibold text-slate-500">Instansi</dt>
                <dd className="min-w-0 flex-1 text-slate-700">{hasil.publik.namaInstansi}</dd>
              </div>
            )}
            <div className="flex flex-wrap items-start gap-x-2 gap-y-0.5">
              <dt className="w-32 shrink-0 pt-1 font-semibold text-slate-500">SHA-256</dt>
              <dd className="min-w-0 flex-1">
                <code className="block break-all rounded-lg bg-white px-2 py-1 font-mono text-[11px] text-slate-700 ring-1 ring-inset ring-slate-200">
                  {hasil.publik.sha256}
                </code>
              </dd>
            </div>
          </dl>

          {hasil.publik.linkDetail && (
            <a href={hasil.publik.linkDetail} className="btn-secondary mt-4 min-h-[44px] w-full sm:w-auto">
              Buka Detail Dokumen
            </a>
          )}
        </Card>
      )}

      {hasil?.status === "TIDAK_DITEMUKAN" && (
        <Card padding="lg" className="mb-5">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-inset ring-slate-200">
              <SearchX className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-bold text-slate-900">Kode tidak ditemukan</p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{hasil.pesan}</p>
          </div>
        </Card>
      )}

      {hasil?.status === "FORMAT_TIDAK_VALID" && (
        <Card padding="lg" className="mb-5">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-200">
              <Ban className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="mt-3 text-sm font-bold text-slate-900">Format kode belum benar</p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{hasil.pesan}</p>
          </div>
        </Card>
      )}

      {hasil?.status === "INTEGRITAS_BERMASALAH" && (
        <Card padding="lg" className="mb-5 border-rose-200">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-inset ring-rose-200">
              <FileWarning className="h-6 w-6" aria-hidden="true" />
            </span>
            <p role="alert" className="mt-3 text-sm font-bold text-slate-900">
              Dokumen tercatat, tetapi integritas file tidak dapat dikonfirmasi.
            </p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
              Silakan hubungi Admin madrasah untuk pemeriksaan lebih lanjut.
            </p>
          </div>
        </Card>
      )}

      {/* Disclaimer wajib — selalu tampil */}
      <Alert variant="neutral" className="mb-5 text-[11px] leading-relaxed">
        {DISCLAIMER}
      </Alert>

      <p className="text-center text-[11px] text-slate-400">
        Halaman ini tidak menampilkan isi dokumen dan tidak menyediakan unduhan publik.
      </p>
    </main>
  );
}
