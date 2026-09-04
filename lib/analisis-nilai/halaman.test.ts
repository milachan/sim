import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";

// Kontrak halaman /analisis-nilai:
// 1) benar-benar read-only (tanpa aksi tulis apa pun),
// 2) tidak memakai istilah KKM/KKTP/tuntas/remedial buatan,
// 3) informasi bahwa CBT belum aktif tetap tampil,
// 4) memakai design system existing.

const baca = (rel: string) => readFileSync(path.resolve(rel), "utf8");
const sumber =
  baca("app/(analisis)/analisis-nilai/page.tsx") +
  "\n" +
  baca("components/analisis-nilai/tabel-hasil-siswa.tsx");

test("halaman analisis nilai tidak memiliki aksi tulis", () => {
  const polaTerkutuk: RegExp[] = [
    /["']use server["']/,
    /\.create\(/,
    /\.createMany\(/,
    /\.update\(/,
    /\.updateMany\(/,
    /\.delete\(/,
    /\.deleteMany\(/,
    /\.upsert\(/,
    /<form[\s>]/,
    /<input[\s>]/,
    /type=["']checkbox["']/,
    /onSubmit/,
    /Simpan/,
    /Ubah Nilai/i,
  ];
  for (const p of polaTerkutuk) {
    assert.doesNotMatch(sumber, p, `pola terlarang ditemukan: ${p}`);
  }
});

test("halaman analisis nilai bebas istilah KKM/KKTP/tuntas/remedial buatan", () => {
  assert.doesNotMatch(sumber, /\bKKM\b/i);
  assert.doesNotMatch(sumber, /\bKKTP\b/i);
  assert.doesNotMatch(sumber, /remedial/i);
  assert.doesNotMatch(sumber, /tuntas/i);
});

test("informasi CBT belum aktif tetap tampil", () => {
  const halaman = baca("app/(analisis)/analisis-nilai/page.tsx");
  assert.match(halaman, /Integrasi CBT belum aktif/);
});

test("halaman memakai design system dan judul Analisis Nilai", () => {
  const halaman = baca("app/(analisis)/analisis-nilai/page.tsx");
  assert.match(halaman, /@\/components\/ds\/page-header/);
  assert.match(halaman, /title="Analisis Nilai"/);
});
