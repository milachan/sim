import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "path";

// Verifikasi statis halaman detail dokumen:
// - Mendeteksi "dokumen lama pemeriksa" (pengaju == user && user adalah pemeriksa).
// - Merender alert read-only.
// - Tidak merender FormUbahDokumen / TombolHapusDraf / TombolKirim / FormRevisiDanKirim / UploadVersiDokumen
//   untuk dokumen lama pemeriksa (gate UI konsisten dengan server action).

const detailPath = path.resolve("app/(administrasi)/administrasi/[id]/page.tsx");

test("halaman detail: file ada", () => {
  assert.ok(existsSync(detailPath), "halaman detail harus ada");
});

test("halaman detail: mendeteksi isDokumenLamaPemeriksa", () => {
  const src = readFileSync(detailPath, "utf8");
  assert.match(src, /isDokumenLamaPemeriksa/, "harus menghitung isDokumenLamaPemeriksa");
  // Syarat: pengaju == user.id DAN user adalah pemeriksa.
  assert.match(src, /d\.pengajuUserId === user\.id/, "harus membandingkan pengaju dengan user.id");
  assert.match(src, /adalahPemeriksaDokumen/, "harus memakai helper adalahPemeriksaDokumen");
});

test("halaman detail: gate aksi pengaju mempertimbangkan isDokumenLamaPemeriksa", () => {
  const src = readFileSync(detailPath, "utf8");
  assert.match(src, /bolehAksiPengaju/, "harus ada gate bolehAksiPengaju");
  assert.match(
    src,
    /bolehAksiPengaju\s*=\s*[\s\S]{0,200}isDokumenLamaPemeriksa/,
    "gate aksi pengaju harus menyertakan isDokumenLamaPemeriksa"
  );
});

test("halaman detail: alert read-only untuk dokumen lama pemeriksa", () => {
  const src = readFileSync(detailPath, "utf8");
  assert.match(
    src,
    /Dokumen lama ini hanya dapat dibaca\. Akun pemeriksa tidak menggunakan alur pengajuan pribadi\./,
    "harus merender alert read-only dengan copy yang disyaratkan"
  );
});

test("halaman detail: form ubah/hapus/kirim/revisi/upload dikondisikan oleh isDrafMilik/isRevisiMilik/showUpload", () => {
  const src = readFileSync(detailPath, "utf8");
  // Komponen mutasi harus di dalam blok bersyarat
  for (const komponen of [
    "FormUbahDokumen",
    "TombolHapusDraf",
    "TombolKirim",
    "FormRevisiDanKirim",
    "UploadVersiDokumen",
  ]) {
    // Cari di mana komponen di-render
    const idx = src.indexOf(`<${komponen}`);
    assert.ok(idx > 0, `${komponen} harus dirender`);
    // Mundur 1500 karakter untuk melihat gate (Upload dikontrol oleh showUpload ternary).
    const window = src.substring(Math.max(0, idx - 1500), idx);
    // Setidaknya satu dari gate ini muncul
    const adaGate = /isDrafMilik|isRevisiMilik|showUpload|bolehAksiPengaju/.test(window);
    assert.ok(adaGate, `${komponen} harus dirender dalam blok gate (isDrafMilik/isRevisiMilik/showUpload/bolehAksiPengaju)`);
  }
});

test("halaman detail: badge Read-only untuk dokumen lama pemeriksa", () => {
  const src = readFileSync(detailPath, "utf8");
  assert.match(src, /Read-only/, "harus menampilkan badge Read-only");
});
