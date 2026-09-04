import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { adalahPemeriksaDokumen, bolehMintaRevisi, bolehSetujuiDokumen } from "@/lib/otorisasi";
import { JENIS_DOKUMEN_LABEL, STATUS_DOKUMEN_BADGE, STATUS_DOKUMEN_LABEL } from "@/lib/dokumen-validasi";
import { ROLE_LABEL } from "@/lib/constants";
import {
  PERINGATAN_VERSI_BUKAN_PDF,
  SARAN_CATATAN_REVISI_PDF,
  pilihVersiTerbaru,
  siapSetujuiMetadata,
} from "@/lib/administrasi/finalisasi";
import { bolehLihatFinalisasi } from "@/lib/administrasi/pemeriksaan";
import { formatTanggal } from "@/lib/utils";
import { FormMintaRevisi } from "@/components/administrasi/dokumen-forms";
import TombolSetujui from "@/components/administrasi/tombol-setujui";
import PanelFinalisasi from "@/components/administrasi/panel-finalisasi";
import PanelDokumenFinal from "@/components/administrasi/panel-dokumen-final";
import DaftarVersiDokumen from "@/components/administrasi/daftar-versi-dokumen";
import TimelineDokumen from "@/components/administrasi/timeline-dokumen";
import Card, { CardHeader } from "@/components/ds/card";
import Alert from "@/components/ds/alert";
import { cn } from "@/lib/utils";
import type { JenisDokumen } from "@prisma/client";

