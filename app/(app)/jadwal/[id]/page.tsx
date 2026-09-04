import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, CalendarDays, ClipboardCheck, Plus, User as UserIcon, Clock } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, InfoRow, PageHeader } from "@/components/ui";
import { PertemuanBadge } from "@/components/status-badge";
import { sinkronkanPertemuan } from "@/lib/pertemuan";
import { formatTanggal, mulaiHari } from "@/lib/utils";
import { apakahJamUpacara, HARI_LABEL, rentangJam, SUMBER_PERTEMUAN_LABEL } from "@/lib/constants";
import { UpacaraBadge } from "@/components/status-badge";
import { bolehBacaJadwal, bolehKelolaJadwal } from "@/lib/otorisasi";

export const dynamic = "force-dynamic";

export default async function DetailJadwal({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tampilan?: string; guru?: string; kelas?: string };
}) {
  const user = await getCurrentUser();

  // Bawa balik filter dari halaman /jadwal (Per Guru / Per Kelas) agar
  // tombol "Kembali" tidak kehilangan pilihan guru/kelas yang sedang dilihat.
  const backQuery = new URLSearchParams();
  if (searchParams.tampilan) backQuery.set("tampilan", searchParams.tampilan);
  if (searchParams.guru) backQuery.set("guru", searchParams.guru);
  if (searchParams.kelas) backQuery.set("kelas", searchParams.kelas);
  const hrefKembali = backQuery.toString() ? `/jadwal?${backQuery.toString()}` : "/jadwal";

  // Otorisasi sebelum data sensitif lengkap diambil: hanya ambil guru pemilik
  // jadwal untuk memutuskan siapa yang boleh membaca.
  const cekJadwal = await prisma.jadwal.findUnique({
    where: { id: params.id },
    select: { guruId: true },
  });
  if (!cekJadwal) notFound();
  if (!bolehBacaJadwal(user, cekJadwal.guruId)) notFound();
  const bolehKelola = bolehKelolaJadwal(user, cekJadwal.guruId);

  const jadwal = await prisma.jadwal.findUnique({
    where: { id: params.id },
    include: { guru: true, kelas: true, mapel: true, semester: { include: { tahunAjaran: true } }, pertemuan: { include: { jurnal: true, _count: { select: { absensi: true } } }, orderBy: { tanggal: "desc" } } },
  });
  if (!jadwal) notFound();

  // Sinkronkan pertemuan jadwal ini sampai hari ini (backfill idempoten, termasuk
  // pembuatan pertemuan hari ini bila hari ini memang jadwalnya). Aman dipanggil
  // berulang; tidak mengubah tanggal Minggu/masa depan/libur.
  const hariIni = mulaiHari();
  if (bolehKelola) {
    await sinkronkanPertemuan({ jadwalId: jadwal.id, sampai: hariIni });
  }
  const pertemuanList = await prisma.pertemuan.findMany({
    where: { jadwalId: jadwal.id },
    include: { jurnal: true, _count: { select: { absensi: true } } },
    orderBy: { tanggal: "desc" },
  });
  const hariIniAda = pertemuanList.some((p) => p.tanggal.getTime() === hariIni.getTime());

  const rentangJadwal = rentangJam(jadwal.hari, jadwal.jamKeMulai, jadwal.jamKeSelesai);

  const kegiatan = await prisma.penilaianKegiatan.findMany({
    where: { jadwalId: jadwal.id },
    include: { _count: { select: { nilai: true } } },
    orderBy: { tanggal: "desc" },
  });

  return (
    <div className="fade-up">
      <Link href={hrefKembali} className="btn-ghost btn-sm mb-4">
        <ArrowLeft className="h-4 w-4" /> Kembali ke jadwal
      </Link>

      <PageHeader title={`${jadwal.mapel.nama} — ${jadwal.kelas.nama}`} icon={<CalendarDays className="h-6 w-6" />}
        actions={
          bolehKelola && (
            <>
              <Link href={`/nilai/baru?jadwal=${jadwal.id}`} className="btn-secondary">
                <Plus className="h-4 w-4" /> Kegiatan Penilaian
              </Link>
              {hariIniAda && (
                <Link href={`/pertemuan/${jadwal.pertemuan[0]?.id ?? ""}`} className="btn-primary">
                  <ClipboardCheck className="h-4 w-4" /> Buka Pertemuan
                </Link>
              )}
            </>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card className="card-pad">
            <h3 className="mb-2 font-extrabold text-slate-900">Detail Jadwal</h3>
            <InfoRow label="Guru" value={<span className="inline-flex items-center gap-1"><UserIcon className="h-4 w-4 text-emerald-600" />{jadwal.guru.nama}</span>} />
            <InfoRow label="Hari" value={HARI_LABEL[jadwal.hari]} />
            <InfoRow
              label="Jam Pelajaran"
              value={
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-4 w-4 text-emerald-600" />
                  Ke-{jadwal.jamKeMulai} – ke-{jadwal.jamKeSelesai}
                  {rentangJadwal ? ` · ${rentangJadwal}` : ""}
                  {apakahJamUpacara(jadwal.hari, jadwal.jamKeMulai) && (
                    <span className="ml-1">
                      <UpacaraBadge />
                    </span>
                  )}
                </span>
              }
            />
            <InfoRow label="Semester" value={`${jadwal.semester.nama} ${jadwal.semester.tahunAjaran.nama}`} />
          </Card>

          <Card className="card-pad">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900">Penilaian</h3>
              <span className="chip bg-violet-100 text-violet-700">{kegiatan.length} kegiatan</span>
            </div>
            {kegiatan.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Belum ada kegiatan penilaian untuk mapel ini.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {kegiatan.map((k) => (
                  <Link key={k.id} href={`/nilai/${k.id}`} className="block rounded-xl border border-slate-200 px-3 py-2.5 text-sm transition hover:border-violet-300 hover:bg-violet-50/50">
                    <p className="font-bold text-slate-800">{k.judul}</p>
                    <p className="text-xs text-slate-500">{formatTanggal(k.tanggal)} · {k._count.nilai} siswa dinilai</p>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="flex items-center gap-2 font-extrabold text-slate-900">
                <BookOpen className="h-5 w-5 text-emerald-600" /> Riwayat Pertemuan
              </h3>
              <span className="chip self-start bg-slate-100 text-slate-600 sm:self-auto">{pertemuanList.length} pertemuan</span>
            </div>

            {pertemuanList.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Belum ada pertemuan" desc="Pertemuan akan otomatis tercatat saat hari mengajar tiba." />
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pertemuanList.map((p) => (
                  <Link key={p.id} href={`/pertemuan/${p.id}`} className="group flex items-center gap-3 px-5 py-4 transition hover:bg-emerald-50/50 sm:gap-4">
                    <div className="flex h-11 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-50 ring-1 ring-inset ring-slate-200 sm:w-16">
                      <span className="text-base font-extrabold leading-none text-slate-800">{formatTanggal(p.tanggal, "d")}</span>
                      <span className="mt-0.5 text-[10px] font-bold uppercase text-slate-400">{formatTanggal(p.tanggal, "MMM")}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 break-words font-bold text-slate-900">
                        Pertemuan ke-{p.pertemuanKe}
                        <span className="chip bg-slate-100 text-slate-500">{SUMBER_PERTEMUAN_LABEL[p.sumber]}</span>
                        {p.sumber === "MANUAL" && p.alasanManual && (
                          <span className="hidden break-words text-xs font-normal text-slate-500 sm:inline">— {p.alasanManual}</span>
                        )}
                      </p>
                      <p className="break-words text-xs text-slate-500">
                        Absensi: {p._count.absensi} siswa · {p.jurnal ? `Jurnal: ${p.jurnal.status === "TERKIRIM" ? "terkirim" : "belum dikirim"}` : "jurnal belum diisi"}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <PertemuanBadge status={p.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
