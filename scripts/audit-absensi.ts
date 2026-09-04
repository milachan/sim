import { prisma } from "../lib/prisma";
import { hitungStatusPertemuan } from "../lib/status";
import { validasiKelengkapanAbsensiHarian } from "../lib/absensi-harian";

const DRY = process.argv.includes("--dry-run");
const FIX = process.argv.includes("--fix");

async function main() {
  console.log(`Mode: ${DRY ? "dry-run" : FIX ? "fix" : "audit"} (gunakan --dry-run atau --fix)\n`);

  const kelasList = await prisma.kelas.findMany({ include: { siswa: { where: { status: "AKTIF", deletedAt: null }, select: { id: true, nama: true, kelasId: true } } } });
  const kelasSiswaMap = new Map(kelasList.map((k) => [k.id, k.siswa.map((s) => s.id)]));
  const siswaKelasMap = new Map<string, string>();
  for (const k of kelasList) for (const s of k.siswa) siswaKelasMap.set(s.id, k.id);

  const absensi = await prisma.absensiHarian.findMany({ include: { item: true, kelas: { select: { nama: true } } } });

  let kurang = 0, kelasLain = 0, duplikat = 0, total = absensi.length;
  const kurangIds: string[] = [];
  for (const a of absensi) {
    const aktif = kelasSiswaMap.get(a.kelasId) ?? [];
    const v = validasiKelengkapanAbsensiHarian(a.item.map((it) => ({ siswaId: it.siswaId, status: it.status })), aktif);
    if (!v.ok) {
      if (v.belum > 0) { kurang++; kurangIds.push(a.id); }
      if (v.siswaLainIds.length) kelasLain++;
      if (v.duplikatIds.length) duplikat++;
      console.log(`AbsensiHarian ${a.id} kelas ${a.kelas.nama} ${a.tanggal.toISOString().slice(0, 10)}: ok=${v.ok} ditandai=${v.ditandai}/${v.total} belum=${v.belum} siswaLain=${v.siswaLainIds.length} duplikat=${v.duplikatIds.length} msg=${v.pesan}`);
    }
  }
  console.log(`\nRingkasan AbsensiHarian: total=${total} kurang=${kurang} siswaLain=${kelasLain} duplikat=${duplikat}`);

  const pertemuan = await prisma.pertemuan.findMany({ include: { jurnal: true, _count: { select: { absensi: true } } } });
  let tertahan = 0, normalisasi = 0, perluTurun = 0;
  const toNormalize: string[] = [];
  for (const p of pertemuan) {
    const baru = hitungStatusPertemuan({ absensiCount: p._count.absensi, jurnalStatus: p.jurnal?.status ?? null, tidakTerlaksana: p.status === "TIDAK_TERLAKSANA" ? true : false });
    if (p.jurnal?.status === "TERKIRIM" && p.status !== "LENGKAP" && baru === "LENGKAP" && p.status !== "TIDAK_TERLAKSANA") {
      tertahan++;
      if (p.status === "JURNAL_TERISI") { normalisasi++; toNormalize.push(p.id); }
    }
    if (FIX && baru !== p.status && p.status !== "TIDAK_TERLAKSANA") {
      const expected = baru;
      if (expected !== p.status) {
        if (p.jurnal?.status === "TERKIRIM" && expected === "LENGKAP") {
          // akan dinormalisasi di bawah
        }
      }
    }
  }
  console.log(`\nPertemuan: total=${pertemuan.length} tertahan hanya karena absensi kosong=${tertahan} yang dapat dinormalisasi JURNAL_TERISI->LENGKAP=${normalisasi}`);

  if (DRY) {
    console.log(`\n[dry-run] ${toNormalize.length} pertemuan akan diubah JURNAL_TERISI -> LENGKAP bila --fix dijalankan.`);
    for (const id of toNormalize.slice(0, 20)) console.log(`  - ${id}`);
    if (toNormalize.length > 20) console.log(`  ... dan ${toNormalize.length - 20} lainnya`);
  }
  if (FIX && toNormalize.length) {
    const res = await prisma.pertemuan.updateMany({ where: { id: { in: toNormalize } }, data: { status: "LENGKAP" } });
    console.log(`\n[fix] Normalisasi selesai: ${res.count} pertemuan diubah menjadi LENGKAP.`);
  }

  if (kurang > 0) console.log(`\nCatatan: ${kurang} record AbsensiHarian tidak lengkap — tandai untuk diperbaiki pengguna/admin. Jangan isi otomatis sebagai HADIR.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