export default async function KotakMasukDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || !adalahPemeriksaDokumen(user.role)) redirect("/administrasi");

  const d = await prisma.dokumen.findUnique({ where: { id: params.id }, include: { dokumenFinal: true } });
  if (!d) notFound();
  if (d.status === "DRAF") notFound();

  const konflikKepentingan = d.pengajuUserId === user.id;
  const canRevisi = !konflikKepentingan && bolehMintaRevisi(user, { pengajuUserId: d.pengajuUserId, status: d.status });
  const canSetujui = !konflikKepentingan && bolehSetujuiDokumen(user, { pengajuUserId: d.pengajuUserId, status: d.status });

  const [pengaju, versiRaw, riwayatRaw] = await Promise.all([
    prisma.user.findUnique({ where: { id: d.pengajuUserId }, select: { nama: true, role: true } }),
    prisma.versiDokumen.findMany({
      where: { dokumenId: d.id },
      orderBy: { nomor: "desc" },
      // kunciPenyimpanan hanya untuk keputusan server-side, tidak diteruskan ke UI.
      select: { id: true, nomor: true, namaAsli: true, mime: true, ukuran: true, sha256: true, createdAt: true, kunciPenyimpanan: true },
    }),
    prisma.riwayatDokumen.findMany({
      where: { dokumenId: d.id },
      orderBy: { waktu: "desc" },
      select: { id: true, aksi: true, dariStatus: true, keStatus: true, payload: true, waktu: true, aktorUserId: true },
    }),
  ]);

  const versiTerbaru = pilihVersiTerbaru(versiRaw);
  const siapSetujui = canSetujui && siapSetujuiMetadata(versiTerbaru);
  const lihatFinalisasi = !konflikKepentingan && bolehLihatFinalisasi(user.role, d.status);

  // Nama pelaku riwayat & finalisator (bukan ID internal).
  const idAktor = [...new Set(riwayatRaw.map((r) => r.aktorUserId).filter((v): v is string => !!v))];
  if (d.dokumenFinal) idAktor.push(d.dokumenFinal.difinalkanOlehId);
  const users = idAktor.length > 0
    ? await prisma.user.findMany({ where: { id: { in: [...new Set(idAktor)] } }, select: { id: true, nama: true } })
    : [];
  const namaUser = new Map(users.map((u) => [u.id, u.nama]));

  const tanggalDikirim = riwayatRaw.find((r) => r.aksi === "kirim" && r.keStatus === "DIKIRIM")?.waktu ?? null;
  const versiUntukUi = versiRaw.map((v) => ({
    id: v.id,
    nomor: v.nomor,
    namaAsli: v.namaAsli,
    mime: v.mime,
    ukuran: v.ukuran,
    sha256: v.sha256,
    createdAt: v.createdAt,
  }));

  const adaPanelAksi = canRevisi || canSetujui || lihatFinalisasi || !!d.dokumenFinal;
  const tampilkanPanelAksi = adaPanelAksi || konflikKepentingan;

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex min-h-[44px] items-center gap-1 text-sm font-bold text-slate-500">
        <Link href="/administrasi/kotak-masuk" className="rounded-xl px-1 transition-colors hover:text-slate-900">
          Kotak Masuk
        </Link>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
        <span aria-current="page" className="truncate text-slate-900">
          {d.judul}
        </span>
      </nav>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        {/* Kolom utama: informasi */}
        <Card padding="lg" className="order-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("chip", STATUS_DOKUMEN_BADGE[d.status])}>{STATUS_DOKUMEN_LABEL[d.status]}</span>
            <span className="chip bg-slate-100 text-slate-600">{JENIS_DOKUMEN_LABEL[d.jenis as JenisDokumen]}</span>
          </div>
          <h1 className="mt-3 break-words text-xl font-extrabold text-slate-900 sm:text-2xl">{d.judul}</h1>

          <dl className="mt-4 space-y-1.5 text-xs">
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-semibold text-slate-500">Pengaju</dt>
              <dd className="min-w-0 flex-1 font-bold text-slate-800">
                {pengaju?.nama ?? "—"}
                {pengaju && <span className="font-normal text-slate-500"> · {ROLE_LABEL[pengaju.role]}</span>}
              </dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-semibold text-slate-500">Dibuat</dt>
              <dd className="min-w-0 flex-1 text-slate-600">{formatTanggal(d.createdAt, "d MMM yyyy, HH:mm")}</dd>
            </div>
            {tanggalDikirim && (
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-semibold text-slate-500">Dikirim</dt>
                <dd className="min-w-0 flex-1 text-slate-600">{formatTanggal(tanggalDikirim, "d MMM yyyy, HH:mm")}</dd>
              </div>
            )}
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-semibold text-slate-500">Diperbarui</dt>
              <dd className="min-w-0 flex-1 text-slate-600">{formatTanggal(d.updatedAt, "d MMM yyyy, HH:mm")}</dd>
            </div>
          </dl>

          {d.ringkasan && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">{d.ringkasan}</p>}
        </Card>

        {/* Kolom utama: versi file */}
        <Card className="order-2 min-w-0">
          <CardHeader title="Versi file" description="Terbaru ke terlama. Unduhan lewat versi file — tanpa path penyimpanan." />
          <div className="mt-3">
            <DaftarVersiDokumen versi={versiUntukUi} versiAktif={d.versiAktif} />
          </div>
        </Card>

        {/* Panel aksi (kanan di desktop, setelah file di mobile) */}
        {tampilkanPanelAksi && (
          <aside className="order-3 min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start" aria-label="Panel pemeriksaan">
            {konflikKepentingan && (
              <Alert variant="warning">
                Dokumen ini Anda ajukan sendiri. Pemeriksaan dan finalisasi harus dilakukan oleh pemeriksa lain.
              </Alert>
            )}
            {d.status === "DIKIRIM" && (
              <Card>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                      Kesiapan pemeriksaan
                    </span>
                  }
                />
                {siapSetujui ? (
                  <Alert variant="success" className="mt-2">
                    Versi PDF terbaru siap. Dokumen dapat disetujui.
                  </Alert>
                ) : (
                  <Alert variant="warning" className="mt-2">
                    {PERINGATAN_VERSI_BUKAN_PDF}
                  </Alert>
                )}
              </Card>
            )}

            {canRevisi && (
              <Card variant="outline" className="border-amber-200">
                <CardHeader
                  title="Minta revisi"
                  description="Mengembalikan dokumen ke guru untuk diperbaiki. Wajib menuliskan catatan yang jelas agar guru tahu apa yang harus diperbaiki."
                />
                {canSetujui && !siapSetujui && (
                  <Alert variant="warning" className="mt-2">
                    Saran catatan: &ldquo;{SARAN_CATATAN_REVISI_PDF}&rdquo;
                  </Alert>
                )}
                <div className="mt-3">
                  <FormMintaRevisi id={d.id} saranCatatan={canSetujui && !siapSetujui ? SARAN_CATATAN_REVISI_PDF : undefined} />
                </div>
              </Card>
            )}

            {canSetujui && (
              <Card variant="outline" className="border-emerald-200">
                <h2 className="text-sm font-extrabold text-slate-900">Setujui</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Menyatakan dokumen lengkap dan benar. Pengaju tidak dapat mengubahnya lagi; langkah berikutnya adalah finalisasi.
                </p>
                {siapSetujui && versiTerbaru && pengaju ? (
                  <div className="mt-3">
                    <TombolSetujui
                      id={d.id}
                      ringkasan={{
                        judul: d.judul,
                        jenisLabel: JENIS_DOKUMEN_LABEL[d.jenis as JenisDokumen],
                        pengajuNama: pengaju.nama,
                        namaFile: versiTerbaru.namaAsli ?? "—",
                        ukuran: versiTerbaru.ukuran,
                      }}
                    />
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-slate-400">Tombol persetujuan aktif setelah versi terbaru berupa PDF.</p>
                )}
              </Card>
            )}

            {lihatFinalisasi && versiTerbaru && (
              <PanelFinalisasi
                dokumenId={d.id}
                versi={{
                  id: versiTerbaru.id,
                  nomor: versiTerbaru.nomor,
                  namaAsli: versiTerbaru.namaAsli,
                  mime: versiTerbaru.mime,
                  ukuran: versiTerbaru.ukuran,
                  sha256: versiTerbaru.sha256,
                }}
              />
            )}

            {d.status === "DIFINALKAN" && d.dokumenFinal && (
              <PanelDokumenFinal
                final={{
                  namaAsli: d.dokumenFinal.namaAsli,
                  nomorVersi: d.dokumenFinal.nomorVersi,
                  ukuran: d.dokumenFinal.ukuran,
                  mime: d.dokumenFinal.mime,
                  sha256: d.dokumenFinal.sha256,
                  kodeVerifikasi: d.dokumenFinal.kodeVerifikasi,
                  difinalkanPada: d.dokumenFinal.difinalkanPada,
                }}
                unduhVersiId={d.dokumenFinal.versiId}
                dokumenId={d.id}
                difinalkanOlehNama={namaUser.get(d.dokumenFinal.difinalkanOlehId) ?? null}
              />
            )}
          </aside>
        )}

        {/* Kolom utama: riwayat (paling bawah di mobile) */}
        <Card className="order-4 min-w-0">
          <CardHeader title="Riwayat dokumen" />
          <div className="mt-3">
            <TimelineDokumen
              items={riwayatRaw.map((r) => ({
                id: r.id,
                aksi: r.aksi,
                dariStatus: r.dariStatus,
                keStatus: r.keStatus,
                payload: r.payload,
                waktu: r.waktu,
                aktorNama: r.aktorUserId ? namaUser.get(r.aktorUserId) ?? null : null,
              }))}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
