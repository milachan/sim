import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adalahAkunPiket,
  adalahKonflikKepentingan,
  bolehKelolaPertemuan,
  bolehBacaPertemuan,
  bolehKelolaJadwal,
  bolehBacaJadwal,
  bolehKelolaKegiatanNilai,
  bolehBacaKegiatanNilai,
  bolehHapusCatatanKejadian,
  bolehMengajukanDokumen,
  bolehMintaRevisi,
  bolehSetujuiDokumen,
  PESAN_TOLAK_MENGAJUKAN,
  type InfoUser,
} from "./otorisasi";

const guruPemilik: InfoUser = { id: "u1", role: "GURU", guruId: "g1" };
const guruLain: InfoUser = { id: "u2", role: "GURU", guruId: "g2" };
const guruTanpaGuruId: InfoUser = { id: "u3", role: "GURU", guruId: null };
const admin: InfoUser = { id: "u4", role: "ADMIN", guruId: null };
const waka: InfoUser = { id: "u5", role: "WAKA", guruId: null };
const kepala: InfoUser = { id: "u6", role: "KEPALA", guruId: null };
const kepalaPemilik: InfoUser = { id: "u-kepala", role: "KEPALA", guruId: null };
const adminPemeriksa: InfoUser = { id: "u-admin", role: "ADMIN", guruId: null };
const superAdmin: InfoUser = { id: "u-super", role: "SUPERADMIN", guruId: null };
const kepalaLain: InfoUser = { id: "u-kepala-2", role: "KEPALA", guruId: null };
const guruPemeriksa: InfoUser = { id: "u-guru", role: "GURU", guruId: "g9" };

// Pertemuan otomatis dari jadwal milik g1
const pertemuanOtomatisG1 = { jadwalGuruId: "g1", dibuatOlehId: null };
// Pertemuan otomatis dari jadwal milik g2
const pertemuanOtomatisG2 = { jadwalGuruId: "g2", dibuatOlehId: null };
// Pertemuan manual buatan u1
const pertemuanManualU1 = { jadwalGuruId: null, dibuatOlehId: "u1" };
// Pertemuan manual buatan u2
const pertemuanManualU2 = { jadwalGuruId: null, dibuatOlehId: "u2" };

test("bolehKelolaPertemuan: pemilik jadwal boleh kelola pertemuan otomatisnya", () => {
  assert.equal(bolehKelolaPertemuan(guruPemilik, pertemuanOtomatisG1), true);
});

test("bolehKelolaPertemuan: guru lain TIDAK boleh kelola pertemuan otomatis milik orang lain", () => {
  assert.equal(bolehKelolaPertemuan(guruLain, pertemuanOtomatisG1), false);
  assert.equal(bolehKelolaPertemuan(guruPemilik, pertemuanOtomatisG2), false);
});

test("bolehKelolaPertemuan: pembuat boleh kelola pertemuan manualnya sendiri", () => {
  assert.equal(bolehKelolaPertemuan(guruPemilik, pertemuanManualU1), true);
});

test("bolehKelolaPertemuan: guru lain TIDAK boleh kelola pertemuan manual orang lain", () => {
  assert.equal(bolehKelolaPertemuan(guruPemilik, pertemuanManualU2), false);
  assert.equal(bolehKelolaPertemuan(guruLain, pertemuanManualU1), false);
});

test("bolehKelolaPertemuan: admin boleh kelola semua pertemuan", () => {
  assert.equal(bolehKelolaPertemuan(admin, pertemuanOtomatisG1), true);
  assert.equal(bolehKelolaPertemuan(admin, pertemuanOtomatisG2), true);
  assert.equal(bolehKelolaPertemuan(admin, pertemuanManualU2), true);
});

test("bolehKelolaPertemuan: waka/kepala tanpa guruId TIDAK boleh kelola pertemuan apa pun", () => {
  assert.equal(bolehKelolaPertemuan(waka, pertemuanOtomatisG1), false);
  assert.equal(bolehKelolaPertemuan(kepala, pertemuanOtomatisG1), false);
  assert.equal(bolehKelolaPertemuan(waka, pertemuanManualU1), false);
});

