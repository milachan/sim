import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { Prisma, PrismaClient, type StatusDokumen } from "@prisma/client";
import {
  ambilPenerimaKamadAktif,
  buatNotifikasiKamad,
  buatNotifikasiPemilik,
  daftarNotifikasiUser,
  jumlahNotifikasiBelumDibaca,
  kunciEvent,
  susunTeksNotifikasi,
  tandaiNotifikasiDibaca,
  tandaiSemuaNotifikasiDibaca,
} from "./administrasi/notifikasi";

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

const idsUser = new Set<string>();
const idsDokumen = new Set<string>();

type OpsiUser = { role: "KEPALA" | "GURU" | "WAKA"; aktif?: boolean };

async function buatUserUji(opsi: OpsiUser): Promise<string> {
  const u = await prisma.user.create({
    data: {
      username: `uji-notif-${randomUUID().slice(0, 12)}`,
      password: "x",
      nama: `Uji Notifikasi ${opsi.role}`,
      role: opsi.role,
      aktif: opsi.aktif ?? true,
    },
    select: { id: true },
  });
  idsUser.add(u.id);
  return u.id;
}

async function buatDokumenUji(pengajuUserId: string, status: StatusDokumen): Promise<{ id: string; judul: string }> {
  const d = await prisma.dokumen.create({
    data: { jenis: "PROPOSAL", judul: `Uji notifikasi ${randomUUID()}`, status, pengajuUserId },
    select: { id: true, judul: true },
  });
  idsDokumen.add(d.id);
  return d;
}

async function catatRiwayat(
  tx: Prisma.TransactionClient,
  dokumenId: string,
  aktorUserId: string,
  aksi: string,
  dariStatus: string,
  keStatus: string
): Promise<string> {
  const rw = await tx.riwayatDokumen.create({
    data: { dokumenId, aktorUserId, aksi, dariStatus, keStatus },
    select: { id: true },
  });
  return rw.id;
}

