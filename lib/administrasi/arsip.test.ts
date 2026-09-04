import { test } from "node:test";
import assert from "node:assert/strict";
import type { StatusDokumen } from "@prisma/client";
import { JENIS_DOKUMEN_LABEL } from "@/lib/dokumen-validasi";
import {
  bangunKatalogTemplate,
  bangunWhereArsip,
  daftarTahunArsip,
  filterKatalogTemplate,
  hitungStatistikArsip,
  LANGKAH_TEMPLATE,
  opsiJenisArsip,
  opsiMilikArsip,
  opsiTahunArsip,
  STATUS_ARSIP,
} from "./arsip";
import { hrefUnduhVersi } from "./pemeriksaan";
import { readFileSync } from "node:fs";
import path from "path";

const baca = (rel: string) => readFileSync(path.resolve(rel), "utf8");

test("arsip hanya berisi DIFINALKAN dan DIARSIPKAN", () => {
  assert.deepEqual([...STATUS_ARSIP], ["DIFINALKAN", "DIARSIPKAN"]);
  for (const s of ["DRAF", "DIKIRIM", "PERLU_REVISI", "DISETUJUI"] as StatusDokumen[]) {
    assert.ok(!STATUS_ARSIP.includes(s), `${s} tidak boleh masuk arsip`);
  }
});

test("guru hanya mendapat arsip miliknya (selalu terikat pengajuUserId)", () => {
  for (const milik of ["semua", "saya", "asing", undefined] as (string | undefined)[]) {
    const w = bangunWhereArsip("u-guru", false, { milik: milik as never, q: null, jenis: null, tahun: null });
    assert.equal(w.pengajuUserId, "u-guru");
  }
});

test("pemeriksa: semua = tanpa batas pengaju; milik saya = terikat dirinya", () => {
  const w1 = bangunWhereArsip("u-kamad", true, { milik: "semua", q: null, jenis: null, tahun: null });
  assert.ok(!("pengajuUserId" in w1));
  const w2 = bangunWhereArsip("u-kamad", true, { milik: "saya", q: null, jenis: null, tahun: null });
  assert.equal(w2.pengajuUserId, "u-kamad");
});

test("where arsip selalu membatasi status final dan DokumenFinal valid", () => {
  const w = bangunWhereArsip("u1", true, { q: null, jenis: null, tahun: null });
  assert.deepEqual((w.status as { in: string[] }).in, ["DIFINALKAN", "DIARSIPKAN"]);
  assert.deepEqual(w.dokumenFinal, { isNot: null });
});

test("filter tahun/jenis/milik asing kembali ke nilai aman", () => {
  assert.equal(opsiTahunArsip("2026", 2026), 2026);
  assert.equal(opsiTahunArsip("hacker", 2026), null);
  assert.equal(opsiTahunArsip("1999", 2026), null);
  assert.equal(opsiTahunArsip("9999", 2026), null);
  assert.equal(opsiTahunArsip(null, 2026), null);
  assert.equal(opsiJenisArsip("PROPOSAL"), "PROPOSAL");
  assert.equal(opsiJenisArsip("JENIS_PALSU"), null);
  assert.equal(opsiJenisArsip(null), null);
  assert.equal(opsiMilikArsip("saya"), "saya");
  assert.equal(opsiMilikArsip("asing"), "semua");
  assert.equal(opsiMilikArsip(null), "semua");
});

