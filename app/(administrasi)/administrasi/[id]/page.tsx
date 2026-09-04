import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  adalahAkunPiket,
  adalahPemeriksaDokumen,
  bolehBacaDokumen,
  bolehKelolaDokumenDraf,
  bolehMengajukanDokumen,
} from "@/lib/otorisasi";
import { JENIS_DOKUMEN_LABEL, STATUS_DOKUMEN_BADGE, STATUS_DOKUMEN_LABEL } from "@/lib/dokumen-validasi";
import { FormRevisiDanKirim, FormUbahDokumen, TombolHapusDraf, TombolKirim } from "@/components/administrasi/dokumen-forms";
import DaftarVersiDokumen from "@/components/administrasi/daftar-versi-dokumen";
import UploadVersiDokumen from "@/components/administrasi/upload-versi-dokumen";
import TimelineDokumen from "@/components/administrasi/timeline-dokumen";
import PanelDokumenFinal from "@/components/administrasi/panel-dokumen-final";
import Card, { CardHeader } from "@/components/ds/card";
import Alert from "@/components/ds/alert";
import { bolehTampilUpload, isDokumenTerkunci, urutVersiTerbaru } from "@/lib/administrasi/upload-helpers";
import { cn } from "@/lib/utils";
import type { JenisDokumen, StatusDokumen } from "@prisma/client";

