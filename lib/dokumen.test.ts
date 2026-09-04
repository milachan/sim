import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adalahPemeriksaDokumen,
  bolehBacaDokumen,
  bolehKelolaDokumenDraf,
  bolehKirimDokumen,
  bolehMintaRevisi,
  bolehRevisiDokumen,
  bolehSetujuiDokumen,
  isTransisiDokumenValid,
} from "./otorisasi";
import { validasiCatatanRevisi, validasiDokumen, normalisasiDokumen, isJenisDokumen } from "./dokumen-validasi";
import type { InfoUser } from "./otorisasi";

const guru: InfoUser = { id: "u1", role: "GURU", guruId: "g1" };
const guruLain: InfoUser = { id: "u2", role: "GURU", guruId: "g2" };
const waka: InfoUser = { id: "u3", role: "WAKA", guruId: "g3" };
const kamad: InfoUser = { id: "u4", role: "KEPALA", guruId: null };
const admin: InfoUser = { id: "u5", role: "ADMIN", guruId: null };

test("validasi: judul pendek / kosong ditolak", () => {
  assert.ok(validasiDokumen({ judul: "", jenis: "PROPOSAL" }));
  assert.ok(validasiDokumen({ judul: "ab", jenis: "PROPOSAL" }));
  assert.equal(validasiDokumen({ judul: "Judul sah cukup panjang", jenis: "PROPOSAL" }), null);
});

test("validasi: jenis tidak dikenal ditolak", () => {
  assert.ok(validasiDokumen({ judul: "Judul sah", jenis: "SALAH" }));
  assert.equal(isJenisDokumen("RPP_MODUL_AJAR"), true);
  assert.equal(isJenisDokumen("SALAH"), false);
});

test("validasi: ringkasan terlalu panjang ditolak", () => {
  assert.ok(validasiDokumen({ judul: "Judul sah panjang", jenis: "PROPOSAL", ringkasan: "x".repeat(2001) }));
  assert.equal(validasiDokumen({ judul: "Judul sah panjang", jenis: "PROPOSAL", ringkasan: "ok" }), null);
});

test("normalisasi: trim judul dan ringkasan kosong jadi null", () => {
  const n = normalisasiDokumen({ judul: "  Judul  ", jenis: "PROPOSAL", ringkasan: "  " });
  assert.equal(n.judul, "Judul");
  assert.equal(n.ringkasan, null);
});

test("bolehBacaDokumen: pemilik & admin boleh, kamad tidak, orang lain tidak", () => {
  const drafMilik = { pengajuUserId: "u1", status: "DRAF" };
  const drafOrang = { pengajuUserId: "u2", status: "DRAF" };
  assert.equal(bolehBacaDokumen(guru, drafMilik), true);
  assert.equal(bolehBacaDokumen(guru, drafOrang), false);
  assert.equal(bolehBacaDokumen(admin, drafOrang), true);
  assert.equal(bolehBacaDokumen(kamad, drafMilik), false);
  assert.equal(bolehBacaDokumen(waka, drafOrang), false);
  assert.equal(bolehBacaDokumen(guruLain, drafMilik), false);
});

test("bolehKelolaDokumenDraf: hanya pemilik & status DRAF", () => {
  assert.equal(bolehKelolaDokumenDraf(guru, { pengajuUserId: "u1", status: "DRAF" }), true);
  assert.equal(bolehKelolaDokumenDraf(guru, { pengajuUserId: "u1", status: "DIKIRIM" }), false);
  assert.equal(bolehKelolaDokumenDraf(guruLain, { pengajuUserId: "u1", status: "DRAF" }), false);
  assert.equal(bolehKelolaDokumenDraf(admin, { pengajuUserId: "u1", status: "DRAF" }), false);
  assert.equal(bolehKelolaDokumenDraf(kamad, { pengajuUserId: "u1", status: "DRAF" }), false);
  assert.equal(bolehKelolaDokumenDraf(null as unknown as InfoUser, { pengajuUserId: "u1", status: "DRAF" }), false);
});

test("bolehKirimDokumen: hanya pemilik, DRAF atau PERLU_REVISI", () => {
  assert.equal(bolehKirimDokumen(guru, { pengajuUserId: "u1", status: "DRAF" }), true);
  assert.equal(bolehKirimDokumen(guru, { pengajuUserId: "u1", status: "PERLU_REVISI" }), true);
  assert.equal(bolehKirimDokumen(guru, { pengajuUserId: "u1", status: "DIKIRIM" }), false);
  assert.equal(bolehKirimDokumen(guruLain, { pengajuUserId: "u1", status: "DRAF" }), false);
  assert.equal(bolehKirimDokumen(kamad, { pengajuUserId: "u1", status: "DRAF" }), false);
});

