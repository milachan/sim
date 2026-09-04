import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function ekstensi(nama) {
  return String(nama ?? "").split(".").pop()?.toLowerCase() ?? "";
}

function evaluasi(v) {
  if (!v) return "TANPA_VERSI";
  if (!v.kunciPenyimpanan) return "TANPA_FILE";
  if (ekstensi(v.namaAsli) !== "pdf" || v.mime !== "application/pdf") return "BUKAN_PDF";
  if (!v.sha256) return "TANPA_CHECKSUM";
  return "OK";
}

try {
  const dokumen = await prisma.dokumen.findMany({
    where: { status: "DISETUJUI" },
    select: { id: true, judul: true, versiAktif: true },
  });

  const bermasalah = [];
  for (const d of dokumen) {
    const versi = await prisma.versiDokumen.findMany({
      where: { dokumenId: d.id },
      orderBy: { nomor: "desc" },
      take: 1,
      select: { id: true, nomor: true, namaAsli: true, mime: true },
    });
    const terbaru = versi[0] ?? null;
    const status = evaluasi(terbaru);
    if (status !== "OK") {
      bermasalah.push({
        id: d.id,
        judul: d.judul,
        nomorVersiTerbaru: terbaru?.nomor ?? null,
        ekstensi: terbaru ? ekstensi(terbaru.namaAsli) : null,
        mime: terbaru?.mime ?? null,
        alasan: status,
      });
    }
  }

  console.log(JSON.stringify({ totalDisetujui: dokumen.length, jumlahBermasalah: bermasalah.length, detail: bermasalah }, null, 2));
} finally {
  await prisma.$disconnect();
}
