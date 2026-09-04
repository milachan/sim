import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { BATAS_JUDUL_DOKUMEN, normalisasiDokumen, validasiDokumen } from "./dokumen-validasi";

// Regresi hardening batas judul dokumen.
// Kolom `judul` di DB adalah VARCHAR(191) default MySQL — judul 192+ karakter
// menyebabkan Prisma P2000 (500) jika validasi server lebih longgar dari DB.

const baca = (rel: string) => readFileSync(path.resolve(rel), "utf8");

test("BATAS_JUDUL_DOKUMEN = 190 (sumber tunggal)", () => {
  assert.equal(BATAS_JUDUL_DOKUMEN, 190);
});

test("190 karakter diterima validasi server", () => {
  assert.equal(validasiDokumen({ judul: "J".repeat(190), jenis: "PROPOSAL" }), null);
});

test("191 dan 200 karakter ditolak server dengan pesan ramah", () => {
  for (const panjang of [191, 200]) {
    const err = validasiDokumen({ judul: "J".repeat(panjang), jenis: "PROPOSAL" });
    assert.match(err ?? "", /Judul maksimal 190 karakter/);
    // Tidak membocorkan Prisma/P2000/kolom DB.
    assert.ok(!/P2000|prisma|column|varchar/i.test(err ?? ""));
  }
});

test("spasi awal/akhir diproses konsisten: trim dihitung sebelum batas", () => {
  // 190 karakter inti + spasi pembungkus → setelah trim tetap 190 → diterima.
  assert.equal(validasiDokumen({ judul: `  ${"J".repeat(190)}  `, jenis: "PROPOSAL" }), null);
  // 191 karakter inti + spasi → setelah trim tetap 191 → ditolak.
  assert.match(validasiDokumen({ judul: `  ${"J".repeat(191)}  `, jenis: "PROPOSAL" }) ?? "", /maksimal 190/);
  // Normalisasi memotong spasi — konsisten dengan validasi.
  assert.equal(normalisasiDokumen({ judul: "  Abc  ", jenis: "PROPOSAL" }).judul, "Abc");
});

test("request langsung tanpa form tetap ditolak: ketiga server action memvalidasi sebelum DB", () => {
  const src = baca("lib/actions/dokumen.ts");
  for (const aksi of ["buatDokumen", "ubahDokumenDraf", "kirimRevisiDokumen"]) {
    const awal = src.indexOf(`export async function ${aksi}`);
    const akhir = src.indexOf("export async function", awal + 10);
    const fn = src.slice(awal, akhir > 0 ? akhir : undefined);
    const idxValidasi = fn.indexOf("validasiDokumen(input)");
    const idxDb = fn.indexOf("prisma.dokumen.");
    assert.ok(idxValidasi > -1, `${aksi} harus memanggil validasiDokumen`);
    assert.ok(idxDb > -1, `${aksi} harus menyentuh DB`);
    assert.ok(idxValidasi < idxDb, `${aksi}: validasi harus berjalan sebelum operasi database`);
  }
});

test("error validasi tidak membocorkan detail Prisma/P2000", () => {
  const err = validasiDokumen({ judul: "J".repeat(300), jenis: "PROPOSAL" });
  assert.ok(!/P2000|Invalid `prisma|column_name|VARCHAR/i.test(err ?? ""));
});

test("ketiga form memakai konstanta yang sama, tanpa angka 190 literal", () => {
  const form = baca("components/administrasi/dokumen-forms.tsx");
  assert.equal((form.match(/maxLength=\{BATAS_JUDUL_DOKUMEN\}/g) ?? []).length, 3);
  assert.ok(!/maxLength=\{190\}/.test(form), "jangan duplikasi angka 190 di form");
  assert.match(form, /BATAS_JUDUL_DOKUMEN.*dokumen-validasi/);
});

test("judul normal tidak mengalami regresi", () => {
  assert.equal(validasiDokumen({ judul: "Proposal Kegiatan Pesantren Ramadan", jenis: "PROPOSAL" }), null);
  assert.match(validasiDokumen({ judul: "Abc", jenis: "PROPOSAL" }) ?? "", /minimal 5/);
  assert.equal(validasiDokumen({ judul: "Laporan Biasa", jenis: "PROPOSAL", ringkasan: "ok" }), null);
});