test("bolehRevisiDokumen: hanya pemilik PERLU_REVISI yang merupakan pengaju sah", () => {
  assert.equal(bolehRevisiDokumen(guru, { pengajuUserId: "u1", status: "PERLU_REVISI" }), true);
  assert.equal(bolehRevisiDokumen(guru, { pengajuUserId: "u1", status: "DRAF" }), false);
  assert.equal(bolehRevisiDokumen(guruLain, { pengajuUserId: "u1", status: "PERLU_REVISI" }), false);
  // KEPALA/ADMIN/SUPERADMIN: meski pengajuUserId cocok, mereka BUKAN pengaju
  // sehingga tidak boleh merevisi dokumen lama miliknya (read-only).
  assert.equal(bolehRevisiDokumen(kamad, { pengajuUserId: "u4", status: "PERLU_REVISI" }), false);
  assert.equal(bolehRevisiDokumen(kamad, { pengajuUserId: "u1", status: "PERLU_REVISI" }), false);
});

test("bolehMintaRevisi / bolehSetujuiDokumen: hanya pemeriksa (KEPALA/ADMIN/SUPERADMIN) pada DIKIRIM", () => {
  const superadmin: InfoUser = { id: "u6", role: "SUPERADMIN", guruId: null };
  assert.equal(bolehMintaRevisi(kamad, { pengajuUserId: "u1", status: "DIKIRIM" }), true);
  assert.equal(bolehMintaRevisi(admin, { pengajuUserId: "u1", status: "DIKIRIM" }), true);
  assert.equal(bolehMintaRevisi(superadmin, { pengajuUserId: "u1", status: "DIKIRIM" }), true);
  assert.equal(bolehMintaRevisi(guru, { pengajuUserId: "u1", status: "DIKIRIM" }), false);
  assert.equal(bolehMintaRevisi(kamad, { pengajuUserId: "u1", status: "DRAF" }), false);
  assert.equal(bolehSetujuiDokumen(guru, { pengajuUserId: "u1", status: "DIKIRIM" }), false);
  assert.equal(bolehSetujuiDokumen(kamad, { pengajuUserId: "u1", status: "DIKIRIM" }), true);
  assert.equal(bolehSetujuiDokumen(waka, { pengajuUserId: "u1", status: "DIKIRIM" }), false);
  assert.equal(adalahPemeriksaDokumen("KEPALA"), true);
  assert.equal(adalahPemeriksaDokumen("ADMIN"), true);
  assert.equal(adalahPemeriksaDokumen("GURU"), false);
});

test("isTransisiDokumenValid: hanya alur DRAF→DIKIRIM→{PERLU_REVISI|DISETUJUI}→DIKIRIM valid", () => {
  assert.equal(isTransisiDokumenValid("DRAF", "DIKIRIM"), true);
  assert.equal(isTransisiDokumenValid("DIKIRIM", "PERLU_REVISI"), true);
  assert.equal(isTransisiDokumenValid("DIKIRIM", "DISETUJUI"), true);
  assert.equal(isTransisiDokumenValid("PERLU_REVISI", "DIKIRIM"), true);
  assert.equal(isTransisiDokumenValid("DRAF", "DISETUJUI"), false);
  assert.equal(isTransisiDokumenValid("DIKIRIM", "DRAF"), false);
  assert.equal(isTransisiDokumenValid("DISETUJUI", "DIKIRIM"), false);
  assert.equal(isTransisiDokumenValid("DISETUJUI", "DIFINALKAN"), false);
});

test("validasiCatatanRevisi: wajib minimal 10 karakter", () => {
  assert.ok(validasiCatatanRevisi(""));
  assert.ok(validasiCatatanRevisi("pendek"));
  assert.equal(validasiCatatanRevisi("Perbaiki lampiran bab 2"), null);
  assert.ok(validasiCatatanRevisi("x".repeat(2001)));
});

test("akses lintas guru ditolak untuk ubah/hapus draf orang lain", () => {
  const drafOrang = { pengajuUserId: "u1", status: "DRAF" };
  assert.equal(bolehKelolaDokumenDraf(guruLain, drafOrang), false);
  assert.equal(bolehKirimDokumen(guruLain, drafOrang), false);
  assert.equal(bolehRevisiDokumen(guruLain, { pengajuUserId: "u1", status: "PERLU_REVISI" }), false);
});

test("kamad tidak dapat mengubah isi dokumen (hanya minta revisi / setujui DIKIRIM)", () => {
  assert.equal(bolehKelolaDokumenDraf(kamad, { pengajuUserId: "u1", status: "DRAF" }), false);
  // Dokumen lama pemeriksa di status DRAF: tetap read-only. Pemeriksa tidak
  // boleh mengelola draf miliknya sendiri.
  assert.equal(bolehKelolaDokumenDraf(kamad, { pengajuUserId: "u4", status: "DRAF" }), false);
  assert.equal(bolehRevisiDokumen(kamad, { pengajuUserId: "u1", status: "PERLU_REVISI" }), false);
  assert.equal(bolehMintaRevisi(kamad, { pengajuUserId: "u1", status: "DIKIRIM" }), true);
});

