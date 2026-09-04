import { prisma } from "./prisma";
import { mulaiHari } from "./utils";
import { statistikBulanan } from "./laporan";
import { namaGuruPertemuan } from "./laporan";

export async function hitungRingkasanWaka(bulan: string) {
  const stat = await statistikBulanan(bulan);
  const [tahun, bulanNum] = bulan.split("-").map(Number);
  const start = mulaiHari(new Date(Date.UTC(tahun, bulanNum - 1, 1)));
  const end = mulaiHari(new Date(Date.UTC(tahun, bulanNum, 0)));
  const endInclusive = new Date(end);
  endInclusive.setUTCDate(endInclusive.getUTCDate() + 1);
  endInclusive.setUTCMilliseconds(-1);

  const pertemuan = await prisma.pertemuan.findMany({
    where: { tanggal: { gte: start, lte: endInclusive }, jurnal: null, status: { not: "TIDAK_TERLAKSANA" } },
    include: { jadwal: { include: { kelas: true, mapel: true, guru: true } }, kelas: true, mapel: true, dibuatOleh: { select: { nama: true, guruId: true } } },
    orderBy: { tanggal: "desc" },
    take: 10,
  });

  const detail = pertemuan.map((p) => ({
    id: p.id,
    tanggal: p.tanggal,
    pertemuanKe: p.pertemuanKe,
    sumber: p.sumber,
    kelasNama: p.kelas?.nama ?? p.jadwal?.kelas?.nama ?? "-",
    mapelNama: p.mapel?.nama ?? p.jadwal?.mapel?.nama ?? "-",
    guruNama: namaGuruPertemuan(p) ?? "-",
  }));

  return {
    total: stat.totalPertemuan,
    lengkap: stat.lengkap,
    tanpaJurnal: stat.tanpaJurnal,
    manual: stat.manual,
    slotBelumTerbentuk: stat.slotBelumTerbentuk,
    perGuru: stat.perGuru,
    tanpaJurnalDetail: detail,
  };
}
