import { prisma } from "./prisma";
import { persen } from "./utils";
import { mulaiHari } from "./utils";
import { hariDariTanggal } from "./absensi-harian";
import { rencanaPertemuanOtomatis } from "./pertemuan";
import type { Prisma } from "@prisma/client";

export type StatistikBulanan = {
  totalPertemuan: number;
  lengkap: number;
  persenLengkap: number;
  tanpaJurnal: number;
  manual: number;
  tidakTerlaksana: number;
  perGuru: {
    guruId: string;
    nama: string;
    total: number;
    lengkap: number;
    persen: number;
  }[];
  slotBelumTerbentuk: number;
};

export type PertemuanUntukAtribusi = {
  status?: string | null;
  sumber?: string | null;
  jadwal?: { guruId?: string | null; guru?: { nama?: string } | null } | null;
  dibuatOleh?: { guruId?: string | null; nama?: string | null } | null;
  jurnal?: { status?: string | null } | null;
};

export function guruIdPertemuan(p: PertemuanUntukAtribusi): string | null {
  if (p?.jadwal?.guruId) return p.jadwal.guruId;
  if (p?.sumber === "MANUAL") {
    return p.dibuatOleh?.guruId ?? null;
  }
  return null;
}

export function namaGuruPertemuan(p: PertemuanUntukAtribusi): string | null {
  if (p?.jadwal?.guru?.nama) return p.jadwal.guru.nama;
  if (p?.sumber === "MANUAL") return p.dibuatOleh?.nama ?? null;
  return null;
}

export function wherePertemuanGuru(guruId: string): Prisma.PertemuanWhereInput {
  return {
    OR: [{ jadwal: { guruId } }, { sumber: "MANUAL", dibuatOleh: { guruId } }],
  };
}

export function wherePertemuanGuruAkun(guruId: string, userId: string): Prisma.PertemuanWhereInput {
  return {
    OR: [{ jadwal: { guruId } }, { dibuatOlehId: userId }],
  };
}

export function hitungKelengkapanPerGuru(
  pertemuan: PertemuanUntukAtribusi[],
  guruList: { id: string; nama: string }[]
): { guruId: string; nama: string; total: number; lengkap: number; persen: number; manual: number }[] {
  const stats = new Map<string, { total: number; lengkap: number; manual: number }>();
  for (const p of pertemuan) {
    if (p?.status === "TIDAK_TERLAKSANA") continue;
    const guruId = guruIdPertemuan(p);
    if (!guruId) continue;
    const s = stats.get(guruId) ?? { total: 0, lengkap: 0, manual: 0 };
    s.total += 1;
    if (p?.status === "LENGKAP") s.lengkap += 1;
    if (p?.sumber === "MANUAL") s.manual += 1;
    stats.set(guruId, s);
  }
  return guruList.map((g) => {
    const s = stats.get(g.id) ?? { total: 0, lengkap: 0, manual: 0 };
    return {
      guruId: g.id,
      nama: g.nama,
      total: s.total,
      lengkap: s.lengkap,
      persen: persen(s.lengkap, s.total),
      manual: s.manual,
    };
  });
}

export async function statistikBulanan(bulan: string): Promise<StatistikBulanan> {
  const [tahun, bulanNum] = bulan.split("-").map(Number);
  const start = mulaiHari(new Date(Date.UTC(tahun, bulanNum - 1, 1)));
  const end = mulaiHari(new Date(Date.UTC(tahun, bulanNum, 0)));
  const endInclusive = new Date(end);
  endInclusive.setUTCDate(endInclusive.getUTCDate() + 1);
  endInclusive.setUTCMilliseconds(-1);
  const sampaiHariIni = mulaiHari(new Date());

  const batasAkhir = end < sampaiHariIni ? end : sampaiHariIni;

  const [semesters, jadwals, libur, existingSlots, pertemuan, guruList] = await Promise.all([
    prisma.semester.findMany({ where: { deletedAt: null }, select: { id: true, tahunAjaranId: true, mulai: true, selesai: true } }),
    prisma.jadwal.findMany({ select: { id: true, semesterId: true, hari: true } }),
    prisma.kalenderAkademik.findMany({ where: { tipe: "LIBUR" }, select: { tanggal: true, tahunAjaranId: true } }),
    prisma.pertemuan.findMany({ where: { sumber: "OTOMATIS", jadwalId: { not: null } }, select: { jadwalId: true, tanggal: true, sumber: true, id: true, pertemuanKe: true } }),
    prisma.pertemuan.findMany({
      where: { tanggal: { gte: start, lte: endInclusive } },
      include: {
        jadwal: { include: { guru: true } },
        dibuatOleh: { select: { id: true, nama: true, guruId: true } },
        jurnal: true,
        _count: { select: { absensi: true } },
      },
    }),
    prisma.guru.findMany({ where: { status: true, deletedAt: null }, orderBy: { nama: "asc" } }),
  ]);

  const rencana = rencanaPertemuanOtomatis({
    semesters: semesters.filter((s) => s.mulai && s.selesai) as never,
    jadwals,
    libur,
    existing: existingSlots as never,
    sampai: batasAkhir,
    namaHari: (d) => hariDariTanggal(d),
  });

  const slotBelumTerbentuk = rencana.buat.filter((x) => x.tanggal >= start && x.tanggal <= endInclusive).length;

  const aktif = pertemuan.filter((p) => p.status !== "TIDAK_TERLAKSANA");
  const lengkap = aktif.filter((p) => p.status === "LENGKAP").length;
  const perGuru = hitungKelengkapanPerGuru(
    aktif,
    guruList.map((g) => ({ id: g.id, nama: g.nama }))
  );

  const totalPertemuan = aktif.length + slotBelumTerbentuk;

  return {
    totalPertemuan,
    lengkap,
    persenLengkap: persen(lengkap, totalPertemuan),
    tanpaJurnal: aktif.filter((p) => !p.jurnal).length + slotBelumTerbentuk,
    manual: aktif.filter((p) => p.sumber === "MANUAL").length,
    tidakTerlaksana: pertemuan.length - aktif.length,
    slotBelumTerbentuk,
    perGuru: perGuru.map(({ guruId, nama, total, lengkap, persen: p }) => ({ guruId, nama, total, lengkap, persen: p })),
  };
}