test("waka terhubung bisa kelola data miliknya sendiri", () => {
  const wakaPengajar = { id: "w1", role: "WAKA" as const, guruId: "g1" };
  assert.equal(bolehKelolaPertemuan(wakaPengajar, pertemuanOtomatisG1), true);
  assert.equal(bolehKelolaJadwal(wakaPengajar, "g1"), true);
  assert.equal(bolehKelolaKegiatanNilai(wakaPengajar, "g1"), true);
  assert.equal(bolehHapusCatatanKejadian(wakaPengajar, "w1"), true);
});

test("waka terhubung TIDAK bisa mengubah data guru lain", () => {
  const wakaPengajar = { id: "w1", role: "WAKA" as const, guruId: "g1" };
  assert.equal(bolehKelolaPertemuan(wakaPengajar, pertemuanOtomatisG2), false);
  assert.equal(bolehKelolaJadwal(wakaPengajar, "g2"), false);
  assert.equal(bolehKelolaKegiatanNilai(wakaPengajar, "g2"), false);
  assert.equal(bolehHapusCatatanKejadian(wakaPengajar, "u2"), false);
});

test("bolehKelolaPertemuan: guru tanpa guruId ditolak untuk semua pertemuan", () => {
  assert.equal(bolehKelolaPertemuan(guruTanpaGuruId, pertemuanOtomatisG1), false);
  assert.equal(bolehKelolaPertemuan(guruTanpaGuruId, pertemuanManualU2), false);
  assert.equal(bolehKelolaPertemuan(guruTanpaGuruId, pertemuanManualU1), false);
});

test("bolehBacaPertemuan: pemilik, admin, waka, dan kepala boleh membaca; guru lain & guru tanpa guruId tidak", () => {
  assert.equal(bolehBacaPertemuan(guruPemilik, pertemuanOtomatisG1), true);
  assert.equal(bolehBacaPertemuan(admin, pertemuanOtomatisG2), true);
  assert.equal(bolehBacaPertemuan(waka, pertemuanOtomatisG2), true);
  assert.equal(bolehBacaPertemuan(kepala, pertemuanOtomatisG2), true);
  assert.equal(bolehBacaPertemuan(guruLain, pertemuanOtomatisG1), false);
  assert.equal(bolehBacaPertemuan(guruTanpaGuruId, pertemuanOtomatisG1), false);
});

test("bolehKelolaJadwal: pemilik boleh, guru lain tidak, admin boleh, waka/kepala tidak", () => {
  assert.equal(bolehKelolaJadwal(guruPemilik, "g1"), true);
  assert.equal(bolehKelolaJadwal(guruLain, "g1"), false);
  assert.equal(bolehKelolaJadwal(admin, "g1"), true);
  assert.equal(bolehKelolaJadwal(waka, "g1"), false);
  assert.equal(bolehKelolaJadwal(guruTanpaGuruId, "g1"), false);
});

test("bolehKelolaJadwal: waka terhubung boleh kelola jadwal miliknya, tidak guru lain", () => {
  const wakaPengajar: InfoUser = { id: "w1", role: "WAKA", guruId: "g1" };
  assert.equal(bolehKelolaJadwal(wakaPengajar, "g1"), true);
  assert.equal(bolehKelolaJadwal(wakaPengajar, "g2"), false);
});

test("bolehBacaJadwal: pemilik, admin, waka, kepala boleh; guru lain & guru tanpa guruId tidak", () => {
  assert.equal(bolehBacaJadwal(guruPemilik, "g1"), true);
  assert.equal(bolehBacaJadwal(admin, "g2"), true);
  assert.equal(bolehBacaJadwal(waka, "g2"), true);
  assert.equal(bolehBacaJadwal(kepala, "g2"), true);
  assert.equal(bolehBacaJadwal(guruLain, "g1"), false);
  assert.equal(bolehBacaJadwal(guruTanpaGuruId, "g1"), false);
});

