import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "path";

// Verifikasi halaman /administrasi/baru dan /administrasi/dokumen-saya
// memanggil helper bolehMengajukanDokumen dan mengalihkan ke dashboard
// ketika user adalah KEPALA/ADMIN/SUPERADMIN.

const root = path.resolve("app/(administrasi)/administrasi");

test("route /baru: server component memanggil helper bolehMengajukanDokumen", () => {
  const file = path.join(root, "baru/page.tsx");
  assert.ok(existsSync(file), "halaman /baru harus ada");
  const src = readFileSync(file, "utf8");
  assert.match(src, /bolehMengajukanDokumen/, "harus memakai helper");
  assert.match(src, /redirect\(['"]\/administrasi\?info=pengajuan-tidak-tersedia['"]\)/, "harus redirect ke dashboard dengan info");
});

test("route /dokumen-saya: server component memanggil helper bolehMengajukanDokumen", () => {
  const file = path.join(root, "dokumen-saya/page.tsx");
  assert.ok(existsSync(file), "halaman /dokumen-saya harus ada");
  const src = readFileSync(file, "utf8");
  assert.match(src, /bolehMengajukanDokumen/, "harus memakai helper");
  assert.match(src, /redirect\(['"]\/administrasi\?info=pengajuan-tidak-tersedia['"]\)/, "harus redirect ke dashboard dengan info");
});

test("layout Administrasi: memakai helper terpusat adalahAkunPiket (satu sumber aturan)", () => {
  // Deteksi PIKET di layout HARUS memakai helper dari lib/otorisasi.ts
  // (adalahAkunPiket) — bukan duplikasi logika role+jenisGuru+kode.
  const file = path.join(root, "layout.tsx");
  assert.ok(existsSync(file), "layout Administrasi harus ada");
  const src = readFileSync(file, "utf8");
  assert.match(
    src,
    /import\s*\{[^}]*adalahAkunPiket[^}]*\}\s*from\s*['"]@\/lib\/otorisasi['"]/,
    "layout harus mengimpor adalahAkunPiket dari lib/otorisasi"
  );
  assert.match(src, /adalahAkunPiket\(/, "layout harus memanggil helper adalahAkunPiket");
  // Tidak boleh lagi menduplikasi triple-check literal (pola yang rentan lupa
  // bila helper berubah).
  assert.doesNotMatch(
    src,
    /role\s*===\s*["']GURU["'][\s\S]{0,80}jenisGuru\s*===\s*["']PIKET["'][\s\S]{0,80}kode\s*===\s*["']PIKET["']/,
    "layout tidak boleh duplikasi triple-check role+jenisGuru+kode"
  );
});

test("halaman detail /[id]: memakai helper terpusat adalahAkunPiket", () => {
  const file = path.join(root, "[id]/page.tsx");
  assert.ok(existsSync(file), "halaman detail harus ada");
  const src = readFileSync(file, "utf8");
  assert.match(src, /adalahAkunPiket/, "harus memakai helper adalahAkunPiket");
  // Gate aksi pengaju mencakup dokumen lama pemeriksa.
  assert.match(src, /isDokumenLamaPemeriksa/, "harus mengenali dokumen lama pemeriksa");
  assert.match(src, /bolehAksiPengaju/, "harus ada gate bolehAksiPengaju");
});

test("route dashboard: hanya menampilkan alert untuk info=pengajuan-tidak-tersedia", () => {
  const file = path.join(root, "page.tsx");
  assert.ok(existsSync(file));
  const src = readFileSync(file, "utf8");
  assert.match(src, /INFO_DIIZINKAN/, "harus memakai whitelist untuk parameter info");
  assert.match(src, /pengajuan-tidak-tersedia/, "harus mengenali info=pengajuan-tidak-tersedia");
  // Tidak boleh menampilkan isi query mentah
  assert.doesNotMatch(src, /\{searchParams\?\.info\}/, "tidak boleh merender nilai info mentah");
});

test("server action buatDokumen: guard dipanggil sebelum prisma.dokumen.create", () => {
  const file = path.resolve("lib/actions/dokumen.ts");
  assert.ok(existsSync(file));
  const src = readFileSync(file, "utf8");
  const guardIdx = src.indexOf("bolehMengajukanDokumen");
  const createIdx = src.indexOf("prisma.dokumen.create");
  assert.ok(guardIdx > 0, "guard bolehMengajukanDokumen harus dipanggil");
  assert.ok(createIdx > 0, "prisma.dokumen.create harus ada");
  assert.ok(guardIdx < createIdx, "guard harus berada sebelum prisma.dokumen.create");
  // Pesan generik di server action — boleh menggunakan konstanta PESAN_TOLAK_MENGAJUKAN
  // (sumber kebenaran ada di lib/otorisasi.ts) atau string literal.
  assert.match(
    src,
    /PESAN_TOLAK_MENGAJUKAN/,
    "harus memakai konstanta PESAN_TOLAK_MENGAJUKAN untuk menjaga konsistensi"
  );
  assert.doesNotMatch(
    src,
    /Akun pemeriksa tidak dapat membuat pengajuan/,
    "tidak boleh memakai string pesan lama yang menyebut 'pemeriksa'"
  );
});
