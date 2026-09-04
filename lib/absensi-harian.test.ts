import { test } from "node:test";
import assert from "node:assert/strict";
import { validasiKelengkapanAbsensiHarian } from "./absensi-harian";

const aktif30 = Array.from({ length: 30 }, (_, i) => `s${i + 1}`);

test("lengkap 30 siswa", () => {
  const entries = aktif30.map((id) => ({ siswaId: id, status: "HADIR" as const }));
  const v = validasiKelengkapanAbsensiHarian(entries, aktif30);
  assert.equal(v.ok, true);
  assert.equal(v.belum, 0);
});

test("29 dari 30 ditolak belum lengkap", () => {
  const entries = aktif30.slice(0, 29).map((id) => ({ siswaId: id, status: "HADIR" as const }));
  const v = validasiKelengkapanAbsensiHarian(entries, aktif30);
  assert.equal(v.ok, false);
  assert.equal(v.belum, 1);
  assert.match(v.pesan!, /Masih ada 1 siswa/);
});

test("siswa kelas lain ditolak", () => {
  const entries = [{ siswaId: "sX", status: "HADIR" as const }];
  const v = validasiKelengkapanAbsensiHarian(entries, aktif30);
  assert.equal(v.ok, false);
  assert.equal(v.siswaLainIds.length, 1);
});

test("duplikat ditolak", () => {
  const entries = [
    { siswaId: "s1", status: "HADIR" as const },
    { siswaId: "s1", status: "SAKIT" as const },
  ];
  const v = validasiKelengkapanAbsensiHarian(entries, ["s1", "s2"]);
  assert.equal(v.ok, false);
  assert.equal(v.duplikatIds.length, 1);
});

test("status tidak valid ditolak", () => {
  const v = validasiKelengkapanAbsensiHarian([{ siswaId: "s1", status: "KABUR" }], ["s1"]);
  assert.equal(v.ok, false);
  assert.equal(v.statusTidakValid.length, 1);
});

test("boleh sebagian untuk entry pribadi cek — validasi harian tetap wajib lengkap", () => {
  const v = validasiKelengkapanAbsensiHarian([], aktif30);
  assert.equal(v.ok, false);
  assert.equal(v.belum, 30);
});

test("kelas dengan 1 siswa sebagian 0 ditolak", () => {
  const v = validasiKelengkapanAbsensiHarian([], ["s1"]);
  assert.equal(v.ok, false);
});