test("bolehKelolaKegiatanNilai: pemilik boleh, guru lain tidak, admin boleh, waka/kepala tidak", () => {
  assert.equal(bolehKelolaKegiatanNilai(guruPemilik, "g1"), true);
  assert.equal(bolehKelolaKegiatanNilai(guruLain, "g1"), false);
  assert.equal(bolehKelolaKegiatanNilai(admin, "g1"), true);
  assert.equal(bolehKelolaKegiatanNilai(waka, "g1"), false);
  assert.equal(bolehKelolaKegiatanNilai(guruTanpaGuruId, "g1"), false);
});

test("bolehBacaKegiatanNilai: pemilik, admin, waka, kepala boleh; guru lain & guru tanpa guruId tidak", () => {
  assert.equal(bolehBacaKegiatanNilai(guruPemilik, "g1"), true);
  assert.equal(bolehBacaKegiatanNilai(admin, "g2"), true);
  assert.equal(bolehBacaKegiatanNilai(waka, "g2"), true);
  assert.equal(bolehBacaKegiatanNilai(kepala, "g2"), true);
  assert.equal(bolehBacaKegiatanNilai(guruLain, "g1"), false);
  assert.equal(bolehBacaKegiatanNilai(guruTanpaGuruId, "g1"), false);
});

test("bolehHapusCatatanKejadian: pembuat boleh, admin boleh, guru lain tidak, guru tanpa guruId tidak", () => {
  assert.equal(bolehHapusCatatanKejadian(guruPemilik, "u1"), true);
  assert.equal(bolehHapusCatatanKejadian(admin, "u2"), true);
  assert.equal(bolehHapusCatatanKejadian(guruLain, "u2"), true);
  assert.equal(bolehHapusCatatanKejadian(guruPemilik, "u2"), false);
  assert.equal(bolehHapusCatatanKejadian(waka, "u1"), false);
  assert.equal(bolehHapusCatatanKejadian(guruTanpaGuruId, "u1"), false);
});

// ====== Konflik kepentingan: pemeriksa tidak boleh menandatangani dokumen miliknya sendiri ======

test("adalahKonflikKepentingan: pengaju == user.id terdeteksi", () => {
  assert.equal(adalahKonflikKepentingan(kepalaPemilik, { pengajuUserId: "u-kepala", status: "DIKIRIM" }), true);
  assert.equal(adalahKonflikKepentingan(adminPemeriksa, { pengajuUserId: "u-admin", status: "DISETUJUI" }), true);
  assert.equal(adalahKonflikKepentingan(superAdmin, { pengajuUserId: "u-super", status: "DIKIRIM" }), true);
});

test("adalahKonflikKepentingan: pemeriksa lain bukan konflik", () => {
  assert.equal(adalahKonflikKepentingan(kepalaPemilik, { pengajuUserId: "u-orang", status: "DIKIRIM" }), false);
  assert.equal(adalahKonflikKepentingan(kepalaLain, { pengajuUserId: "u-kepala", status: "DIKIRIM" }), false);
  assert.equal(adalahKonflikKepentingan(null, { pengajuUserId: "u-kepala", status: "DIKIRIM" }), false);
});

test("bolehMintaRevisi: KEPALA tidak boleh meminta revisi dokumen miliknya sendiri", () => {
  assert.equal(bolehMintaRevisi(kepalaPemilik, { pengajuUserId: "u-kepala", status: "DIKIRIM" }), false);
});

test("bolehMintaRevisi: ADMIN/SUPERADMIN tidak boleh meminta revisi dokumen miliknya sendiri", () => {
  assert.equal(bolehMintaRevisi(adminPemeriksa, { pengajuUserId: "u-admin", status: "DIKIRIM" }), false);
  assert.equal(bolehMintaRevisi(superAdmin, { pengajuUserId: "u-super", status: "DIKIRIM" }), false);
});

