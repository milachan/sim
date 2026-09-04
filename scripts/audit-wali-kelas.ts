import { prisma } from "../lib/prisma";
import { mulaiHari } from "../lib/utils";

async function audit() {
  const [riwayat, kelasList] = await Promise.all([
    prisma.waliKelasRiwayat.findMany({
      orderBy: [{ kelasId: "asc" }, { mulai: "asc" }],
    }),
    prisma.kelas.findMany({ orderBy: { nama: "asc" } }),
  ]);

  const tanpaSemester = riwayat.filter((r) => !r.semesterId);
  const tanpaMulai = riwayat.filter((r) => !r.mulai);
  const byKelas = new Map<string, typeof riwayat>();
  for (const r of riwayat) {
    const list = byKelas.get(r.kelasId) ?? [];
    list.push(r);
    byKelas.set(r.kelasId, list);
  }

  const gandaAktif: { kelasId: string; rows: string[] }[] = [];
  const tumpangTindih: { kelasId: string; rows: string[] }[] = [];
  for (const [kelasId, rows] of byKelas) {
    const aktif = rows.filter((r) => r.selesai === null);
    if (aktif.length > 1) {
      gandaAktif.push({ kelasId, rows: aktif.map((r) => `${r.guruId} (mulai ${mulaiHari(r.mulai).toISOString().slice(0, 10)})`) });
    }
    const urut = [...rows].sort((a, b) => a.mulai.getTime() - b.mulai.getTime());
    for (let i = 1; i < urut.length; i++) {
      const prev = urut[i - 1];
      const cur = urut[i];
      if (prev.selesai && prev.selesai.getTime() >= cur.mulai.getTime()) {
        tumpangTindih.push({
          kelasId,
          rows: [`${prev.guruId} [${mulaiHari(prev.mulai).toISOString().slice(0, 10)}–${mulaiHari(prev.selesai).toISOString().slice(0, 10)}] overlaps ${cur.guruId} [${mulaiHari(cur.mulai).toISOString().slice(0, 10)}–${cur.selesai ? mulaiHari(cur.selesai).toISOString().slice(0, 10) : "sekarang"}]`],
        });
      }
    }
  }

  const kelasTanpaRiwayat = kelasList.filter((k) => !byKelas.has(k.id) || byKelas.get(k.id)!.length === 0);

  console.log(
    JSON.stringify(
      {
        totalRiwayat: riwayat.length,
        tanpaSemester: tanpaSemester.map((r) => ({ kelasId: r.kelasId, guruId: r.guruId })),
        tanpaSelesai: riwayat.filter((r) => r.selesai === null).map((r) => ({ kelasId: r.kelasId, guruId: r.guruId, mulai: mulaiHari(r.mulai).toISOString().slice(0, 10) })),
        tanpaMulai: tanpaMulai.map((r) => ({ kelasId: r.kelasId, guruId: r.guruId })),
        gandaAktif,
        tumpangTindih,
        kelasTanpaRiwayat: kelasTanpaRiwayat.map((k) => ({ id: k.id, nama: k.nama, waliKelasId: k.waliKelasId })),
      },
      null,
      2
    )
  );
}

audit().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});