export default async function DokumenDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  const d = await prisma.dokumen.findUnique({ where: { id: params.id }, include: { dokumenFinal: true } });
  if (!d) notFound();
  if (!bolehBacaDokumen(user!, { pengajuUserId: d.pengajuUserId, status: d.status })) notFound();

  // Dokumen "lama pemeriksa" = dokumen yang diajukan oleh KEPALA/ADMIN/SUPERADMIN.
  // Akun-akun ini hanya boleh membaca (metadata, versi, timeline, final) —
  // tidak boleh mengubah, menghapus, mengirim, merevisi, atau mengunggah.
  const isDokumenLamaPemeriksa =
    !!user && d.pengajuUserId === user.id && adalahPemeriksaDokumen(user.role);

  // PIKET tidak boleh melihat kontrol mutasi apa pun (meski guard di action
  // sudah cukup — UI konsisten tidak menawarkan aksi). Deteksi memakai helper
  // terpusat di lib/otorisasi.ts (satu sumber aturan).
  const isAkunPiket = !!user && adalahAkunPiket(user);

  // Aksi mutasi hanya untuk pengaju sah (bukan PIKET, bukan pemeriksa).
  const bolehAksiPengaju =
    !!user &&
    !isDokumenLamaPemeriksa &&
    !isAkunPiket &&
    bolehMengajukanDokumen(user) &&
    d.pengajuUserId === user.id;

  const isDrafMilik = bolehAksiPengaju && bolehKelolaDokumenDraf(user!, { pengajuUserId: d.pengajuUserId, status: d.status });
  const isRevisiMilik = bolehAksiPengaju && d.status === "PERLU_REVISI";
  const showUpload = bolehAksiPengaju && bolehTampilUpload(d.status, d.pengajuUserId === user!.id);
  const locked = isDokumenTerkunci(d.status);
  const [riwayat, versiRaw] = await Promise.all([
    prisma.riwayatDokumen.findMany({
      where: { dokumenId: d.id },
      orderBy: { waktu: "desc" },
      select: { id: true, aksi: true, dariStatus: true, keStatus: true, payload: true, waktu: true, aktorUserId: true },
    }),
    prisma.versiDokumen.findMany({
      where: { dokumenId: d.id, kunciPenyimpanan: { not: null } },
      orderBy: { nomor: "desc" },
      select: { id: true, nomor: true, namaAsli: true, mime: true, ukuran: true, sha256: true, createdAt: true },
    }),
  ]);
  const versi = urutVersiTerbaru(versiRaw.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() })));

  // Nama pelaku riwayat & finalisator (bukan ID internal).
  const idAktor = [...new Set(riwayat.map((r) => r.aktorUserId).filter((v): v is string => !!v))];
  if (d.dokumenFinal) idAktor.push(d.dokumenFinal.difinalkanOlehId);
  const users =
    idAktor.length > 0
      ? await prisma.user.findMany({ where: { id: { in: idAktor } }, select: { id: true, nama: true } })
      : [];
  const namaUser = new Map(users.map((u) => [u.id, u.nama]));

  return (
    <div className="space-y-4">
      <Link href="/administrasi" className="inline-flex text-sm font-bold text-slate-600 hover:text-slate-900">
        ← Kembali ke Dashboard
      </Link>

      {isDokumenLamaPemeriksa && (
        <Alert variant="info">
          Dokumen lama ini hanya dapat dibaca. Akun pemeriksa tidak menggunakan alur pengajuan pribadi.
        </Alert>
      )}

      <Card padding="lg">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("chip", STATUS_DOKUMEN_BADGE[d.status as StatusDokumen])}>{STATUS_DOKUMEN_LABEL[d.status as StatusDokumen]}</span>
          <span className="chip bg-slate-100 text-slate-600">{JENIS_DOKUMEN_LABEL[d.jenis as JenisDokumen]}</span>
          {isDokumenLamaPemeriksa && (
            <span className="chip bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200">Read-only</span>
          )}
        </div>
        <h1 className="mt-3 text-xl font-extrabold text-slate-900">{d.judul}</h1>
        {d.ringkasan && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{d.ringkasan}</p>}
        <p className="mt-3 text-xs text-slate-400">Diperbarui {new Date(d.updatedAt).toLocaleString("id-ID")}</p>
        {!isDokumenLamaPemeriksa && !isDrafMilik && !isRevisiMilik && d.status !== "DIKIRIM" && d.status !== "PERLU_REVISI" && d.status !== "DISETUJUI" && (
          <Alert variant="warning" className="mt-3">
            Dokumen ini tidak dapat diedit pada status ini.
          </Alert>
        )}
        {d.status === "DIKIRIM" && (
          <Alert variant="info" className="mt-3">
            Dokumen telah dikirim ke Kamad dan tidak dapat diedit langsung.
          </Alert>
        )}
        {d.status === "DISETUJUI" && (
          <Alert variant="success" className="mt-3">
            Dokumen telah disetujui Kamad dan menunggu finalisasi.
          </Alert>
        )}
      </Card>

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

      {isDrafMilik && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Ubah draf" />
            <div className="mt-3">
              <FormUbahDokumen id={d.id} awal={{ judul: d.judul, jenis: d.jenis as JenisDokumen, ringkasan: d.ringkasan }} />
            </div>
          </Card>
          <Card>
            <div className="space-y-4">
              <div>
                <CardHeader title="Kirim ke Kamad" />
                <div className="mt-3">
                  <TombolKirim id={d.id} />
                </div>
              </div>
              <div className="border-t border-slate-100 pt-4">
                <CardHeader title="Hapus" description="Hanya draf milik sendiri yang dapat dihapus." />
                <div className="mt-3">
                  <TombolHapusDraf id={d.id} />
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {isRevisiMilik && (
        <Card variant="outline" className="border-amber-200">
          <CardHeader title="Perbaiki & kirim ulang (PERLU_REVISI)" description="Catatan revisi dari Kamad ada di riwayat di bawah." />
          <div className="mt-3">
            <FormRevisiDanKirim id={d.id} awal={{ judul: d.judul, jenis: d.jenis as JenisDokumen, ringkasan: d.ringkasan }} />
          </div>
        </Card>
      )}

      {showUpload ? (
        <Card>
          <CardHeader
            title="Unggah file"
            description="Upload akan membuat versi baru. Versi lama tetap tersimpan. Setelah selesai, gunakan tombol kirim ulang di atas."
          />
          <div className="mt-3">
            <UploadVersiDokumen dokumenId={d.id} />
          </div>
        </Card>
      ) : locked ? (
        <Alert variant="warning">
          Dokumen sedang diproses atau sudah dikunci — unggahan versi baru tidak tersedia pada status ini.
        </Alert>
      ) : null}

      <Card>
        <CardHeader title="Versi file" description="Terbaru ke terlama. Unduh memakai ID versi — tanpa path storage." />
        <div className="mt-3">
          <DaftarVersiDokumen versi={versi as never} versiAktif={d.versiAktif} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Riwayat" />
        <div className="mt-3">
          <TimelineDokumen
            items={riwayat.map((r) => ({
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
  );
}
