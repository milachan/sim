import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { Prisma, PrismaClient } from "@prisma/client";

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

const alasanSkip = "MySQL tidak tersedia";

function errPrisma(e: unknown): { code: string } | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError) return { code: e.code };
  return null;
}

function kodeUnik(): string {
  return randomUUID().replace(/-/g, "").toUpperCase().slice(0, 16);
}

const idsDokumen = new Set<string>();

async function buatDokumenUji(opsi?: { jumlahVersi?: number }): Promise<{ dokumenId: string; versiIds: string[] }> {
  const jumlahVersi = opsi?.jumlahVersi ?? 1;
  const dok = await prisma.dokumen.create({
    data: { jenis: "PROPOSAL", judul: `Uji ikatan final ${randomUUID()}`, status: "DISETUJUI", pengajuUserId: "u-uji-final" },
  });
  idsDokumen.add(dok.id);
  const versiIds: string[] = [];
  for (let nomor = 1; nomor <= jumlahVersi; nomor++) {
    const v = await prisma.versiDokumen.create({
      data: {
        dokumenId: dok.id,
        nomor,
        judul: dok.judul,
        dibuatOlehUserId: "u-uji-final",
        namaAsli: `versi-${nomor}.pdf`,
        mime: "application/pdf",
        ukuran: 1000 + nomor,
        kunciPenyimpanan: `uji/${dok.id}-${nomor}.pdf`,
        sha256: kodeUnik() + kodeUnik(),
      },
    });
    versiIds.push(v.id);
  }
  return { dokumenId: dok.id, versiIds };
}

before(async () => {
  if (!dbAda) return;
});

