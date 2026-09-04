import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { mkdir, writeFile, unlink, rm } from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";

// Test DB layanan verifikasi kode Dokumen Final.
// Skip bila MySQL tidak tersedia (pola finalisasi-db).

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
const AKTOR = "u-uji-verif";
const DIR_UJI = path.join(process.cwd(), "storage", "dokumen");

const idsDokumen: string[] = [];
const kunciUji: string[] = [];

async function buatDokumenFinalUji(opsi?: {
  status?: string;
  jenis?: string;
  isiFile?: Buffer;
  tanpaFile?: boolean;
  snapshotBeda?: boolean;
  versiDokumenLain?: boolean;
}): Promise<{ dokumenId: string; kode: string; versiId: string }> {
  const status = opsi?.status ?? "DIFINALKAN";
  const dok = await prisma.dokumen.create({
    data: {
      jenis: (opsi?.jenis ?? "DOKUMEN_UMUM") as never,
      judul: `Uji verifikasi ${randomUUID().slice(0, 8)}`,
      status: status as never,
      pengajuUserId: AKTOR,
    },
  });
  idsDokumen.push(dok.id);

  let dokumenVersiId = dok.id;
  if (opsi?.versiDokumenLain) {
    // Dokumen kedua sungguhan agar relasi versi lintas-dokumen teruji.
    const dok2 = await prisma.dokumen.create({
      data: {
        jenis: "DOKUMEN_UMUM",
        judul: `Uji verifikasi lain ${randomUUID().slice(0, 8)}`,
        status: "DIFINALKAN",
        pengajuUserId: AKTOR,
      },
    });
    idsDokumen.push(dok2.id);
    dokumenVersiId = dok2.id;
  }

  const isi = opsi?.isiFile ?? Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from(randomUUID())]);
  const kunci = `${randomUUID()}.pdf`;
  if (!opsi?.tanpaFile) {
    await mkdir(DIR_UJI, { recursive: true });
    await writeFile(path.join(DIR_UJI, kunci), isi);
    kunciUji.push(kunci);
  }
  const { createHash } = await import("crypto");
  const sha = createHash("sha256").update(opsi?.tanpaFile ? Buffer.alloc(0) : isi).digest("hex");

  const versi = await prisma.versiDokumen.create({
    data: {
      dokumenId: dokumenVersiId,
      nomor: 1,
      judul: dok.judul,
      dibuatOlehUserId: AKTOR,
      namaAsli: "final.pdf",
      mime: "application/pdf",
      ukuran: opsi?.tanpaFile ? 0 : isi.length,
      kunciPenyimpanan: kunci,
      sha256: sha,
    },
  });

  const ALFABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let kode = "";
  for (let i = 0; i < 16; i++) kode += ALFABET[Math.floor(Math.random() * ALFABET.length)];
  await prisma.dokumenFinal.create({
    data: {
      dokumenId: dok.id,
      versiId: versi.id,
      nomorVersi: 1,
      sha256: opsi?.snapshotBeda ? "beda" : sha,
      ukuran: isi.length,
      mime: "application/pdf",
      namaAsli: "final.pdf",
      kodeVerifikasi: kode,
      difinalkanOlehId: AKTOR,
    },
  });
  return { dokumenId: dok.id, kode, versiId: versi.id };
}

async function hapusSemua() {
  for (const dokumenId of idsDokumen) {
    await prisma.dokumenFinal.deleteMany({ where: { dokumenId } }).catch(() => {});
    await prisma.dokumen.delete({ where: { id: dokumenId } }).catch(() => {});
  }
  for (const kunci of kunciUji) {
    await unlink(path.join(DIR_UJI, kunci)).catch(() => {});
  }
}

test("dokumen valid → VALID, data publik benar, tanpa data sensitif", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const { verifikasiKodeDokumen } = await import("./verifikasi/service");
  const { kode } = await buatDokumenFinalUji();
  const hasil = await verifikasiKodeDokumen(kode, null);
  assert.equal(hasil.status, "VALID");
  if (hasil.status !== "VALID") return;
  assert.match(hasil.publik.kodeTerformat, /^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/);
  assert.equal(hasil.publik.nomorVersiFinal, 1);
  assert.match(hasil.publik.sha256, /^[0-9a-f]{64}$/);
  assert.equal(hasil.publik.linkDetail, null);
  // Serialisasi hasil tidak memuat judul/nama/storage key.
  const serial = JSON.stringify(hasil);
  assert.ok(!serial.includes("kunciPenyimpanan"));
  assert.ok(!serial.includes("Uji verifikasi"));
  assert.ok(!serial.includes(AKTOR));
});

test("kode acak → TIDAK_DITEMUKAN tanpa bocor", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const { verifikasiKodeDokumen } = await import("./verifikasi/service");
  const hasil = await verifikasiKodeDokumen("ABCDEFGHJKLMNPQR", null);
  assert.equal(hasil.status, "TIDAK_DITEMUKAN");
  const serial = JSON.stringify(hasil);
  assert.ok(!serial.includes("judul") && !serial.includes("kunci"));
});

