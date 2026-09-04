import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "path";

// Verifikasi statis: semua server action pengaju memanggil
// bolehMengajukanDokumen(user) sebelum operasi database.
// Berlaku untuk: buatDokumen, ubahDokumenDraf, hapusDokumenDraf,
// kirimDokumen, kirimRevisiDokumen.

const actionsPath = path.resolve("lib/actions/dokumen.ts");

test("server actions pengaju: file ada", () => {
  assert.ok(existsSync(actionsPath));
});

test("server action buatDokumen: guard sebelum prisma.dokumen.create", () => {
  const src = readFileSync(actionsPath, "utf8");
  const fnStart = src.indexOf("export async function buatDokumen");
  const fnEnd = src.indexOf("export async function ubahDokumenDraf");
  assert.ok(fnStart > 0 && fnEnd > 0);
  const fn = src.substring(fnStart, fnEnd);
  const guardIdx = fn.indexOf("bolehMengajukanDokumen");
  const createIdx = fn.indexOf("prisma.dokumen.create");
  assert.ok(guardIdx > 0, "buatDokumen harus memanggil bolehMengajukanDokumen");
  assert.ok(createIdx > 0, "buatDokumen harus membuat prisma.dokumen.create");
  assert.ok(guardIdx < createIdx, "guard harus sebelum prisma.dokumen.create");
});

test("server action ubahDokumenDraf: guard sebelum prisma dokumen", () => {
  const src = readFileSync(actionsPath, "utf8");
  const fnStart = src.indexOf("export async function ubahDokumenDraf");
  const fnEnd = src.indexOf("export async function hapusDokumenDraf");
  const fn = src.substring(fnStart, fnEnd);
  const guardIdx = fn.indexOf("bolehMengajukanDokumen");
  const findIdx = fn.indexOf("prisma.dokumen.findUnique");
  assert.ok(guardIdx > 0);
  assert.ok(findIdx > 0);
  assert.ok(guardIdx < findIdx);
});

test("server action hapusDokumenDraf: guard sebelum prisma dokumen", () => {
  const src = readFileSync(actionsPath, "utf8");
  const fnStart = src.indexOf("export async function hapusDokumenDraf");
  const fnEnd = src.indexOf("export async function kirimDokumen");
  const fn = src.substring(fnStart, fnEnd);
  const guardIdx = fn.indexOf("bolehMengajukanDokumen");
  const findIdx = fn.indexOf("prisma.dokumen.findUnique");
  assert.ok(guardIdx > 0);
  assert.ok(findIdx > 0);
  assert.ok(guardIdx < findIdx);
});

test("server action kirimDokumen: guard sebelum prisma dokumen", () => {
  const src = readFileSync(actionsPath, "utf8");
  const fnStart = src.indexOf("export async function kirimDokumen");
  const fnEnd = src.indexOf("export async function kirimRevisiDokumen");
  const fn = src.substring(fnStart, fnEnd);
  const guardIdx = fn.indexOf("bolehMengajukanDokumen");
  const findIdx = fn.indexOf("prisma.dokumen.findUnique");
  assert.ok(guardIdx > 0);
  assert.ok(findIdx > 0);
  assert.ok(guardIdx < findIdx);
});

test("server action kirimRevisiDokumen: guard sebelum prisma dokumen", () => {
  const src = readFileSync(actionsPath, "utf8");
  const fnStart = src.indexOf("export async function kirimRevisiDokumen");
  const fnEnd = src.indexOf("export async function mintaRevisiDokumen");
  const fn = src.substring(fnStart, fnEnd);
  const guardIdx = fn.indexOf("bolehMengajukanDokumen");
  const findIdx = fn.indexOf("prisma.dokumen.findUnique");
  assert.ok(guardIdx > 0);
  assert.ok(findIdx > 0);
  assert.ok(guardIdx < findIdx);
});

test("semua action pengaju melempar PESAN_TOLAK_MENGAJUKAN saat ditolak", () => {
  const src = readFileSync(actionsPath, "utf8");
  // Hitung berapa kali PESAN_TOLAK_MENGAJUKAN muncul (5 action harus punya).
  const occurrences = (src.match(/PESAN_TOLAK_MENGAJUKAN/g) || []).length;
  assert.ok(
    occurrences >= 5,
    `diharapkan >=5 kemunculan PESAN_TOLAK_MENGAJUKAN (1 per action), dapat ${occurrences}`
  );
});

test("server actions TIDAK menggunakan pesan 'pemeriksa' (generik)", () => {
  const src = readFileSync(actionsPath, "utf8");
  assert.doesNotMatch(
    src,
    /Akun pemeriksa tidak dapat membuat pengajuan/,
    "pesan lama menyebut 'pemeriksa' sudah tidak dipakai"
  );
});
