import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "path";

// Verifikasi statis: endpoint upload versi dokumen memanggil
// helper deteksi PIKET dan menolak dengan PESAN_TOLAK_MENGAJUKAN.

const routePath = path.resolve("app/api/administrasi/dokumen/[id]/upload/route.ts");

test("endpoint upload: file ada", () => {
  assert.ok(existsSync(routePath), "endpoint upload versi harus ada");
});

test("endpoint upload: memakai helper deteksi PIKET (adalahAkunPiket)", () => {
  const src = readFileSync(routePath, "utf8");
  assert.match(src, /adalahAkunPiket/, "harus memanggil adalahAkunPiket");
});

test("endpoint upload: memakai apiAktifDenganPiket (bukan apiAktif polos)", () => {
  const src = readFileSync(routePath, "utf8");
  assert.match(src, /apiAktifDenganPiket/, "harus memakai apiAktifDenganPiket untuk PIKET detection");
});

test("endpoint upload: menolak PIKET sebelum query dokumen", () => {
  const src = readFileSync(routePath, "utf8");
  const piketCheckIdx = src.indexOf("adalahAkunPiket");
  const findDokumenIdx = src.indexOf("prisma.dokumen.findUnique");
  assert.ok(piketCheckIdx > 0, "harus ada cek adalahAkunPiket");
  assert.ok(findDokumenIdx > 0, "harus ada query prisma.dokumen.findUnique");
  assert.ok(piketCheckIdx < findDokumenIdx, "cek PIKET harus sebelum query DB");
});

test("endpoint upload: response 403 dengan PESAN_TOLAK_MENGAJUKAN untuk PIKET", () => {
  const src = readFileSync(routePath, "utf8");
  assert.match(src, /PESAN_TOLAK_MENGAJUKAN/, "harus memakai konstanta generik");
  assert.match(src, /status:\s*403/, "harus mengembalikan 403 untuk PIKET");
});

test("endpoint upload: guard bolehMengajukanDokumen untuk tolak KEPALA/ADMIN/SUPERADMIN", () => {
  // Sumber tunggal aturan: setelah cek PIKET, endpoint juga harus memanggil
  // bolehMengajukanDokumen agar KEPALA/ADMIN/SUPERADMIN ditolak sebelum query
  // DB dengan pesan generik (bukan pesan yang membocorkan status dokumen).
  const src = readFileSync(routePath, "utf8");
  assert.match(src, /bolehMengajukanDokumen/, "harus memanggil helper bolehMengajukanDokumen");
  // Guard eksplisit harus sebelum query prisma.dokumen.findUnique.
  const guardIdx = src.indexOf("bolehMengajukanDokumen");
  const findDokumenIdx = src.indexOf("prisma.dokumen.findUnique");
  assert.ok(guardIdx > 0);
  assert.ok(findDokumenIdx > 0);
  assert.ok(guardIdx < findDokumenIdx, "guard bolehMengajukanDokumen harus sebelum query DB");
  // Respons penolakan menggunakan 403 + PESAN_TOLAK_MENGAJUKAN.
  assert.match(src, /PESAN_TOLAK_MENGAJUKAN/, "harus memakai PESAN_TOLAK_MENGAJUKAN");
});

test("endpoint upload: tidak menggunakan pesan 'pemeriksa' (generik)", () => {
  const src = readFileSync(routePath, "utf8");
  assert.doesNotMatch(
    src,
    /Akun pemeriksa tidak dapat membuat pengajuan/,
    "endpoint upload tidak boleh memakai pesan lama yang menyebut 'pemeriksa'"
  );
});
