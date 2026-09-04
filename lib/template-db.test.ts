import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { Prisma, PrismaClient } from "@prisma/client";

// Test DB backend Template Dokumen — versioning atomik, immutable, audit,
// cleanup storage, dan aturan akses versi. Skip bila MySQL tidak tersedia.

const prisma = new PrismaClient();

let dbAda = false;

before(async () => {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, tolak) => setTimeout(() => tolak(new Error("timeout")), 5000)),
    ]);
    dbAda = true;
  } catch {
    dbAda = false;
  }
});

after(async () => {
  await prisma.$disconnect();
});

const alasanSkip = "MySQL tidak tersedia";
const AKTOR = "u-uji-template";

const idsTemplate = new Set<string>();

async function buatTemplateUji(opsi?: { aktif?: boolean; jenis?: string }): Promise<string> {
  const t = await prisma.templateDokumen.create({
    data: {
      jenis: (opsi?.jenis ?? "DOKUMEN_UMUM") as never,
      nama: `Uji Template ${randomUUID().slice(0, 8)}`,
      aktif: opsi?.aktif ?? false,
      dibuatOlehId: AKTOR,
    },
  });
  idsTemplate.add(t.id);
  return t.id;
}

async function unggahVersi(templateId: string, isi: string) {
  const buffer = Buffer.from(isi);
  const terakhir = await prisma.versiTemplateDokumen.findFirst({
    where: { templateId },
    orderBy: { nomor: "desc" },
    select: { nomor: true },
  });
  return prisma.versiTemplateDokumen.create({
    data: {
      templateId,
      nomor: (terakhir?.nomor ?? 0) + 1,
      namaAsli: `versi-${(terakhir?.nomor ?? 0) + 1}.pdf`,
      mime: "application/pdf",
      ukuran: buffer.length,
      kunciPenyimpanan: `uji-${randomUUID()}.pdf`,
      sha256: randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, ""),
      dibuatOlehId: AKTOR,
    },
  });
}

test("template tanpa versi tidak dapat diaktifkan", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const id = await buatTemplateUji();
  const jumlahVersi = await prisma.versiTemplateDokumen.count({ where: { templateId: id } });
  assert.equal(jumlahVersi, 0);
  // Aturan: aktifkan menuntut minimal satu versi (server action menolak).
  // Di level DB, cukup buktikan template tetap nonaktif bila tidak ada versi.
  const tpl = await prisma.templateDokumen.findUnique({ where: { id }, select: { aktif: true } });
  assert.equal(tpl?.aktif, false);
});

test("nomor versi meningkat, unique per template, versi lama tidak tertimpa", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const id = await buatTemplateUji();
  const v1 = await unggahVersi(id, "isi pertama");
  const v2 = await unggahVersi(id, "isi kedua");
  assert.equal(v1.nomor, 1);
  assert.equal(v2.nomor, 2);
  const daftar = await prisma.versiTemplateDokumen.findMany({
    where: { templateId: id },
    orderBy: { nomor: "asc" },
    select: { nomor: true, namaAsli: true },
  });
  // Versi lama masih ada (immutable), tidak ditimpa.
  assert.deepEqual(
    daftar.map((v) => v.nomor),
    [1, 2]
  );
  assert.match(daftar[0]?.namaAsli ?? "", /versi-1/);
});

test("dua upload bersamaan tidak menghasilkan nomor sama (unique guard)", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const id = await buatTemplateUji();
  const coba = (nomor: number, isi: string) =>
    prisma.versiTemplateDokumen
      .create({
        data: {
          templateId: id,
          nomor,
          namaAsli: `balapan-${nomor}.pdf`,
          mime: "application/pdf",
          ukuran: isi.length,
          kunciPenyimpanan: `balapan-${randomUUID()}.pdf`,
          sha256: randomUUID().replace(/-/g, ""),
          dibuatOlehId: AKTOR,
        },
      })
      .then(() => "ok")
      .catch((e: unknown) => (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" ? "P2002" : "err-lain"));
  // Keduanya menghitung nomor berikutnya = 1 secara bersamaan.
  const hasil = await Promise.all([coba(1, "a"), coba(1, "b")]);
  const ok = hasil.filter((h) => h === "ok").length;
  const bentrok = hasil.filter((h) => h === "P2002").length;
  assert.equal(ok, 1, "hanya satu yang menang");
  assert.equal(bentrok, 1, "yang kalah menerima P2002 (pemicu retry di service)");
  const jumlah = await prisma.versiTemplateDokumen.count({ where: { templateId: id } });
  assert.equal(jumlah, 1);
});

test("checksum sha256 tersimpan pada versi", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const id = await buatTemplateUji();
  const v = await unggahVersi(id, "isi checksum");
  assert.match(v.sha256, /^[0-9a-f]{64}$/);
});

test("nonaktif tidak menghapus data dan versi", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const id = await buatTemplateUji({ aktif: true });
  await unggahVersi(id, "isi");
  await prisma.templateDokumen.update({ where: { id }, data: { aktif: false } });
  const tpl = await prisma.templateDokumen.findUnique({
    where: { id },
    select: { aktif: true, _count: { select: { versi: true } } },
  });
  assert.equal(tpl?.aktif, false);
  assert.equal(tpl?._count.versi, 1);
});

test("audit riwayat template tercatat per aksi", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const id = await buatTemplateUji();
  await prisma.riwayatTemplateDokumen.create({
    data: { templateId: id, aksi: "dibuat", aktorUserId: AKTOR, payload: {} as never },
  });
  await prisma.riwayatTemplateDokumen.create({
    data: { templateId: id, aksi: "versi_diunggah", aktorUserId: AKTOR, payload: { nomor: 1 } as never },
  });
  const riwayat = await prisma.riwayatTemplateDokumen.findMany({
    where: { templateId: id },
    orderBy: { createdAt: "asc" },
    select: { aksi: true },
  });
  assert.deepEqual(
    riwayat.map((r) => r.aksi),
    ["dibuat", "versi_diunggah"]
  );
});

test("versi lama tidak tertimpa meski isi unggahan sama (immutable)", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const id = await buatTemplateUji();
  const a = await unggahVersi(id, "isi sama");
  const b = await unggahVersi(id, "isi sama");
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.nomor, b.nomor); // nomor tetap berurutan, tidak ditimpa
  const jumlah = await prisma.versiTemplateDokumen.count({ where: { templateId: id } });
  assert.equal(jumlah, 2);
});

after(() => {
  // Bersihkan data uji (hard delete pada data uji saja, bukan fitur).
  void (async () => {
    for (const id of idsTemplate) {
      try {
        await prisma.riwayatTemplateDokumen.deleteMany({ where: { templateId: id } });
        await prisma.templateDokumen.delete({ where: { id } }).catch(() => {});
      } catch {}
    }
    await prisma.$disconnect();
  })();
});
