import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "crypto";
import { readFileSync } from "node:fs";
import path from "path";
import {
  PERINGATAN_VERSI_BUKAN_PDF,
  PESAN_TOLAK_SETUJUI,
  SARAN_CATATAN_REVISI_PDF,
  pilihVersiTerbaru,
  siapSetujuiMetadata,
  verifikasiVersiPdf,
  type KandidatVersi,
} from "./administrasi/finalisasi";
import { hitungSha256 } from "./administrasi/document-storage";

function pdfBuf(): Buffer {
  return Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0x74, 0x65, 0x73, 0x74]);
}

function kandidat(overrides?: Partial<KandidatVersi>): KandidatVersi {
  return {
    id: "v1",
    nomor: 1,
    namaAsli: "dokumen.pdf",
    mime: "application/pdf",
    ukuran: 1000,
    kunciPenyimpanan: "kunci-1.pdf",
    sha256: createHash("sha256").update(pdfBuf()).digest("hex"),
    ...overrides,
  };
}

function muatBerhasil(): () => Promise<Buffer> {
  return () => Promise.resolve(pdfBuf());
}

function muatGagal(): () => Promise<Buffer> {
  return () => Promise.reject(new Error("ENOENT"));
}

test("persetujuan: tanpa versi ditolak", async () => {
  const r = await verifikasiVersiPdf(null, muatGagal());
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.alasan, /belum memiliki versi/);
});

test("persetujuan: DOC/DOCX/XLS/XLSX sebagai versi terbaru ditolak", async () => {
  for (const [nama, mime] of [
    ["laporan.doc", "application/msword"],
    ["laporan.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["data.xls", "application/vnd.ms-excel"],
    ["data.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ] as const) {
    const r = await verifikasiVersiPdf(kandidat({ namaAsli: nama, mime }), muatBerhasil());
    assert.equal(r.ok, false, `${nama} harus ditolak`);
    if (!r.ok) assert.match(r.alasan, /PDF/);
  }
});

test("persetujuan: MIME PDF palsu (bukan ekstensi PDF) ditolak", async () => {
  const r = await verifikasiVersiPdf(
    kandidat({ namaAsli: "berkas.docx", mime: "application/pdf" }),
    muatBerhasil()
  );
  assert.equal(r.ok, false);
});

test("persetujuan: ekstensi PDF dengan MIME palsu ditolak", async () => {
  const r = await verifikasiVersiPdf(
    kandidat({ namaAsli: "berkas.pdf", mime: "application/msword" }),
    muatBerhasil()
  );
  assert.equal(r.ok, false);
});

test("persetujuan: magic bytes PDF palsu ditolak", async () => {
  const shaBukanPdf = createHash("sha256").update(Buffer.from("hello world")).digest("hex");
  const r = await verifikasiVersiPdf(
    kandidat({ sha256: shaBukanPdf }),
    () => Promise.resolve(Buffer.from("hello world"))
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.alasan, /format PDF/);
});

test("persetujuan: file fisik hilang ditolak dan status tidak berubah", async () => {
  const r = await verifikasiVersiPdf(kandidat(), muatGagal());
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.alasan, /File tidak ditemukan/);
});

test("persetujuan: checksum fisik berbeda dari metadata ditolak", async () => {
  const r = await verifikasiVersiPdf(
    kandidat({ sha256: createHash("sha256").update(Buffer.from("lain")).digest("hex") }),
    muatBerhasil()
  );
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.alasan, /Checksum/);
});

test("persetujuan: PDF valid dapat disetujui (metadata, fisik, checksum cocok)", async () => {
  const buf = pdfBuf();
  const r = await verifikasiVersiPdf(kandidat({ sha256: hitungSha256(buf), ukuran: buf.length }), () => Promise.resolve(buf));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.sha256Aktual, hitungSha256(buf));
    assert.equal(Buffer.compare(r.buffer, buf), 0);
  }
});

test("pesan tolak persetujuan sesuai teks wajib", () => {
  assert.equal(
    PESAN_TOLAK_SETUJUI,
    "Dokumen belum memiliki versi PDF final. Kembalikan untuk revisi dan minta guru mengunggah PDF sebelum disetujui."
  );
  assert.equal(SARAN_CATATAN_REVISI_PDF, "Mohon unggah dokumen versi final dalam format PDF.");
  assert.match(PERINGATAN_VERSI_BUKAN_PDF, /unggah versi PDF/);
});

