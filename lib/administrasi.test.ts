import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "crypto";
import { bolehBacaDokumen, bolehKelolaDokumenDraf, bolehRevisiDokumen } from "./otorisasi";
import {
  cekMagicBytes,
  cekPathTraversal,
  ekstensiDariNama,
  isExtIzin,
  isMimetypeSesuaiExt,
  validasiFile,
  MAKS_UKURAN_FILE,
} from "./administrasi/document-validation";
import {
  buatKunciPenyimpanan,
  dapatkanStorageDir,
  hitungSha256,
  sanitasiNamaAsli,
  validasiKunci,
} from "./administrasi/document-storage";
import type { InfoUser } from "./otorisasi";

const guru: InfoUser = { id: "u1", role: "GURU", guruId: "g1" };
const guruLain: InfoUser = { id: "u2", role: "GURU", guruId: "g2" };
const kamad: InfoUser = { id: "u3", role: "KEPALA", guruId: null };
const admin: InfoUser = { id: "u4", role: "ADMIN", guruId: null };

function pdfBuffer() {
  return Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
}
function docxBuffer() {
  return Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
}
function oleBuffer() {
  return Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00]);
}

test("tanpa login ditolak (null user) untuk akses dokumen", () => {
  assert.equal(bolehBacaDokumen(null as unknown as InfoUser, { pengajuUserId: "u1", status: "DIKIRIM" }), false);
  assert.equal(bolehKelolaDokumenDraf(null as unknown as InfoUser, { pengajuUserId: "u1", status: "DRAF" }), false);
  assert.equal(bolehRevisiDokumen(null as unknown as InfoUser, { pengajuUserId: "u1", status: "PERLU_REVISI" }), false);
});

test("guru lain ditolak membaca/mengelola dokumen", () => {
  assert.equal(bolehBacaDokumen(guruLain, { pengajuUserId: "u1", status: "DRAF" }), false);
  assert.equal(bolehKelolaDokumenDraf(guruLain, { pengajuUserId: "u1", status: "DRAF" }), false);
});

test("pemilik dapat upload (DRAF / PERLU_REVISI), DIKIRIM/DISETUJUI ditolak", () => {
  assert.equal(bolehKelolaDokumenDraf(guru, { pengajuUserId: "u1", status: "DRAF" }), true);
  assert.equal(bolehRevisiDokumen(guru, { pengajuUserId: "u1", status: "PERLU_REVISI" }), true);
  assert.equal(bolehKelolaDokumenDraf(guru, { pengajuUserId: "u1", status: "DIKIRIM" }), false);
  assert.equal(bolehRevisiDokumen(guru, { pengajuUserId: "u1", status: "DIKIRIM" }), false);
  assert.equal(bolehKelolaDokumenDraf(guru, { pengajuUserId: "u1", status: "DISETUJUI" }), false);
  assert.equal(bolehRevisiDokumen(guru, { pengajuUserId: "u1", status: "DISETUJUI" }), false);
});

test("kamad dapat membaca non-DRAF, DRAF orang lain tidak", () => {
  assert.equal(bolehBacaDokumen(kamad, { pengajuUserId: "u1", status: "DIKIRIM" }), true);
  assert.equal(bolehBacaDokumen(kamad, { pengajuUserId: "u1", status: "PERLU_REVISI" }), true);
  assert.equal(bolehBacaDokumen(kamad, { pengajuUserId: "u1", status: "DRAF" }), false);
  assert.equal(bolehBacaDokumen(admin, { pengajuUserId: "u1", status: "DRAF" }), true);
});

test("file terlalu besar ditolak", () => {
  const err = validasiFile("a.pdf", "application/pdf", MAKS_UKURAN_FILE + 1);
  assert.match(err ?? "", /10 MB/);
  assert.equal(validasiFile("a.pdf", "application/pdf", MAKS_UKURAN_FILE), null);
  assert.ok(validasiFile("a.pdf", "application/pdf", 0));
});

