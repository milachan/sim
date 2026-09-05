import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock3, User } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Breadcrumb, Card, SuksesBanner } from "@/components/ui";
import { PertemuanBadge } from "@/components/status-badge";
import PertemuanShell from "@/components/pertemuan/pertemuan-shell";
import type { ItemRiwayatJurnal } from "@/components/pertemuan/types";
import { formatTanggalPanjang } from "@/lib/utils";
import { apakahJamUpacara } from "@/lib/constants";
import { rentangJamCerdas } from "@/lib/jam-utils";
import { UpacaraBadge } from "@/components/status-badge";

import { bolehBacaPertemuan, bolehKelolaPertemuan } from "@/lib/otorisasi";
import type { StatusAbsensi } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function PertemuanPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { sukses?: string; kembali?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Tautan kembali dari halaman /jurnal (mis. ?kembali=/jurnal?...). Hanya
  // diterima bila diawali /jurnal agar tidak bisa disalahgunakan menjadi redirect.
  const kembali = searchParams.kembali?.startsWith("/jurnal?") ? searchParams.kembali : null;

  // Otorisasi sebelum data sensitif lengkap diambil: hanya ambil kepemilikan
  // pertemuan (guru jadwal + pembuat manual) untuk memutuskan akses.
  const cekPertemuan = await prisma.pertemuan.findUnique({
    where: { id: params.id },
    select: { jadwal: { select: { guruId: true } }, dibuatOlehId: true },
  });
  if (!cekPertemuan) notFound();

  const hakPertemuan = {
    jadwalGuruId: cekPertemuan.jadwal?.guruId,
    dibuatOlehId: cekPertemuan.dibuatOlehId,
  };
  if (!bolehBacaPertemuan(user, hakPertemuan)) notFound();
  const bolehKelola = bolehKelolaPertemuan(user, hakPertemuan);

  const pertemuan = await prisma.pertemuan.findUnique({
    where: { id: params.id },
    include: {
      jadwal: { include: { guru: true, kelas: true, mapel: true } },
      kelas: true,
      mapel: true,
      jurnal: true,
      absensi: { include: { siswa: true } },
    },
  });
  if (!pertemuan) notFound();

  const kelas = pertemuan.kelas ?? pertemuan.jadwal?.kelas;
  const mapel = pertemuan.mapel ?? pertemuan.jadwal?.mapel;
  const guru = pertemuan.jadwal?.guru;

  const rentangPertemuan = pertemuan.jadwal
    ? await rentangJamCerdas(pertemuan.jadwal.hari, pertemuan.jadwal.jamKeMulai, pertemuan.jadwal.jamKeSelesai)
    : null;

  const siswa = await prisma.siswa.findMany({
    where: { kelasId: kelas?.id, status: "AKTIF", deletedAt: null },
    orderBy: { nama: "asc" },
  });
  const absensiMap = new Map(pertemuan.absensi.map((a) => [a.siswaId, a]));

  // Absensi opsional: tanpa catatan tersimpan, status siswa adalah null (belum
  // ditentukan) — bukan otomatis HADIR. Guru yang menandai baru tersimpan.
  const dataSiswa = siswa.map((s) => {
    const ada = absensiMap.get(s.id);
    return {
      id: s.id,
      nama: s.nama,
      nis: s.nis,
      status: ada?.status ?? null,
      catatan: ada?.catatan ?? "",
    };
  });

  const rekap = {
    HADIR: 0,
    SAKIT: 0,
    IZIN: 0,
    ALPA: 0,
    TERLAMBAT: 0,
    DISPENSASI: 0,
  } as Record<StatusAbsensi, number>;
  for (const a of pertemuan.absensi) rekap[a.status]++;

  // Riwayat pengisian jurnal akun ini (2 minggu terakhir, mapel yang sama) —
  // pengganti tombol "Salin Jurnal Sebelumnya": guru tinggal klik salah satu
  // entri untuk mengisi otomatis.
  const batasRiwayat = new Date();
  batasRiwayat.setHours(0, 0, 0, 0);
  batasRiwayat.setDate(batasRiwayat.getDate() - 13); // 14 hari termasuk hari ini
  const idMapelIni = mapel?.id ?? null;
  const kandidatRiwayat = idMapelIni
    ? await prisma.pertemuan.findMany({
        where: {
          id: { not: pertemuan.id },
          jurnal: { isNot: null },
          tanggal: { gte: batasRiwayat },
          OR: [...(user.guruId ? [{ jadwal: { guruId: user.guruId } }] : []), { dibuatOlehId: user.id }],
        },
        select: {
          id: true,
          tanggal: true,
          pertemuanKe: true,
          mapel: { select: { id: true, nama: true } },
          kelas: { select: { nama: true } },
          jadwal: {
            select: {
              mapel: { select: { id: true, nama: true } },
              kelas: { select: { nama: true } },
            },
          },
          jurnal: {
            select: {
              materi: true,
              tujuan: true,
              kegiatan: true,
              metode: true,
              media: true,
              hasil: true,
              kendala: true,
              tindakLanjut: true,
              catatan: true,
              dokumentasiUrl: true,
            },
          },
        },
        orderBy: { tanggal: "desc" },
        take: 40,
      })
    : [];
  const riwayatPengisian: ItemRiwayatJurnal[] = kandidatRiwayat
    .filter((c) => (c.mapel?.id ?? c.jadwal?.mapel?.id) === idMapelIni)
    .slice(0, 8)
    .map((c) => ({
      pertemuanId: c.id,
      tanggal: c.tanggal.toISOString().slice(0, 10),
      mapel: c.jadwal?.mapel?.nama ?? c.mapel?.nama ?? "-",
      kelas: c.jadwal?.kelas?.nama ?? c.kelas?.nama ?? "-",
      pertemuanKe: c.pertemuanKe,
      materi: c.jurnal?.materi ?? "",
      tujuan: c.jurnal?.tujuan ?? "",
      kegiatan: c.jurnal?.kegiatan ?? "",
      metode: c.jurnal?.metode ?? "",
      media: c.jurnal?.media ?? "",
      hasil: c.jurnal?.hasil ?? "",
      kendala: c.jurnal?.kendala ?? "",
      tindakLanjut: c.jurnal?.tindakLanjut ?? "",
      catatan: c.jurnal?.catatan ?? "",
      dokumentasiUrl: c.jurnal?.dokumentasiUrl ?? "",
    }));

  const jurnal = pertemuan.jurnal;

  // Kejadian siswa (pendukung jurnal) — beserta nama siswa untuk ditampilkan.
  const kejadian = await prisma.catatanKejadian.findMany({
    where: { pertemuanId: pertemuan.id },
    include: { siswa: { select: { nama: true } } },
    orderBy: { createdAt: "asc" },
  });


  return (
    <div className="fade-up">
      {kembali ? (
        <Link href={kembali} className="btn-ghost btn-sm mb-4">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Kelengkapan Jurnal
        </Link>
      ) : (
        <Breadcrumb
          items={[
            { href: "/", label: "Beranda" },
            pertemuan.jadwal
              ? { href: `/jadwal/${pertemuan.jadwal.id}`, label: "Jadwal" }
              : { href: "/jurnal", label: "Jurnal" },
            { label: pertemuan.jadwal ? `${kelas?.nama} · ${mapel?.nama}` : "Pertemuan Manual" },
          ]}
        />
      )}

      <SuksesBanner message={searchParams.sukses} />

      {/* Info pertemuan — satu kartu ringkas: semua keterangan menyatu */}
      <Card className="mb-6 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-5 text-white sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-2xl font-extrabold tracking-tight sm:text-3xl">{mapel?.nama}</h1>
                <span className="chip bg-white/20 text-white">{kelas?.nama}</span>
                {pertemuan.sumber === "MANUAL" && (
                  <span className="chip bg-amber-400/90 text-amber-950">Manual</span>
                )}
              </div>
              <p className="mt-3 flex items-start gap-2.5 break-words text-base font-medium leading-snug text-emerald-50 sm:text-lg">
                <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
                <span className="break-words">
                  {formatTanggalPanjang(pertemuan.tanggal)}
                  {pertemuan.pertemuanKe > 0 ? ` · Pertemuan ke-${pertemuan.pertemuanKe}` : ""}
                </span>
              </p>
              {pertemuan.jadwal && (
                <>
                  <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 break-words text-base font-medium leading-snug text-emerald-50 sm:text-lg">
                    <Clock3 className="mt-0.5 h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
                    <span className="break-words">
                      jam ke-{pertemuan.jadwal.jamKeMulai}
                      {pertemuan.jadwal.jamKeSelesai > pertemuan.jadwal.jamKeMulai ? `–${pertemuan.jadwal.jamKeSelesai}` : ""}
                      {rentangPertemuan ? ` (${rentangPertemuan})` : ""}
                    </span>
                    {apakahJamUpacara(pertemuan.jadwal.hari, pertemuan.jadwal.jamKeMulai) && <UpacaraBadge />}
                  </p>
                  <p className="mt-2 flex items-start gap-2.5 break-words text-base font-medium leading-snug text-emerald-50 sm:text-lg">
                    <User className="mt-0.5 h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
                    <span className="break-words">
                      Guru: <b className="text-white">{guru?.nama ?? "-"}</b>
                    </span>
                  </p>
                </>
              )}
              {pertemuan.sumber === "MANUAL" && pertemuan.alasanManual && (
                <p className="mt-3 break-words rounded-lg bg-white/10 px-3.5 py-2 text-sm text-emerald-50">
                  Alasan: {pertemuan.alasanManual}
                </p>
              )}
            </div>
            <div className="shrink-0 self-start sm:self-center">
              <PertemuanBadge status={pertemuan.status} />
            </div>
          </div>
        </div>
      </Card>

      {!bolehKelola ? (
        <Card className="card-pad">
          <p className="text-sm text-slate-600">
            Anda dapat melihat pertemuan ini, namun tidak dapat mengubah absensi atau jurnalnya.
          </p>
          {jurnal && (
            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <h3 className="font-extrabold text-slate-900">Jurnal</h3>
              <dl className="mt-3 space-y-3 text-sm">
                {[
                  ["Materi", jurnal.materi],
                  ["Tujuan", jurnal.tujuan],
                  ["Kegiatan", jurnal.kegiatan],
                  ["Metode", jurnal.metode],
                  ["Media", jurnal.media],
                  ["Hasil", jurnal.hasil],
                  ["Kendala", jurnal.kendala],
                  ["Tindak Lanjut", jurnal.tindakLanjut],
                  ["Catatan", jurnal.catatan],
                ]
                  .filter(([, v]) => v)
                  .map(([l, v]) => (
                    <div key={l as string}>
                      <dt className="font-bold text-slate-500">{l}</dt>
                      <dd className="mt-0.5 text-slate-800">{v}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          )}
        </Card>
      ) : (
        <PertemuanShell
          pertemuanId={pertemuan.id}
          sumber={pertemuan.sumber}
          alasanManual={pertemuan.alasanManual ?? null}
          dataSiswa={dataSiswa}
          rekap={rekap}
          absensiSudahAda={pertemuan.absensi.length > 0}
          jurnal={
            jurnal
              ? {
                  materi: jurnal.materi ?? "",
                  tujuan: jurnal.tujuan ?? "",
                  kegiatan: jurnal.kegiatan ?? "",
                  metode: jurnal.metode ?? "",
                  media: jurnal.media ?? "",
                  hasil: jurnal.hasil ?? "",
                  kendala: jurnal.kendala ?? "",
                  tindakLanjut: jurnal.tindakLanjut ?? "",
                  catatan: jurnal.catatan ?? "",
                  dokumentasiUrl: jurnal.dokumentasiUrl ?? "",
                  status: jurnal.status,
                }
              : null
          }
          riwayatPengisian={riwayatPengisian}
          kejadian={kejadian.map((k) => ({
            id: k.id,
            siswaId: k.siswaId,
            siswaNama: k.siswa.nama,
            jenis: k.jenis,
            keterangan: k.keterangan,
            dibuatOlehId: k.dibuatOlehId,
          }))}
          userId={user.id}
          bisaHapusSemua={user.role === "ADMIN" || user.role === "SUPERADMIN"}
        />
      )}
    </div>
  );
}