test("bolehMintaRevisi: pemeriksa lain tetap boleh meminta revisi", () => {
  assert.equal(bolehMintaRevisi(kepalaLain, { pengajuUserId: "u-kepala", status: "DIKIRIM" }), true);
  assert.equal(bolehMintaRevisi(adminPemeriksa, { pengajuUserId: "u-orang", status: "DIKIRIM" }), true);
  assert.equal(bolehMintaRevisi(superAdmin, { pengajuUserId: "u-orang", status: "DIKIRIM" }), true);
});

test("bolehMintaRevisi: non-pemeriksa dan status salah tetap ditolak", () => {
  assert.equal(bolehMintaRevisi(guruPemeriksa, { pengajuUserId: "u-guru", status: "DIKIRIM" }), false);
  assert.equal(bolehMintaRevisi(kepalaPemilik, { pengajuUserId: "u-orang", status: "PERLU_REVISI" }), false);
  assert.equal(bolehMintaRevisi(kepalaPemilik, { pengajuUserId: "u-orang", status: "DISETUJUI" }), false);
});

test("bolehSetujuiDokumen: KEPALA tidak boleh menyetujui dokumen miliknya sendiri", () => {
  assert.equal(bolehSetujuiDokumen(kepalaPemilik, { pengajuUserId: "u-kepala", status: "DIKIRIM" }), false);
});

test("bolehSetujuiDokumen: ADMIN/SUPERADMIN tidak boleh menyetujui dokumen miliknya sendiri", () => {
  assert.equal(bolehSetujuiDokumen(adminPemeriksa, { pengajuUserId: "u-admin", status: "DIKIRIM" }), false);
  assert.equal(bolehSetujuiDokumen(superAdmin, { pengajuUserId: "u-super", status: "DIKIRIM" }), false);
});

test("bolehSetujuiDokumen: pemeriksa lain tetap boleh menyetujui", () => {
  assert.equal(bolehSetujuiDokumen(kepalaLain, { pengajuUserId: "u-kepala", status: "DIKIRIM" }), true);
  assert.equal(bolehSetujuiDokumen(adminPemeriksa, { pengajuUserId: "u-orang", status: "DIKIRIM" }), true);
});

test("bolehSetujuiDokumen: status salah dan non-pemeriksa tetap ditolak", () => {
  assert.equal(bolehSetujuiDokumen(kepalaPemilik, { pengajuUserId: "u-orang", status: "DISETUJUI" }), false);
  assert.equal(bolehSetujuiDokumen(kepalaPemilik, { pengajuUserId: "u-orang", status: "PERLU_REVISI" }), false);
  assert.equal(bolehSetujuiDokumen(guruPemeriksa, { pengajuUserId: "u-orang", status: "DIKIRIM" }), false);
});

// ====== Sumber tunggal aturan pengajuan dokumen pribadi ======
// GURU non-PIKET & WAKA boleh. KEPALA/ADMIN/SUPERADMIN/GURU PIKET/user null
// ditolak. Pemeriksaan role literal tidak boleh tersebar; helper ini dipakai
// oleh server action, page guard, dan endpoint upload.

const guruBiasa: InfoUser = { id: "u-guru", role: "GURU", guruId: "g1", guru: { jenisGuru: "BIASA", kode: "GURU001" } };
const guruPiket: InfoUser = { id: "u-piket", role: "GURU", guruId: "g-piket", guru: { jenisGuru: "PIKET", kode: "PIKET" } };
const guruBk: InfoUser = { id: "u-bk", role: "GURU", guruId: "g-bk", guru: { jenisGuru: "BK", kode: "BK001" } };
const wakaTerhubung: InfoUser = { id: "u-waka", role: "WAKA", guruId: "g-waka", guru: { jenisGuru: "WALI_KELAS", kode: "WAKA001" } };