after(async () => {
  const ids = [...idsDokumen];
  if (ids.length > 0) {
    await prisma.dokumenFinal.deleteMany({ where: { dokumenId: { in: ids } } });
    await prisma.versiDokumen.deleteMany({ where: { dokumenId: { in: ids } } });
    await prisma.dokumen.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.$disconnect();
});

test("struktur DB: FK versiId RESTRICT, unique index versiId, kolom wajib", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const fk = await prisma.$queryRaw<Array<{ CONSTRAINT_NAME: string; DELETE_RULE: string }>>`
    SELECT rc.CONSTRAINT_NAME, rc.DELETE_RULE
    FROM information_schema.REFERENTIAL_CONSTRAINTS rc
    JOIN information_schema.TABLE_CONSTRAINTS tc ON tc.CONSTRAINT_NAME = rc.CONSTRAINT_NAME AND tc.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
    WHERE rc.CONSTRAINT_SCHEMA = DATABASE() AND rc.TABLE_NAME = 'DokumenFinal' AND rc.CONSTRAINT_NAME = 'DokumenFinal_versiId_fkey'`;
  assert.equal(fk.length, 1);
  assert.equal(fk[0].DELETE_RULE, "RESTRICT");

  const idx = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*) AS n FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'DokumenFinal' AND INDEX_NAME = 'DokumenFinal_versiId_key' AND NON_UNIQUE = 0`;
  assert.equal(Number(idx[0].n) >= 1, true);

  const kolom = await prisma.$queryRaw<Array<{ IS_NULLABLE: string }>>`
    SELECT IS_NULLABLE FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'DokumenFinal' AND COLUMN_NAME = 'versiId'`;
  assert.equal(kolom[0].IS_NULLABLE, "NO");
});

test("FK versiId: record final tidak dapat menunjuk versi yang tidak ada", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const { dokumenId, versiIds } = await buatDokumenUji();
  let tertangkap: { code: string } | null = null;
  try {
    await prisma.dokumenFinal.create({
      data: {
        dokumenId,
        versiId: "versi-tidak-ada",
        nomorVersi: 1,
        sha256: "x",
        ukuran: 1,
        mime: "application/pdf",
        namaAsli: "a.pdf",
        kodeVerifikasi: kodeUnik(),
        difinalkanOlehId: "u-uji-final",
      },
    });
  } catch (e) {
    tertangkap = errPrisma(e);
  }
  assert.equal(tertangkap?.code, "P2003");
  assert.notEqual(versiIds.length, 0);
});

test("satu VersiDokumen tidak dapat menghasilkan dua DokumenFinal", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const a = await buatDokumenUji();
  const b = await buatDokumenUji();
  const versiBersama = a.versiIds[0];

  await prisma.dokumenFinal.create({
    data: {
      dokumenId: a.dokumenId,
      versiId: versiBersama,
      nomorVersi: 1,
      sha256: "x",
      ukuran: 1,
      mime: "application/pdf",
      namaAsli: "a.pdf",
      kodeVerifikasi: kodeUnik(),
      difinalkanOlehId: "u-uji-final",
    },
  });

  let tertangkap: { code: string } | null = null;
  try {
    await prisma.dokumenFinal.create({
      data: {
        dokumenId: b.dokumenId,
        versiId: versiBersama,
        nomorVersi: 1,
        sha256: "x",
        ukuran: 1,
        mime: "application/pdf",
        namaAsli: "b.pdf",
        kodeVerifikasi: kodeUnik(),
        difinalkanOlehId: "u-uji-final",
      },
    });
  } catch (e) {
    tertangkap = errPrisma(e);
  }
  assert.equal(tertangkap?.code, "P2002");

  const jumlah = await prisma.dokumenFinal.count({ where: { versiId: versiBersama } });
  assert.equal(jumlah, 1);
});

test("versi yang sudah menjadi final tidak dapat dihapus (RESTRICT)", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const { dokumenId, versiIds } = await buatDokumenUji({ jumlahVersi: 2 });
  const versiFinal = versiIds[1];
  await prisma.dokumenFinal.create({
    data: {
      dokumenId,
      versiId: versiFinal,
      nomorVersi: 2,
      sha256: "x",
      ukuran: 1002,
      mime: "application/pdf",
      namaAsli: "versi-2.pdf",
      kodeVerifikasi: kodeUnik(),
      difinalkanOlehId: "u-uji-final",
    },
  });

  let tertangkap: { code: string } | null = null;
  try {
    await prisma.versiDokumen.delete({ where: { id: versiFinal } });
  } catch (e) {
    tertangkap = errPrisma(e);
  }
  assert.equal(tertangkap?.code, "P2003");
  const masihAda = await prisma.versiDokumen.findUnique({ where: { id: versiFinal } });
  assert.ok(masihAda);

  const versiLama = versiIds[0];
  await prisma.versiDokumen.delete({ where: { id: versiLama } });
  assert.equal(await prisma.versiDokumen.findUnique({ where: { id: versiLama } }), null);
});

test("record final lama tetap valid setelah migrasi dan idempotent-read mempertahankan versiId", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const { dokumenId, versiIds } = await buatDokumenUji({ jumlahVersi: 2 });
  const versi = await prisma.versiDokumen.findUniqueOrThrow({ where: { id: versiIds[1] } });
  const kode = kodeUnik();
  await prisma.dokumenFinal.create({
    data: {
      dokumenId,
      versiId: versi.id,
      nomorVersi: versi.nomor,
      sha256: versi.sha256 ?? "",
      ukuran: versi.ukuran ?? 0,
      mime: versi.mime ?? "",
      namaAsli: versi.namaAsli ?? "",
      kodeVerifikasi: kode,
      difinalkanOlehId: "u-uji-final",
    },
  });

  const bacaan1 = await prisma.dokumenFinal.findUnique({ where: { dokumenId } });
  const bacaan2 = await prisma.dokumenFinal.findUnique({ where: { dokumenId } });
  assert.ok(bacaan1 && bacaan2);
  assert.equal(bacaan1.versiId, versi.id);
  assert.equal(bacaan2.versiId, versi.id);
  assert.equal(bacaan1.nomorVersi, versi.nomor);
  assert.equal(bacaan1.sha256, versi.sha256);
  assert.equal(bacaan1.ukuran, versi.ukuran);
  assert.equal(bacaan1.mime, versi.mime);
  assert.equal(bacaan1.namaAsli, versi.namaAsli);

  const versiTerkait = await prisma.versiDokumen.findUniqueOrThrow({ where: { id: bacaan1.versiId } });
  assert.equal(versiTerkait.dokumenId, bacaan1.dokumenId);
});

test("sistem jurnal tidak terpengaruh oleh operasi finalisasi", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const pertemuanAwal = await prisma.pertemuan.count();
  const jurnalAwal = await prisma.jurnal.count();

  const uji = await buatDokumenUji();
  await prisma.dokumenFinal.create({
    data: {
      dokumenId: uji.dokumenId,
      versiId: uji.versiIds[0],
      nomorVersi: 1,
      sha256: "x",
      ukuran: 1,
      mime: "application/pdf",
      namaAsli: "a.pdf",
      kodeVerifikasi: kodeUnik(),
      difinalkanOlehId: "u-uji-final",
    },
  });
  idsDokumen.add(uji.dokumenId);

  assert.equal(await prisma.pertemuan.count(), pertemuanAwal);
  assert.equal(await prisma.jurnal.count(), jurnalAwal);
});