test("siapSetujuiMetadata: hanya versi PDF lengkap yang ditawarkan tombol Setujui", () => {
  assert.equal(siapSetujuiMetadata(kandidat()), true);
  assert.equal(siapSetujuiMetadata(null), false);
  assert.equal(siapSetujuiMetadata(kandidat({ namaAsli: "a.docx", mime: "application/msword" })), false);
  assert.equal(siapSetujuiMetadata(kandidat({ kunciPenyimpanan: null })), false);
  assert.equal(siapSetujuiMetadata(kandidat({ sha256: null })), false);
});

test("UI memilih versi terbaru untuk keputusan tombol Setujui", () => {
  const vLama = kandidat({ id: "v-lama", nomor: 1 });
  const vBaruDocx = kandidat({ id: "v-baru", nomor: 2, namaAsli: "baru.docx", mime: "application/msword" });
  assert.equal(siapSetujuiMetadata(pilihVersiTerbaru([vLama, vBaruDocx])), false);
  const vBaruPdf = kandidat({ id: "v-baru", nomor: 3 });
  assert.equal(siapSetujuiMetadata(pilihVersiTerbaru([vLama, vBaruPdf])), true);
});

function baca(rel: string): string {
  return readFileSync(path.resolve(rel), "utf8");
}

test("kontrak setujuiDokumen: validasi integritas sebelum transaksi, tanpa versiId dari client", () => {
  const src = baca("lib/actions/dokumen.ts");
  const awal = src.indexOf("export async function setujuiDokumen");
  const akhir = src.indexOf("export async function", awal + 10);
  const fn = src.slice(awal, akhir > 0 ? akhir : undefined);
  assert.match(fn, /setujuiDokumen\(id: string\)/);
  assert.ok(!fn.includes("versiId"));
  const idxVerifikasi = fn.indexOf("verifikasiVersiPdf");
  const idxTx = fn.indexOf("$transaction");
  assert.ok(idxVerifikasi > -1 && idxTx > -1);
  assert.ok(idxVerifikasi < idxTx);
  assert.match(fn, /PESAN_TOLAK_SETUJUI/);
  assert.match(fn, /pilihVersiTerbaru/);
});

test("kontrak setujuiDokumen: status dan riwayat dicatat atomik dalam transaksi yang sama", () => {
  const src = baca("lib/actions/dokumen.ts");
  const awal = src.indexOf("export async function setujuiDokumen");
  const akhir = src.indexOf("export async function", awal + 10);
  const fn = src.slice(awal, akhir > 0 ? akhir : undefined);
  const idxTx = fn.indexOf("$transaction");
  const idxUpdate = fn.indexOf("dokumen.update");
  const idxRiwayat = fn.indexOf("riwayatDokumen.create");
  assert.ok(idxTx > -1 && idxUpdate > idxTx && idxRiwayat > idxTx);
});

test("alur persetujuan tidak menyentuh model jurnal", () => {
  const src = baca("lib/actions/dokumen.ts");
  assert.doesNotMatch(src, /(pertemuan|absensi|penilaian|nilaiSiswa|\bjurnal\b)/i);
});

test("UI kotak masuk: Setujui digerbangi validasi PDF, Minta Revisi tetap tersedia", () => {
  const halaman = baca("app/(administrasi)/administrasi/kotak-masuk/[id]/page.tsx");
  assert.match(halaman, /siapSetujuiMetadata/);
  assert.match(halaman, /pilihVersiTerbaru/);
  const idxTombol = halaman.indexOf("<TombolSetujui");
  const idxGuard = halaman.indexOf("siapSetujui ?");
  assert.ok(idxTombol > -1 && idxGuard > -1 && idxTombol > idxGuard);
  assert.match(halaman, /PERINGATAN_VERSI_BUKAN_PDF/);
  assert.match(halaman, /SARAN_CATATAN_REVISI_PDF/);
  const idxFormRevisi = halaman.indexOf("<FormMintaRevisi");
  const idxKartuSetujui = halaman.indexOf('">Setujui</h2>');
  assert.ok(idxFormRevisi > -1 && idxKartuSetujui > -1 && idxFormRevisi < idxKartuSetujui);
});
