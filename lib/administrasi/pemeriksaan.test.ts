import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import type { StatusDokumen } from "@prisma/client";
import {
  bolehLihatFinalisasi,
  bolehLihatSetujui,
  catatanTimeline,
  hrefUnduhVersi,
  labelAksiTimeline,
  lamaMenunggu,
  nomorVersiTimeline,
  OPSI_TAB_KOTAK_MASUK,
  opsiTabKotakMasuk,
  urutkanKotakMasuk,
} from "./pemeriksaan";

function item(status: StatusDokumen, updatedAt: string, id = status + updatedAt) {
  return { id, status, updatedAt: new Date(updatedAt) };
}

test("default filter kotak masuk adalah Menunggu Tindakan (DIKIRIM)", () => {
  assert.equal(opsiTabKotakMasuk(null).nilai, "menunggu");
  assert.equal(opsiTabKotakMasuk(undefined).nilai, "menunggu");
  assert.equal(opsiTabKotakMasuk("").nilai, "menunggu");
  assert.equal(opsiTabKotakMasuk("menunggu").statuses[0], "DIKIRIM");
  // Nilai asing kembali ke default.
  assert.equal(opsiTabKotakMasuk("hacker").nilai, "menunggu");
  // Semua tab punya label dan daftar status non-kosong.
  for (const o of OPSI_TAB_KOTAK_MASUK) {
    assert.ok(o.label.length > 0);
    assert.ok(o.statuses.length > 0);
  }
});

test("DIKIRIM diurutkan paling lama menunggu dahulu; status lain terbaru ke terlama", () => {
  const items = [
    item("DISETUJUI", "2026-08-20T10:00:00Z", "s1"),
    item("DIKIRIM", "2026-08-22T10:00:00Z", "k-baru"),
    item("PERLU_REVISI", "2026-08-21T10:00:00Z", "r1"),
    item("DIKIRIM", "2026-08-15T10:00:00Z", "k-lama"),
    item("DIKIRIM", "2026-08-18T10:00:00Z", "k-tengah"),
  ];
  const urut = urutkanKotakMasuk(items);
  assert.deepEqual(
    urut.map((i) => i.id),
    ["k-lama", "k-tengah", "k-baru", "r1", "s1"] // DIKIRIM lama→baru, lainnya 21-Agt > 20-Agt
  );
});

test("lamaMenunggu menghasilkan durasi ramah baca", () => {
  const dasar = new Date("2026-08-20T10:00:00Z");
  const detik = new Date(dasar.getTime() + 30 * 1000);
  const menit = new Date(dasar.getTime() + 5 * 60000);
  const jam = new Date(dasar.getTime() + 3 * 3600000);
  const hari = new Date(dasar.getTime() + 2 * 86400000);
  const minggu = new Date(dasar.getTime() + 10 * 86400000);
  assert.equal(lamaMenunggu(dasar, detik), "baru saja");
  assert.equal(lamaMenunggu(dasar, menit), "5 menit");
  assert.equal(lamaMenunggu(dasar, jam), "3 jam");
  assert.equal(lamaMenunggu(dasar, hari), "2 hari");
  assert.equal(lamaMenunggu(dasar, minggu), "1 minggu");
});

test("label timeline manusiawi untuk seluruh aksi yang dikenal", () => {
  for (const aksi of ["buat", "ubah", "ubah-draf", "upload", "kirim", "minta-revisi", "kirim-revisi", "setujui", "finalisasi"]) {
    const l = labelAksiTimeline(aksi);
    assert.equal(l.dikenal, true, `aksi ${aksi} harus dikenal`);
    assert.notEqual(l.label, "Aktivitas dokumen");
  }
  assert.equal(labelAksiTimeline("buat").label, "Dokumen dibuat");
  assert.equal(labelAksiTimeline("kirim").label, "Dikirim ke Kamad");
  assert.equal(labelAksiTimeline("finalisasi").label, "Difinalkan");
});

test("aksi tidak dikenal memakai label generik, tanpa dump JSON", () => {
  const l = labelAksiTimeline("aksi_rahasia_baru");
  assert.equal(l.dikenal, false);
  assert.equal(l.label, "Aktivitas dokumen");
  assert.equal(labelAksiTimeline("").label, "Aktivitas dokumen");
});