after(async () => {
  const dokIds = [...idsDokumen];
  const userIds = [...idsUser];
  if (dokIds.length > 0) {
    await prisma.notifikasiAdministrasi.deleteMany({ where: { dokumenId: { in: dokIds } } });
    await prisma.dokumen.deleteMany({ where: { id: { in: dokIds } } });
  }
  if (userIds.length > 0) {
    await prisma.notifikasiAdministrasi.deleteMany({ where: { penerimaUserId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  await prisma.$disconnect();
});

test("struktur DB: unique dedup, index baca, dan FK CASCADE eksplisit", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);

  const idxUnik = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*) AS n FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NotifikasiAdministrasi'
      AND INDEX_NAME = 'NotifikasiAdministrasi_penerimaUserId_eventKey_key' AND NON_UNIQUE = 0`;
  assert.equal(Number(idxUnik[0].n), 2, "unique index harus membungkus penerimaUserId+eventKey");

  const idxBaca = await prisma.$queryRaw<Array<{ n: bigint; seq: bigint; kolom: string }>>`
    SELECT SEQ_IN_INDEX AS seq, COLUMN_NAME AS kolom FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NotifikasiAdministrasi'
      AND INDEX_NAME = 'NotifikasiAdministrasi_penerimaUserId_dibacaPada_createdAt_idx'
    ORDER BY SEQ_IN_INDEX`;
  assert.deepEqual(
    idxBaca.map((r) => r.kolom),
    ["penerimaUserId", "dibacaPada", "createdAt"]
  );

  const fk = await prisma.$queryRaw<Array<{ CONSTRAINT_NAME: string; DELETE_RULE: string }>>`
    SELECT rc.CONSTRAINT_NAME, rc.DELETE_RULE
    FROM information_schema.REFERENTIAL_CONSTRAINTS rc
    JOIN information_schema.TABLE_CONSTRAINTS tc
      ON tc.CONSTRAINT_NAME = rc.CONSTRAINT_NAME AND tc.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
    WHERE rc.CONSTRAINT_SCHEMA = DATABASE() AND rc.TABLE_NAME = 'NotifikasiAdministrasi'`;
  assert.equal(fk.length, 2);
  for (const f of fk) {
    assert.equal(f.DELETE_RULE, "CASCADE", `${f.CONSTRAINT_NAME} harus CASCADE`);
  }

  const dibacaNullable = await prisma.$queryRaw<Array<{ IS_NULLABLE: string }>>`
    SELECT IS_NULLABLE FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'NotifikasiAdministrasi' AND COLUMN_NAME = 'dibacaPada'`;
  assert.equal(dibacaNullable[0].IS_NULLABLE, "YES");
});

test("deduplication level DB: penerima+eventKey sama ditolak P2002", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const pemilik = await buatUserUji({ role: "GURU" });
  const d = await buatDokumenUji(pemilik, "DIKIRIM");

  await prisma.notifikasiAdministrasi.create({
    data: {
      penerimaUserId: pemilik,
      dokumenId: d.id,
      jenis: "DISETUJUI",
      judul: "uji",
      isi: "uji",
      eventKey: "setujui:rw-uji-sama",
    },
  });

  let tertangkap: { code: string } | null = null;
  try {
    await prisma.notifikasiAdministrasi.create({
      data: {
        penerimaUserId: pemilik,
        dokumenId: d.id,
        jenis: "DISETUJUI",
        judul: "uji",
        isi: "uji",
        eventKey: "setujui:rw-uji-sama",
      },
    });
  } catch (e) {
    tertangkap = errPrisma(e);
  }
  assert.equal(tertangkap?.code, "P2002");

  // penerima berbeda pada event sama tetap boleh (broadcast Kamad).
  const kamad = await buatUserUji({ role: "KEPALA" });
  await prisma.notifikasiAdministrasi.create({
    data: {
      penerimaUserId: kamad,
      dokumenId: d.id,
      jenis: "DISETUJUI",
      judul: "uji",
      isi: "uji",
      eventKey: "setujui:rw-uji-sama",
    },
  });
});

test("rollback transaksi: status terubah lalu gagal → notifikasi ikut tergulung balik", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const pemilik = await buatUserUji({ role: "GURU" });
  const d = await buatDokumenUji(pemilik, "DIKIRIM");
  const jumlahAwal = await prisma.notifikasiAdministrasi.count();

  let gagalTertangkap = false;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.dokumen.update({ where: { id: d.id }, data: { status: "DISETUJUI" } });
      const rwId = await catatRiwayat(tx, d.id, pemilik, "setujui", "DIKIRIM", "DISETUJUI");
      await buatNotifikasiPemilik(tx, {
        dokumenId: d.id,
        penerimaUserId: pemilik,
        jenis: "DISETUJUI",
        eventKey: kunciEvent("setujui", rwId),
      });
      throw new Error("simulasi kegagalan");
    });
  } catch {
    gagalTertangkap = true;
  }
  assert.ok(gagalTertangkap);

  const dok = await prisma.dokumen.findUniqueOrThrow({ where: { id: d.id }, select: { status: true } });
  assert.equal(dok.status, "DIKIRIM");
  assert.equal(await prisma.notifikasiAdministrasi.count(), jumlahAwal);
});

test("lima transisi menghasilkan penerima, jenis, dan isi yang tepat", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const kamad1 = await buatUserUji({ role: "KEPALA" });
  const kamadNonaktif = await buatUserUji({ role: "KEPALA", aktif: false });
  const waka = await buatUserUji({ role: "WAKA" });
  const pemilik = await buatUserUji({ role: "GURU" });

  const daftarKamad = await ambilPenerimaKamadAktif();
  const idKamadAktif = new Set(daftarKamad.map((k) => k.id));
  assert.ok(idKamadAktif.has(kamad1));
  assert.ok(!idKamadAktif.has(kamadNonaktif), "Kamad nonaktif tidak menjadi penerima");
  assert.ok(!idKamadAktif.has(waka));

  const d = await buatDokumenUji(pemilik, "DRAF");

  // 1. Kirim pertama kali → semua Kepala Madrasah aktif.
  await prisma.$transaction(async (tx) => {
    await tx.dokumen.update({ where: { id: d.id }, data: { status: "DIKIRIM" } });
    const rwId = await catatRiwayat(tx, d.id, pemilik, "kirim", "DRAF", "DIKIRIM");
    const n = await buatNotifikasiKamad(tx, {
      dokumenId: d.id,
      jenis: "DOKUMEN_DIKIRIM",
      eventKey: kunciEvent("kirim", rwId),
    });
    assert.equal(n, daftarKamad.length);
  });
  const barisKirim = await prisma.notifikasiAdministrasi.findMany({
    where: { dokumenId: d.id, jenis: "DOKUMEN_DIKIRIM" },
  });
  assert.equal(barisKirim.length, daftarKamad.length);
  for (const b of barisKirim) {
    assert.ok(idKamadAktif.has(b.penerimaUserId));
    assert.equal(b.dibacaPada, null);
    assert.match(b.eventKey, /^kirim:/);
    assert.ok(!b.isi.includes("CATATAN"), "isi tidak memuat catatan revisi");
  }

  // 2. Kamad minta revisi → hanya pemilik.
  await prisma.$transaction(async (tx) => {
    await tx.dokumen.update({ where: { id: d.id }, data: { status: "PERLU_REVISI" } });
    const rwId = await catatRiwayat(tx, d.id, kamad1, "minta-revisi", "DIKIRIM", "PERLU_REVISI");
    await buatNotifikasiPemilik(tx, {
      dokumenId: d.id,
      penerimaUserId: pemilik,
      jenis: "PERLU_REVISI",
      eventKey: kunciEvent("minta-revisi", rwId),
    });
  });
  const barisRevisi = await prisma.notifikasiAdministrasi.findMany({
    where: { dokumenId: d.id, jenis: "PERLU_REVISI" },
  });
  assert.equal(barisRevisi.length, 1);
  assert.equal(barisRevisi[0].penerimaUserId, pemilik);
  const teksRevisi = susunTeksNotifikasi("PERLU_REVISI", d.judul);
  assert.equal(barisRevisi[0].judul, teksRevisi.judul);
  assert.equal(barisRevisi[0].isi, teksRevisi.isi);
  assert.ok(!/[0-9a-f]{64}/i.test(barisRevisi[0].isi), "tanpa checksum");
  assert.ok(!barisRevisi[0].isi.includes(".pdf") && !barisRevisi[0].isi.includes("/"), "tanpa path/storage key");

  // 3. Revisi dikirim ulang → semua Kepala Madrasah aktif, jenis berbeda.
  await prisma.$transaction(async (tx) => {
    await tx.dokumen.update({ where: { id: d.id }, data: { status: "DIKIRIM" } });
    const rwId = await catatRiwayat(tx, d.id, pemilik, "kirim-revisi", "PERLU_REVISI", "DIKIRIM");
    await buatNotifikasiKamad(tx, {
      dokumenId: d.id,
      jenis: "REVISI_DIKIRIM",
      eventKey: kunciEvent("kirim-revisi", rwId),
    });
  });
  const barisRevisiKirim = await prisma.notifikasiAdministrasi.findMany({
    where: { dokumenId: d.id, jenis: "REVISI_DIKIRIM" },
  });
  assert.equal(barisRevisiKirim.length, daftarKamad.length);

  // 4. Disetujui → hanya pemilik.
  await prisma.$transaction(async (tx) => {
    await tx.dokumen.update({ where: { id: d.id }, data: { status: "DISETUJUI" } });
    const rwId = await catatRiwayat(tx, d.id, kamad1, "setujui", "DIKIRIM", "DISETUJUI");
    await buatNotifikasiPemilik(tx, {
      dokumenId: d.id,
      penerimaUserId: pemilik,
      jenis: "DISETUJUI",
      eventKey: kunciEvent("setujui", rwId),
    });
  });
  const barisSetujui = await prisma.notifikasiAdministrasi.findMany({
    where: { dokumenId: d.id, jenis: "DISETUJUI" },
  });
  assert.equal(barisSetujui.length, 1);
  assert.equal(barisSetujui[0].penerimaUserId, pemilik);

  // 5. Difinalkan → hanya pemilik.
  await prisma.$transaction(async (tx) => {
    await tx.dokumen.update({ where: { id: d.id }, data: { status: "DIFINALKAN" } });
    const rwId = await catatRiwayat(tx, d.id, kamad1, "finalisasi", "DISETUJUI", "DIFINALKAN");
    await buatNotifikasiPemilik(tx, {
      dokumenId: d.id,
      penerimaUserId: pemilik,
      jenis: "DIFINALKAN",
      eventKey: kunciEvent("finalisasi", rwId),
    });
  });
  const barisFinal = await prisma.notifikasiAdministrasi.findMany({
    where: { dokumenId: d.id, jenis: "DIFINALKAN" },
  });
  assert.equal(barisFinal.length, 1);
  assert.equal(barisFinal[0].penerimaUserId, pemilik);

  // Idempotent: mengulang event sumber tidak menambah baris.
  const rwUlang = await prisma.riwayatDokumen.findFirstOrThrow({
    where: { dokumenId: d.id, aksi: "finalisasi" },
    select: { id: true },
  });
  await prisma.$transaction((tx) =>
    buatNotifikasiPemilik(tx, {
      dokumenId: d.id,
      penerimaUserId: pemilik,
      jenis: "DIFINALKAN",
      eventKey: kunciEvent("finalisasi", rwUlang.id),
    })
  );
  assert.equal(await prisma.notifikasiAdministrasi.count({ where: { dokumenId: d.id, jenis: "DIFINALKAN" } }), 1);

  // Query per user: daftar & unread hanya milik user bersangkutan.
  const milikPemilik = await daftarNotifikasiUser(pemilik);
  assert.equal(milikPemilik.length, 3); // minta-revisi, setujui, finalisasi
  for (const m of milikPemilik) {
    assert.equal(m.tautan, `/administrasi/${m.dokumenId}`);
  }
  const milikKamad = await daftarNotifikasiUser(kamad1);
  assert.equal(milikKamad.length, 2); // kirim + kirim-revisi
  assert.ok(milikKamad.every((m) => m.jenis !== "PERLU_REVISI"));

  // Otorisasi: user lain tidak dapat menandai notifikasi orang lain.
  assert.equal(await tandaiNotifikasiDibaca(kamad1, barisSetujui[0].id), false);
  assert.equal(
    (await prisma.notifikasiAdministrasi.findUniqueOrThrow({ where: { id: barisSetujui[0].id } })).dibacaPada,
    null
  );
  assert.equal(await tandaiNotifikasiDibaca(pemilik, barisSetujui[0].id), true);
  assert.ok((await prisma.notifikasiAdministrasi.findUniqueOrThrow({ where: { id: barisSetujui[0].id } })).dibacaPada);

  const belumPemilik = await jumlahNotifikasiBelumDibaca(pemilik);
  assert.equal(belumPemilik, 2);
  const belumKamadAwal = await jumlahNotifikasiBelumDibaca(kamad1);
  const ditandai = await tandaiSemuaNotifikasiDibaca(kamad1);
  assert.equal(ditandai, belumKamadAwal);
  assert.equal(await jumlahNotifikasiBelumDibaca(kamad1), 0);
  assert.equal(await jumlahNotifikasiBelumDibaca(pemilik), 2, "tandai-semua hanya menyentuh milik sendiri");
});

test("hapus dokumen meng-cascade notifikasinya", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const pemilik = await buatUserUji({ role: "GURU" });
  const d = await buatDokumenUji(pemilik, "DISETUJUI");
  await prisma.notifikasiAdministrasi.create({
    data: { penerimaUserId: pemilik, dokumenId: d.id, jenis: "DISETUJUI", judul: "j", isi: "i", eventKey: "kaskade:1" },
  });
  assert.equal(await prisma.notifikasiAdministrasi.count({ where: { dokumenId: d.id } }), 1);
  await prisma.dokumen.delete({ where: { id: d.id } });
  idsDokumen.delete(d.id);
  assert.equal(await prisma.notifikasiAdministrasi.count({ where: { dokumenId: d.id } }), 0);
});
