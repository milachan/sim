import { test } from "node:test";
import assert from "node:assert/strict";
import { bolehMengajukanDokumen, PESAN_TOLAK_MENGAJUKAN } from "./otorisasi";
import type { InfoUser } from "./otorisasi";

// Test ini memverifikasi aturan sumber tunggal untuk pengajuan dokumen pribadi
// (lib/otorisasi.ts#bolehMengajukanDokumen) yang dipakai oleh server action
// buatDokumen, halaman /baru, halaman /dokumen-saya, dashboard, dan endpoint
// upload versi.

const guruBiasa: InfoUser = { id: "u-guru", role: "GURU", guruId: "g1", guru: { jenisGuru: "BIASA", kode: "GURU001" } };
const guruPiket: InfoUser = { id: "u-piket", role: "GURU", guruId: "g-piket", guru: { jenisGuru: "PIKET", kode: "PIKET" } };
const waka: InfoUser = { id: "u-waka", role: "WAKA", guruId: "g3", guru: { jenisGuru: "WALI_KELAS", kode: "WAKA001" } };
const kepala: InfoUser = { id: "u-kepala", role: "KEPALA", guruId: null };
const admin: InfoUser = { id: "u-admin", role: "ADMIN", guruId: null };
const superAdmin: InfoUser = { id: "u-super", role: "SUPERADMIN", guruId: null };

test("server action guard: GURU non-PIKET dapat lewat guard buatDokumen", () => {
  assert.equal(bolehMengajukanDokumen(guruBiasa), true);
});

test("server action guard: WAKA dapat lewat guard buatDokumen", () => {
  assert.equal(bolehMengajukanDokumen(waka), true);
});

test("server action guard: GURU PIKET ditolak dengan akun nyata", () => {
  // Bukan role fiktif "PIKET" — GURU dengan jenisGuru PIKET & kode PIKET.
  assert.equal(bolehMengajukanDokumen(guruPiket), false);
});

test("server action guard: KEPALA ditolak sebelum prisma.dokumen.create", () => {
  assert.equal(bolehMengajukanDokumen(kepala), false);
});

test("server action guard: ADMIN ditolak sebelum database", () => {
  assert.equal(bolehMengajukanDokumen(admin), false);
});

test("server action guard: SUPERADMIN ditolak sebelum database", () => {
  assert.equal(bolehMengajukanDokumen(superAdmin), false);
});

test("server action guard: GURU dengan jenisGuru PIKET tapi kode lain bukan PIKET (diizinkan)", () => {
  // Tidak semua GURU dengan jenisGuru PIKET adalah akun PIKET yang diblokir;
  // hanya yang kodenya PIKET persis.
  const palsu: InfoUser = { id: "u", role: "GURU", guruId: "g", guru: { jenisGuru: "PIKET", kode: "GURU_PIKET" } };
  assert.equal(bolehMengajukanDokumen(palsu), true);
});

test("server action guard: pesan penolakan generik (PESAN_TOLAK_MENGAJUKAN)", () => {
  assert.match(PESAN_TOLAK_MENGAJUKAN, /tidak dapat membuat pengajuan/i);
  assert.equal(/pemeriksa/i.test(PESAN_TOLAK_MENGAJUKAN), false);
});