test("catatan timeline hanya teks catatan; storage key/ID tidak bocor", () => {
  assert.equal(catatanTimeline({ catatan: "Perbaiki halaman 2" }), "Perbaiki halaman 2");
  assert.equal(catatanTimeline({ kunciPenyimpanan: "storage/rahasia.pdf", versiId: "v1" }), null);
  assert.equal(catatanTimeline({ catatan: "   " }), null);
  assert.equal(catatanTimeline("string polos"), null);
  assert.equal(catatanTimeline(null), null);
  assert.equal(catatanTimeline([1, 2]), null);
});

test("nomor versi timeline diambil aman dari payload", () => {
  assert.equal(nomorVersiTimeline({ nomor: 3 }), 3);
  assert.equal(nomorVersiTimeline({ nomorVersi: 5 }), 5);
  assert.equal(nomorVersiTimeline({ nomor: "3" }), null);
  assert.equal(nomorVersiTimeline({ kunciPenyimpanan: "x" }), null);
  assert.equal(nomorVersiTimeline(null), null);
});

test("finalisasi hanya tampil pada DISETUJUI untuk KEPALA/ADMIN/SUPERADMIN", () => {
  assert.equal(bolehLihatFinalisasi("KEPALA", "DISETUJUI"), true);
  assert.equal(bolehLihatFinalisasi("ADMIN", "DISETUJUI"), true);
  assert.equal(bolehLihatFinalisasi("SUPERADMIN", "DISETUJUI"), true);
  assert.equal(bolehLihatFinalisasi("KEPALA", "DIKIRIM"), false);
  assert.equal(bolehLihatFinalisasi("KEPALA", "DIFINALKAN"), false);
  // Guru tidak melihat tombol finalisasi.
  assert.equal(bolehLihatFinalisasi("GURU", "DISETUJUI"), false);
  assert.equal(bolehLihatFinalisasi("WAKA", "DISETUJUI"), false);
  assert.equal(bolehLihatFinalisasi(undefined, "DISETUJUI"), false);
});

test("persetujuan hanya tampil pada DIKIRIM dengan PDF siap", () => {
  assert.equal(bolehLihatSetujui("DIKIRIM", true), true);
  assert.equal(bolehLihatSetujui("DIKIRIM", false), false);
  assert.equal(bolehLihatSetujui("DISETUJUI", true), false);
  assert.equal(bolehLihatSetujui("DRAF", true), false);
});

test("unduhan selalu memakai endpoint versiId, tanpa storage key", () => {
  const href = hrefUnduhVersi("versi-abc");
  assert.match(href, /^\/api\/administrasi\/versi\/versi-abc\/download$/);
  assert.ok(!href.includes("kunci"));
  assert.ok(!href.includes("storage"));
});

// ====== Kontrak komponen aksi (cegah double-submit & kebocoran data) ======

const baca = (rel: string) => readFileSync(path.resolve(rel), "utf8");

test("konfirmasi dua langkah mencegah double-submit", () => {
  const src = baca("components/administrasi/konfirmasi-dua-langkah.tsx");
  assert.match(src, /disabled=\{pending\}/);
  assert.match(src, /setTerbuka\(false\)/); // bisa dibatalkan
  assert.match(src, /judulRef\.current\?\.focus\(\)/); // fokus jelas saat tinjauan terbuka
});

test("hasil aksi diumumkan via aria-live", () => {
  for (const rel of ["components/administrasi/tombol-setujui.tsx", "components/administrasi/panel-finalisasi.tsx", "components/administrasi/tombol-salin.tsx"]) {
    assert.match(baca(rel), /aria-live/, `${rel} harus punya aria-live`);
  }
});

test("panel finalisasi hanya mengirim dokumenId, bukan versiId/checksum", () => {
  const src = baca("components/administrasi/panel-finalisasi.tsx");
  assert.match(src, /finalisasiDokumen\(dokumenId\)/);
  assert.ok(!/finalisasiDokumen\([^)]*(versi|sha|checksum)/.test(src));
  assert.match(src, /router\.refresh\(\)/);
  assert.match(src, /Tanda Tangan Elektronik tersertifikasi/);
});

test("tombol setujui memakai konfirmasi dua langkah, bukan window.confirm", () => {
  const src = baca("components/administrasi/tombol-setujui.tsx");
  assert.match(src, /KonfirmasiDuaLangkah/);
  assert.match(src, /setujuiDokumen\(id\)/);
  assert.ok(!src.includes("window.confirm"));
  assert.match(src, /Ya, Setujui/);
});