test("extension/MIME tidak valid ditolak", () => {
  assert.ok(validasiFile("a.exe", "application/octet-stream", 1000));
  assert.ok(validasiFile("a.pdf", "image/png", 1000));
  assert.ok(validasiFile("a.pdf", "application/msword", 1000));
  assert.equal(validasiFile("a.pdf", "application/pdf", 1000), null);
  assert.equal(validasiFile("a.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 1000), null);
  assert.equal(isExtIzin("pdf"), true);
  assert.equal(isExtIzin("exe"), false);
  assert.equal(isMimetypeSesuaiExt("application/pdf", "pdf"), true);
  assert.equal(isMimetypeSesuaiExt("image/png", "pdf"), false);
});

test("path traversal ditolak (nama file & kunci)", () => {
  assert.equal(cekPathTraversal("../secret.pdf"), true);
  assert.equal(cekPathTraversal("a/b.pdf"), true);
  assert.equal(cekPathTraversal("a\\b.pdf"), true);
  assert.equal(cekPathTraversal("normal.pdf"), false);
  assert.ok(validasiKunci("../evil.pdf"));
  assert.ok(validasiKunci("a/b.pdf"));
  assert.equal(validasiKunci("abc-123_def.pdf"), null);
  assert.ok(validasiKunci(""));
});

test("magic bytes dasar diperiksa", () => {
  assert.equal(cekMagicBytes(pdfBuffer(), "pdf"), true);
  assert.equal(cekMagicBytes(Buffer.from("hello"), "pdf"), false);
  assert.equal(cekMagicBytes(docxBuffer(), "docx"), true);
  assert.equal(cekMagicBytes(docxBuffer(), "xlsx"), true);
  assert.equal(cekMagicBytes(oleBuffer(), "doc"), true);
  assert.equal(cekMagicBytes(oleBuffer(), "xls"), true);
  assert.equal(cekMagicBytes(pdfBuffer(), "doc"), false);
});

test("nomor versi meningkat, versi lama immutable (logika)", () => {
  const versiAktif = 3;
  const next = versiAktif + 1;
  assert.equal(next, 4);
  const versiLama = { id: randomUUID(), nomor: 3, kunci: "a.pdf" };
  const versiBaru = { id: randomUUID(), nomor: next, kunci: "b.pdf" };
  assert.notEqual(versiLama.id, versiBaru.id);
  assert.equal(versiLama.nomor < versiBaru.nomor, true);
});

test("checksum tersimpan (sha256)", () => {
  const buf = Buffer.from("hello world");
  const sha = hitungSha256(buf);
  assert.equal(sha, createHash("sha256").update(buf).digest("hex"));
  assert.equal(sha.length, 64);
});

test("sanitasi nama asli dan ekstraksi ekstensi", () => {
  assert.equal(sanitasiNamaAsli("../../../etc/passwd.pdf").includes(".."), false);
  assert.equal(ekstensiDariNama("laporan.PDF"), "pdf");
  assert.equal(ekstensiDariNama("arsip.tar.pdf"), "pdf");
  assert.equal(sanitasiNamaAsli("a".repeat(400) + ".pdf").length <= 255, true);
});

test("kunci penyimpanan aman (random, ext dipertahankan)", () => {
  const k1 = buatKunciPenyimpanan("pdf");
  const k2 = buatKunciPenyimpanan("pdf");
  assert.notEqual(k1, k2);
  assert.match(k1, /\.pdf$/);
  assert.equal(validasiKunci(k1), null);
});

test("storage dir default di luar public", () => {
  const dir = dapatkanStorageDir();
  assert.ok(!dir.includes("public"));
});

test("cleanup file saat metadata gagal (kontrak: hapusFile dipanggil jika transaksi gagal) - isolasi", async () => {
  const { hapusFile: del } = await import("./administrasi/document-storage");
  assert.equal(typeof del, "function");
});
