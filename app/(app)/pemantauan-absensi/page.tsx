import { ClipboardCheck, Info } from "lucide-react";
import { format } from "date-fns";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { Card, EmptyState, PageHeader, StatCard, TableRow, TableShell, Td, Th } from "@/components/ui";
import { BarChartVertikal, DonutChart } from "@/components/charts";
import {
  jamPembukaHari,
  STATUS_ABSENSI_HARIAN_BADGE,
  STATUS_ABSENSI_HARIAN_LABEL,
  type StatusAbsensiHarian,
} from "@/lib/constants";
import { formatTanggal, mulaiHari, persen } from "@/lib/utils";
import { hariDariTanggal } from "@/lib/absensi-harian";

export const dynamic = "force-dynamic";

const WARNA_STATUS: Record<StatusAbsensiHarian, string> = {
  BELUM_DIISI: "#94a3b8",
  GURU_JAM_PERTAMA: "#059669",
  GURU_PIKET: "#f59e0b",
  WALI_KELAS: "#8b5cf6",
};

export default async function PemantauanAbsensiPage({
  searchParams,
}: {
  searchParams: { tanggal?: string };
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const isGuru = user.role === "GURU" || (user.role === "WAKA" && !!user.guruId);
  const waliKelas = user.guru?.waliKelas ?? [];
  const isWaliKelas = isGuru && waliKelas.length > 0;

  // Guru (bukan wali kelas) hanya bisa mengisi, bukan memantau kelas lain.
  if (isGuru && !isWaliKelas) {
    return (
      <div className="fade-up">
        <PageHeader
          title="Pemantauan Absensi Harian"
          subtitle="Grafik kelengkapan absensi harian kelas"
          icon={<ClipboardCheck className="h-6 w-6" />}
        />
        <EmptyState
          title="Menu ini khusus wali kelas"
          desc="Pemantauan absensi harian tersedia untuk wali kelas (kelas yang Anda walikan) serta Waka dan Kepala Madrasah."
        />
      </div>
    );
  }

  let tanggal = mulaiHari();
  if (searchParams.tanggal) {
    const coba = mulaiHari(searchParams.tanggal);
    if (!Number.isNaN(coba.getTime())) tanggal = coba;
  }
  const tanggalStr = format(tanggal, "yyyy-MM-dd");

  // Kelas yang boleh dilihat: wali kelas → kelas walinya; Waka/Kamad/Admin → semua.
  const whereKelas: Prisma.KelasWhereInput =
    isGuru && waliKelas.length > 0
      ? { id: { in: waliKelas.map((k) => k.id) } }
      : { siswa: { some: { status: "AKTIF" as const, deletedAt: null } } };
  const awalTren = new Date(tanggal);
  awalTren.setDate(awalTren.getDate() - 13);

  const [kelasList, absensi] = await Promise.all([
    prisma.kelas.findMany({
      where: whereKelas,
      include: {
        jadwal: {
          where: { semester: { aktif: true } },
          orderBy: [{ jamKeMulai: "asc" }, { id: "asc" }],
          include: { guru: true, mapel: true },
        },
      },
      orderBy: [{ tingkat: "asc" }, { nama: "asc" }],
    }),
    prisma.absensiHarian.findMany({
      where: {
        tanggal: { gte: awalTren, lte: tanggal },
        ...(isGuru ? { kelasId: { in: waliKelas.map((k) => k.id) } } : {}),
      },
      include: { pengisi: true },
    }),
  ]);

  const key = (kelasId: string, t: Date) => `${kelasId}|${format(t, "yyyy-MM-dd")}`;
  const byKey = new Map(absensi.map((a) => [key(a.kelasId, a.tanggal), a]));

  // Tren 14 hari terakhir: % kelas berjalan yang sudah terisi absensi hariannya.
  const hariTerakhir: Date[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(tanggal);
    d.setDate(d.getDate() - i);
    hariTerakhir.push(mulaiHari(d));
  }
  const tren = hariTerakhir.map((d) => {
    const hari = hariDariTanggal(d);
    const berjalan = kelasList.filter((k) => hari && k.jadwal.some((j) => j.hari === hari));
    const terisi = berjalan.filter((k) => byKey.has(key(k.id, d)));
    const hariShort = formatTanggal(d, "EEE").slice(0, 3);
    const tglShort = `${d.getDate()}/${d.getMonth() + 1}`;
    return {
      label: `${hariShort}\n${tglShort}`,
      shortLabel: `${hariShort}\n${tglShort}`,
      nilai: berjalan.length ? Math.round((terisi.length / berjalan.length) * 100) : 0,
      sub: berjalan.length ? `${terisi.length}/${berjalan.length}` : "-",
    };
  });

  // Status per kelas pada tanggal terpilih (kelas berjalan hari itu saja).
  const hariIni = hariDariTanggal(tanggal);
  const barisKelas = kelasList
    .filter((k) => hariIni && k.jadwal.some((j) => j.hari === hariIni))
    .map((k) => {
      const record = byKey.get(key(k.id, tanggal));
      const status: StatusAbsensiHarian = record ? record.peranPengisi : "BELUM_DIISI";
      // Guru jam pertama = pemegang jadwal pada jam pembuka tanggal terpilih.
      const jp = hariIni
        ? k.jadwal.find((j) => j.hari === hariIni && j.jamKeMulai === jamPembukaHari(hariIni))
        : undefined;
      return { kelas: k, jp, status, record };
    });

  const donut = (Object.keys(WARNA_STATUS) as StatusAbsensiHarian[]).map((s) => ({
    label: STATUS_ABSENSI_HARIAN_LABEL[s],
    nilai: barisKelas.filter((b) => b.status === s).length,
    warna: WARNA_STATUS[s],
  }));
  const totalTerisi = barisKelas.filter((b) => b.status !== "BELUM_DIISI").length;

  return (
    <div className="fade-up">
      <PageHeader
        title="Pemantauan Absensi Harian"
        subtitle={`Kelengkapan absensi harian kelas · ${formatTanggal(tanggal)}`}
        icon={<ClipboardCheck className="h-6 w-6" />}
      />

      {/* Pilih tanggal */}
      <Card className="card-pad mb-6">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Tanggal</label>
            <input
              type="date"
              name="tanggal"
              className="input"
              defaultValue={tanggalStr}
              max={format(new Date(), "yyyy-MM-dd")}
            />
          </div>
          <button className="btn-primary btn-sm">Tampilkan</button>
        </form>
        <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Absensi harian wajib diisi guru jam pertama tiap kelas; wali kelas & guru piket boleh mengisi/mengubah saat perlu.
          {isWaliKelas && " Halaman ini hanya menampilkan kelas yang Anda walikan."}
        </p>
      </Card>

      {!hariIni ? (
        <Card className="card-pad">
          <EmptyState title="Tidak ada kegiatan pada tanggal ini" desc="Pilih tanggal lain untuk melihat pemantauan absensi." />
        </Card>
      ) : (
        <>
          {/* Statistik ringkas */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Kelas Berjalan" value={barisKelas.length} sub={`jadwal pada ${formatTanggal(tanggal)}`} icon={<ClipboardCheck className="h-6 w-6" />} />
            <StatCard label="Sudah Diisi" value={totalTerisi} sub="guru jam 1 / piket" color="bg-emerald-600" icon={<ClipboardCheck className="h-6 w-6" />} />
            <StatCard
              label="Kelengkapan"
              value={barisKelas.length ? `${persen(totalTerisi, barisKelas.length)}%` : "-"}
              sub="kelas berjalan terisi"
              color="bg-teal-600"
              icon={<ClipboardCheck className="h-6 w-6" />}
            />
            <StatCard
              label="Belum Diisi"
              value={barisKelas.filter((b) => b.status === "BELUM_DIISI").length}
              sub="menunggu guru jam pertama / piket"
              color="bg-rose-500"
              icon={<ClipboardCheck className="h-6 w-6" />}
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            {/* Tren 14 hari */}
            <Card className="card-pad min-w-0">
              <h2 className="font-extrabold text-slate-900">Tren Kelengkapan 14 Hari</h2>
              <p className="mt-0.5 text-xs text-slate-500">% kelas berjalan yang absensi hariannya sudah diisi</p>
              <div className="mt-5">
                <BarChartVertikal data={tren} color="#059669" format={(v) => `${v}%`} />
              </div>
            </Card>

            {/* Donut status */}
            <Card className="card-pad min-w-0">
              <h2 className="font-extrabold text-slate-900">Status per Kelas</h2>
              <p className="mt-0.5 text-xs text-slate-500">Distribusi pengisi absensi harian pada tanggal terpilih</p>
              <div className="mt-4">
                <DonutChart data={donut} size={170} />
              </div>
            </Card>
          </div>

          {/* Tabel per kelas */}
          <Card className="mt-6 overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-extrabold text-slate-900">Rincian per Kelas</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {formatTanggal(tanggal)} · kelas berjalan hari ini
              </p>
            </div>
            {barisKelas.length === 0 ? (
              <div className="p-5">
                <EmptyState title="Tidak ada kelas berjalan" desc="Tidak ada jadwal pelajaran untuk kelas mana pun pada tanggal ini." />
              </div>
            ) : (
              <TableShell>
                <thead>
                  <tr>
                    <Th>Kelas</Th>
                    <Th>Guru Jam Pertama</Th>
                    <Th>Status</Th>
                    <Th>Terakhir Diisi</Th>
                  </tr>
                </thead>
                <tbody>
                  {barisKelas.map((b) => (
                    <TableRow key={b.kelas.id}>
                      <Td className="font-bold text-slate-900">
                        {b.kelas.nama}
                        <span className="ml-2 text-xs font-semibold text-slate-400">Kls {b.kelas.tingkat}</span>
                      </Td>
                      <Td>
                        {b.jp ? (
                          <>
                            <span className="font-semibold">{b.jp.guru.nama}</span>
                            <span className="block text-xs text-slate-400">{b.jp.mapel.nama}</span>
                          </>
                        ) : (
                          <span className="text-slate-400">Tanpa guru jam pertama</span>
                        )}
                      </Td>
                      <Td>
                        <span className={`chip ${STATUS_ABSENSI_HARIAN_BADGE[b.status]}`}>{STATUS_ABSENSI_HARIAN_LABEL[b.status]}</span>
                      </Td>
                      <Td className="text-slate-500">{b.record ? b.record.pengisi.nama : "—"}</Td>
                    </TableRow>
                  ))}
                </tbody>
              </TableShell>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
