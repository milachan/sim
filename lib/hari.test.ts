import { test } from "node:test";
import assert from "node:assert/strict";
import { hariDariTanggal, perluBuatPertemuanHariIni } from "./absensi-harian";
import { jamPembukaHari } from "./constants";

// Helper berbasis WIB (UTC+7): masukkan instan UTC, hasil = hari kalender WIB.
const wib = (iso: string) => new Date(iso);

test("hariDariTanggal: Senin WIB → SENIN", () => {
  const t = wib("2026-08-17T03:00:00Z"); // 10:00 WIB Senin
  assert.equal(hariDariTanggal(t), "SENIN");
});

test("hariDariTanggal: Selasa WIB → SELASA", () => {
  const t = wib("2026-08-18T03:00:00Z");
  assert.equal(hariDariTanggal(t), "SELASA");
});

test("hariDariTanggal: Sabtu WIB → SABTU", () => {
  const t = wib("2026-08-15T03:00:00Z"); // 10:00 WIB Sabtu
  assert.equal(hariDariTanggal(t), "SABTU");
});

test("hariDariTanggal: Minggu WIB → null", () => {
  const t = wib("2026-08-16T03:00:00Z"); // 10:00 WIB Minggu
  assert.equal(hariDariTanggal(t), null);
});

test("peralihan Sabtu malam ke Minggu WIB", () => {
  // 2026-08-15 16:59 UTC = 23:59 WIB Sabtu → masih SABTU
  assert.equal(hariDariTanggal(wib("2026-08-15T16:59:00Z")), "SABTU");
  // 2026-08-15 17:00 UTC = 00:00 WIB Minggu → null (bukan SABTU)
  assert.equal(hariDariTanggal(wib("2026-08-15T17:00:00Z")), null);
});

test("peralihan Minggu malam ke Senin WIB", () => {
  // 2026-08-16 16:59 UTC = 23:59 WIB Minggu → null
  assert.equal(hariDariTanggal(wib("2026-08-16T16:59:00Z")), null);
  // 2026-08-16 17:00 UTC = 00:00 WIB Senin → SENIN
  assert.equal(hariDariTanggal(wib("2026-08-16T17:00:00Z")), "SENIN");
});

test("perluBuatPertemuanHariIni: Minggu tidak membuat pertemuan apa pun", () => {
  assert.deepEqual(perluBuatPertemuanHariIni(null, ["j1", "j2"], []), []);
  assert.deepEqual(perluBuatPertemuanHariIni(null, ["j1", "j2"], ["j1"]), []);
});

test("perluBuatPertemuanHariIni: Senin hanya membuat yang belum ada", () => {
  assert.deepEqual(perluBuatPertemuanHariIni("SENIN", ["j1", "j2", "j3"], ["j1"]), ["j2", "j3"]);
});

test("perluBuatPertemuanHariIni: Sabtu membuat yang belum ada", () => {
  assert.deepEqual(perluBuatPertemuanHariIni("SABTU", ["j1", "j2"], []), ["j1", "j2"]);
});

test("jamPembukaHari: Senin dibuka jam ke-2 (jam 1 upacara bendera)", () => {
  assert.equal(jamPembukaHari("SENIN"), 2);
});

test("jamPembukaHari: Selasa–Sabtu dibuka jam ke-1", () => {
  for (const h of ["SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"] as const) {
    assert.equal(jamPembukaHari(h), 1, h);
  }
});