test("bolehMengajukanDokumen: GURU non-PIKET (BIASA) boleh mengajukan", () => {
  assert.equal(bolehMengajukanDokumen(guruBiasa), true);
});

test("bolehMengajukanDokumen: GURU BK boleh mengajukan", () => {
  assert.equal(bolehMengajukanDokumen(guruBk), true);
});

test("bolehMengajukanDokumen: GURU tanpa data guru (tidak bisa verifikasi PIKET) tetap non-PIKET", () => {
  // Tanpa data guru kita tidak bisa memastikan PIKET — helper bersikap
  // konservatif-aman: perlakukan sebagai bukan PIKET (diizinkan mengajukan).
  // Guard eksternal (layout Administrasi) yang menolak sesi PIKET.
  const tanpaGuru: InfoUser = { id: "u-x", role: "GURU", guruId: "g1" };
  assert.equal(bolehMengajukanDokumen(tanpaGuru), true);
});

test("bolehMengajukanDokumen: WAKA boleh mengajukan", () => {
  assert.equal(bolehMengajukanDokumen(wakaTerhubung), true);
});

test("bolehMengajukanDokumen: GURU PIKET ditolak (akun nyata, role GURU + jenisGuru PIKET + kode PIKET)", () => {
  assert.equal(bolehMengajukanDokumen(guruPiket), false);
});

test("bolehMengajukanDokumen: KEPALA ditolak", () => {
  assert.equal(bolehMengajukanDokumen({ id: "u-kepala", role: "KEPALA", guruId: null }), false);
});

test("bolehMengajukanDokumen: ADMIN ditolak", () => {
  assert.equal(bolehMengajukanDokumen({ id: "u-admin", role: "ADMIN", guruId: null }), false);
});

test("bolehMengajukanDokumen: SUPERADMIN ditolak", () => {
  assert.equal(bolehMengajukanDokumen({ id: "u-super", role: "SUPERADMIN", guruId: null }), false);
});

test("bolehMengajukanDokumen: user null/undefined ditolak", () => {
  assert.equal(bolehMengajukanDokumen(null), false);
  assert.equal(bolehMengajukanDokumen(undefined), false);
});

test("adalahAkunPiket: triple-check role+jenisGuru+kode", () => {
  assert.equal(adalahAkunPiket(guruPiket), true);
  assert.equal(adalahAkunPiket(guruBiasa), false);
  assert.equal(adalahAkunPiket(guruBk), false);
  assert.equal(adalahAkunPiket(wakaTerhubung), false);
  assert.equal(adalahAkunPiket({ id: "k", role: "KEPALA", guruId: null }), false);
  assert.equal(adalahAkunPiket(null), false);
  assert.equal(adalahAkunPiket(undefined), false);
  // GURU tanpa jenisGuru PIKET: bukan piket
  assert.equal(adalahAkunPiket({ id: "u", role: "GURU", guruId: "g", guru: { jenisGuru: "BIASA", kode: "X" } }), false);
  // GURU dengan jenisGuru PIKET tapi kode berbeda: bukan piket
  assert.equal(adalahAkunPiket({ id: "u", role: "GURU", guruId: "g", guru: { jenisGuru: "PIKET", kode: "LAIN" } }), false);
  // GURU dengan kode PIKET tapi jenisGuru berbeda: bukan piket
  assert.equal(adalahAkunPiket({ id: "u", role: "GURU", guruId: "g", guru: { jenisGuru: "BIASA", kode: "PIKET" } }), false);
});

test("PESAN_TOLAK_MENGAJUKAN: pesan generik (tidak menyebut 'pemeriksa')", () => {
  assert.match(PESAN_TOLAK_MENGAJUKAN, /tidak dapat membuat pengajuan/i);
  assert.equal(/pemeriksa/i.test(PESAN_TOLAK_MENGAJUKAN), false, "pesan generik tidak boleh menyebut pemeriksa (karena PIKET juga ditolak)");
});