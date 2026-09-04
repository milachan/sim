import { test } from "node:test";
import assert from "node:assert/strict";
import { hitungStatusPertemuan } from "./status";

test("TERKIRIM tanpa absensi pribadi tetap LENGKAP", () => {
  assert.equal(hitungStatusPertemuan({ absensiCount: 0, jurnalStatus: "TERKIRIM" }), "LENGKAP");
});

test("TERKIRIM dengan absensi sebagian tetap LENGKAP", () => {
  assert.equal(hitungStatusPertemuan({ absensiCount: 2, jurnalStatus: "TERKIRIM" }), "LENGKAP");
});

test("DRAFT tetap JURNAL_TERISI walau absensi kosong", () => {
  assert.equal(hitungStatusPertemuan({ absensiCount: 0, jurnalStatus: "DRAFT" }), "JURNAL_TERISI");
});

test("DRAFT dengan absensi tetap JURNAL_TERISI", () => {
  assert.equal(hitungStatusPertemuan({ absensiCount: 5, jurnalStatus: "DRAFT" }), "JURNAL_TERISI");
});

test("absensi tanpa jurnal = ABSENSI_TERISI", () => {
  assert.equal(hitungStatusPertemuan({ absensiCount: 3, jurnalStatus: null }), "ABSENSI_TERISI");
});

test("tanpa jurnal tanpa absensi = BELUM_DIMULAI", () => {
  assert.equal(hitungStatusPertemuan({ absensiCount: 0, jurnalStatus: null }), "BELUM_DIMULAI");
});

test("TIDAK_TERLAKSANA override semua", () => {
  assert.equal(hitungStatusPertemuan({ absensiCount: 10, jurnalStatus: "TERKIRIM", tidakTerlaksana: true }), "TIDAK_TERLAKSANA");
  assert.equal(hitungStatusPertemuan({ absensiCount: 0, jurnalStatus: null, tidakTerlaksana: true }), "TIDAK_TERLAKSANA");
});

test("hapus absensi pribadi tidak menurunkan LENGKAP bila jurnal TERKIRIM", () => {
  const sebelum = hitungStatusPertemuan({ absensiCount: 10, jurnalStatus: "TERKIRIM" });
  const sesudah = hitungStatusPertemuan({ absensiCount: 0, jurnalStatus: "TERKIRIM" });
  assert.equal(sebelum, "LENGKAP");
  assert.equal(sesudah, "LENGKAP");
});

test("hapus absensi pribadi dari JURNAL_TERISI tetap JURNAL_TERISI", () => {
  assert.equal(hitungStatusPertemuan({ absensiCount: 5, jurnalStatus: "DRAFT" }), "JURNAL_TERISI");
  assert.equal(hitungStatusPertemuan({ absensiCount: 0, jurnalStatus: "DRAFT" }), "JURNAL_TERISI");
});
