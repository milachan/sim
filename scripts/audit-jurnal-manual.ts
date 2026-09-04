import { prisma } from "../lib/prisma";
import { mulaiHari } from "../lib/utils";
import { guruIdPertemuan } from "../lib/laporan";

async function audit() {
  const manual = await prisma.pertemuan.findMany({
    where: { sumber: "MANUAL" },
    select: {
      id: true,
      tanggal: true,
      jadwalId: true,
      dibuatOlehId: true,
      jadwal: { select: { guruId: true } },
      dibuatOleh: { select: { guruId: true, nama: true, role: true } },
    },
  });

  const denganJadwal = manual.filter((p) => p.jadwalId);
  const tanpaJadwal = manual.filter((p) => !p.jadwalId);
  const berGuru = tanpaJadwal.filter((p) => guruIdPertemuan({ sumber: "MANUAL", dibuatOleh: p.dibuatOleh }));
  const tanpaGuru = tanpaJadwal.filter((p) => !guruIdPertemuan({ sumber: "MANUAL", dibuatOleh: p.dibuatOleh }));
  const tanpaPembuat = tanpaJadwal.filter((p) => !p.dibuatOlehId);

  console.log(
    JSON.stringify(
      {
        totalJurnalManual: manual.length,
        denganJadwal: denganJadwal.length,
        tanpaJadwalBerhasilDiatribusi: berGuru.length,
        tanpaGuru: tanpaGuru.map((p) => ({ id: p.id, tanggal: mulaiHari(p.tanggal).toISOString().slice(0, 10), dibuatOlehId: p.dibuatOlehId, pembuat: p.dibuatOleh?.nama ?? null })),
        tanpaPembuat: tanpaPembuat.map((p) => ({ id: p.id, tanggal: mulaiHari(p.tanggal).toISOString().slice(0, 10) })),
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