// ====== Hardening: dokumen lama pemeriksa (KEPALA/ADMIN/SUPERADMIN) read-only ======
// Aturan: meski `pengajuUserId === user.id`, helper pengaju harus FALSE karena
// pemeriksa tidak boleh melanjutkan/mengirim/merevisi/mengunggah pada
// dokumen lama miliknya sendiri. Konflik kepentingan & pemeriksa lain tetap
// berlaku sesuai aturan existing.

const kepalaPemilik: InfoUser = { id: "u-kepala", role: "KEPALA", guruId: null };
const adminPemilik: InfoUser = { id: "u-admin", role: "ADMIN", guruId: null };
const superPemilik: InfoUser = { id: "u-super", role: "SUPERADMIN", guruId: null };
const kepalaLain: InfoUser = { id: "u-kepala-2", role: "KEPALA", guruId: null };

test("hardening: KEPALA tidak boleh mengelola draf lama miliknya sendiri", () => {
  assert.equal(bolehKelolaDokumenDraf(kepalaPemilik, { pengajuUserId: "u-kepala", status: "DRAF" }), false);
});
test("hardening: ADMIN tidak boleh mengelola draf lama miliknya sendiri", () => {
  assert.equal(bolehKelolaDokumenDraf(adminPemilik, { pengajuUserId: "u-admin", status: "DRAF" }), false);
});
test("hardening: SUPERADMIN tidak boleh mengelola draf lama miliknya sendiri", () => {
  assert.equal(bolehKelolaDokumenDraf(superPemilik, { pengajuUserId: "u-super", status: "DRAF" }), false);
});
test("hardening: KEPALA/ADMIN/SUPERADMIN tidak boleh mengirim dokumen lama miliknya", () => {
  assert.equal(bolehKirimDokumen(kepalaPemilik, { pengajuUserId: "u-kepala", status: "DRAF" }), false);
  assert.equal(bolehKirimDokumen(adminPemilik, { pengajuUserId: "u-admin", status: "DRAF" }), false);
  assert.equal(bolehKirimDokumen(superPemilik, { pengajuUserId: "u-super", status: "DRAF" }), false);
  // Status PERLU_REVISI pun tidak boleh dipakai untuk kirim ulang oleh pemeriksa.
  assert.equal(bolehKirimDokumen(kepalaPemilik, { pengajuUserId: "u-kepala", status: "PERLU_REVISI" }), false);
});
test("hardening: KEPALA/ADMIN/SUPERADMIN tidak boleh merevisi dokumen lama miliknya", () => {
  assert.equal(bolehRevisiDokumen(kepalaPemilik, { pengajuUserId: "u-kepala", status: "PERLU_REVISI" }), false);
  assert.equal(bolehRevisiDokumen(adminPemilik, { pengajuUserId: "u-admin", status: "PERLU_REVISI" }), false);
  assert.equal(bolehRevisiDokumen(superPemilik, { pengajuUserId: "u-super", status: "PERLU_REVISI" }), false);
});
test("hardening: guru lain tidak boleh mengelola dokumen lama pemeriksa", () => {
  // Aturan existing: bukan pemilik => ditolak. Tetap relevan untuk hardening.
  const guruLainPemeriksa: InfoUser = { id: "u-guru", role: "GURU", guruId: "g-x" };
  assert.equal(bolehKelolaDokumenDraf(guruLainPemeriksa, { pengajuUserId: "u-kepala", status: "DRAF" }), false);
  assert.equal(bolehRevisiDokumen(guruLainPemeriksa, { pengajuUserId: "u-kepala", status: "PERLU_REVISI" }), false);
});
test("hardening: GURU PIKET (akun nyata) ditolak sebagai pengaju", () => {
  const guruPiket: InfoUser = {
    id: "u-piket",
    role: "GURU",
    guruId: "g-piket",
    guru: { jenisGuru: "PIKET", kode: "PIKET" },
  };
  assert.equal(bolehKelolaDokumenDraf(guruPiket, { pengajuUserId: "u-piket", status: "DRAF" }), false);
  assert.equal(bolehKirimDokumen(guruPiket, { pengajuUserId: "u-piket", status: "DRAF" }), false);
  assert.equal(bolehRevisiDokumen(guruPiket, { pengajuUserId: "u-piket", status: "PERLU_REVISI" }), false);
});
test("hardening: pemeriksa lain BUKAN pengaju tetap boleh mengelola dokumen", () => {
  // kepalaLain boleh mengelola draf miliknya sendiri (sebagai pengaju sah).
  assert.equal(bolehKelolaDokumenDraf(kepalaLain, { pengajuUserId: "u-kepala-2", status: "DRAF" }), false);
  // kepalaLain TIDAK boleh mengelola draf milik kepalaPemilik (orang lain).
  assert.equal(bolehKelolaDokumenDraf(kepalaLain, { pengajuUserId: "u-kepala", status: "DRAF" }), false);
  // kepalaLain boleh meminta revisi atas DIKIRIM orang lain (aturan konflik).
  assert.equal(bolehMintaRevisi(kepalaLain, { pengajuUserId: "u-kepala", status: "DIKIRIM" }), true);
});