test("format asing ditolak sebelum query (tanpa akses DB/storage)", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const { verifikasiKodeDokumen } = await import("./verifikasi/service");
  const pendek = await verifikasiKodeDokumen("ABC", null);
  assert.equal(pendek.status, "FORMAT_TIDAK_VALID");
  const karakterLuar = await verifikasiKodeDokumen("A".repeat(15) + "I", null);
  assert.equal(karakterLuar.status, "FORMAT_TIDAK_VALID");
});

test("status bukan DIFINALKAN/DIARSIPKAN → TIDAK_DITEMUKAN (netral)", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const { verifikasiKodeDokumen } = await import("./verifikasi/service");
  const { kode } = await buatDokumenFinalUji({ status: "DIKIRIM" });
  const hasil = await verifikasiKodeDokumen(kode, null);
  assert.equal(hasil.status, "TIDAK_DITEMUKAN");
});

test("relasi versi dari dokumen lain → INTEGRITAS_BERMASALAH", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const { verifikasiKodeDokumen } = await import("./verifikasi/service");
  const { kode } = await buatDokumenFinalUji({ versiDokumenLain: true });
  const hasil = await verifikasiKodeDokumen(kode, null);
  assert.equal(hasil.status, "INTEGRITAS_BERMASALAH");
});

test("snapshot metadata berbeda → INTEGRITAS_BERMASALAH", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const { verifikasiKodeDokumen } = await import("./verifikasi/service");
  const { kode } = await buatDokumenFinalUji({ snapshotBeda: true });
  const hasil = await verifikasiKodeDokumen(kode, null);
  assert.equal(hasil.status, "INTEGRITAS_BERMASALAH");
});

test("file fisik hilang → INTEGRITAS_BERMASALAH", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const { verifikasiKodeDokumen } = await import("./verifikasi/service");
  const { kode } = await buatDokumenFinalUji({ tanpaFile: true });
  const hasil = await verifikasiKodeDokumen(kode, null);
  assert.equal(hasil.status, "INTEGRITAS_BERMASALAH");
});

test("file dirusak (checksum berubah) → INTEGRITAS_BERMASALAH", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const { verifikasiKodeDokumen } = await import("./verifikasi/service");
  const { kode } = await buatDokumenFinalUji();
  // Rusak file terakhir yang dibuat untuk dokumen ini.
  const f = await prisma.dokumenFinal.findFirst({
    where: { dokumenId: idsDokumen[idsDokumen.length - 1] },
    select: { versi: { select: { kunciPenyimpanan: true } } },
  });
  const kunci = f?.versi.kunciPenyimpanan ?? "";
  await writeFile(path.join(DIR_UJI, kunci), Buffer.from("%PDF-TAMPERED-ISI-DIUBAH"));
  const hasil = await verifikasiKodeDokumen(kode, null);
  assert.equal(hasil.status, "INTEGRITAS_BERMASALAH");
  // Pulihkan untuk cleanup konsisten.
  await writeFile(path.join(DIR_UJI, kunci), Buffer.from("%PDF-1.4\npulih"));
});

test("magic bytes salah (bukan PDF) → INTEGRITAS_BERMASALAH", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const { verifikasiKodeDokumen } = await import("./verifikasi/service");
  const { kode } = await buatDokumenFinalUji({ isiFile: Buffer.from("BUKAN-PDF-ASLI " + randomUUID()) });
  const hasil = await verifikasiKodeDokumen(kode, null);
  assert.equal(hasil.status, "INTEGRITAS_BERMASALAH");
});

test("user berwenang mendapat linkDetail; tidak berwenang tidak", async (t) => {
  if (!dbAda) return t.skip(alasanSkip);
  const { verifikasiKodeDokumen } = await import("./verifikasi/service");
  const { kode, dokumenId } = await buatDokumenFinalUji();
  const pemilik = { id: AKTOR, role: "GURU", guruId: null };
  const orangLain = { id: "u-lain", role: "GURU", guruId: null };
  const kamad = { id: "u-kamad", role: "KEPALA", guruId: null };

  const hPemilik = await verifikasiKodeDokumen(kode, pemilik);
  assert.equal(hPemilik.status, "VALID");
  if (hPemilik.status === "VALID") assert.equal(hPemilik.publik.linkDetail, `/administrasi/${dokumenId}`);

  const hLain = await verifikasiKodeDokumen(kode, orangLain);
  if (hLain.status === "VALID") assert.equal(hLain.publik.linkDetail, null);

  const hKamad = await verifikasiKodeDokumen(kode, kamad);
  if (hKamad.status === "VALID") assert.equal(hKamad.publik.linkDetail, `/administrasi/${dokumenId}`);
});

after(async () => {
  await hapusSemua();
  await rm(path.join(DIR_UJI), { recursive: true, force: true }).catch(() => {});
  await prisma.$disconnect();
});