test("search kosong tidak menambah kondisi judul; filter lengkap masuk where", () => {
  const kosong = bangunWhereArsip("u1", true, { q: "   ", jenis: null, tahun: null, milik: "semua" });
  assert.ok(!("judul" in kosong));
  const penuh = bangunWhereArsip("u1", true, { q: " Laporan ", jenis: "PROPOSAL", tahun: 2026, milik: "semua" });
  assert.deepEqual(penuh.judul, { contains: "Laporan" });
  assert.equal(penuh.jenis, "PROPOSAL");
  const df = penuh.dokumenFinal as { is: { difinalkanPada: { gte: Date; lt: Date } } };
  assert.equal(df.is.difinalkanPada.gte.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(df.is.difinalkanPada.lt.toISOString(), "2027-01-01T00:00:00.000Z");
});

test("daftar tahun arsip menurun dari tahun ini", () => {
  assert.deepEqual(daftarTahunArsip(2026), [2026, 2025, 2024, 2023, 2022]);
  assert.deepEqual(daftarTahunArsip(2026, 2), [2026, 2025]);
});

test("statistik arsip dihitung dari baris terscope", () => {
  const s = hitungStatistikArsip(
    [
      { status: "DIFINALKAN", jenis: "PROPOSAL", pengajuUserId: "u1", difinalkanPada: new Date("2026-03-01T00:00:00Z") },
      { status: "DIARSIPKAN", jenis: "PROPOSAL", pengajuUserId: "u2", difinalkanPada: new Date("2025-07-01T00:00:00Z") },
      { status: "DIFINALKAN", jenis: "DOKUMEN_UMUM", pengajuUserId: "u1", difinalkanPada: new Date("2026-08-01T00:00:00Z") },
    ],
    2026
  );
  assert.deepEqual(s, { total: 3, tahunIni: 2, jumlahJenis: 2 });
});

test("katalog template berasal dari jenis dokumen resmi sistem", () => {
  const katalog = bangunKatalogTemplate();
  assert.deepEqual(katalog.map((k) => k.label), Object.values(JENIS_DOKUMEN_LABEL));
  assert.deepEqual(katalog.map((k) => k.jenis), Object.keys(JENIS_DOKUMEN_LABEL));
  // Semua belum tersedia — jujur, belum ada modul Template Dokumen.
  for (const k of katalog) assert.equal(k.tersedia, false);
});

test("filter katalog: kosong mengembalikan semua; pencarian cocok label/deskripsi", () => {
  const katalog = bangunKatalogTemplate();
  assert.equal(filterKatalogTemplate(katalog, "").length, katalog.length);
  assert.equal(filterKatalogTemplate(katalog, null).length, katalog.length);
  const hasil = filterKatalogTemplate(katalog, "proposal");
  assert.equal(hasil.length, 1);
  assert.equal(hasil[0]?.jenis, "PROPOSAL");
  const hasil2 = filterKatalogTemplate(katalog, "modul");
  assert.equal(hasil2[0]?.jenis, "RPP_MODUL_AJAR");
  assert.equal(filterKatalogTemplate(katalog, "zzztidakada").length, 0);
});

test("langkah panduan menandai langkah yang belum tersedia", () => {
  assert.equal(LANGKAH_TEMPLATE.length, 5);
  assert.equal(LANGKAH_TEMPLATE[0]?.tersedia, false); // unduh template belum ada
  assert.equal(LANGKAH_TEMPLATE.filter((l) => l.tersedia).length, 4);
});

test("unduhan arsip memakai endpoint versiId", () => {
  assert.match(hrefUnduhVersi("v-123"), /^\/api\/administrasi\/versi\/v-123\/download$/);
});

test("kartu arsip tidak merender storage key atau user ID internal", () => {
  const src = baca("components/administrasi/kartu-arsip.tsx");
  assert.ok(!src.includes("kunciPenyimpanan"));
  assert.ok(!src.includes("pengajuUserId"));
  assert.ok(!src.includes("difinalkanOlehId"));
  // Unduhan tetap berbasis versiId.
  assert.match(src, /hrefUnduhVersi|unduhHref/);
});

test("katalog template tidak memiliki tombol unduh", () => {
  const src = baca("components/administrasi/katalog-template.tsx");
  assert.ok(!src.includes("hrefUnduhVersi"));
  assert.ok(!src.includes("/api/administrasi/versi/"));
  assert.match(src, /Template belum tersedia/);
});

test("error state ramah dan tidak menampilkan detail internal", () => {
  const src = baca("app/(administrasi)/administrasi/error.tsx");
  assert.match(src, /reset\(\)/); // tombol Coba Lagi
  assert.ok(!/error\.(message|stack|digest)|ex\.message|\.stack/.test(src));
  assert.match(src, /role="alert"|aria-live/);
});

test("not-found tidak membedakan data tidak ada dan tidak berhak", () => {
  const src = baca("app/(administrasi)/administrasi/not-found.tsx");
  assert.match(src, /Dokumen atau halaman tidak ditemukan/);
  assert.ok(!/tidak berhak|terlarang|forbidden/i.test(src));
});
