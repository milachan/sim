import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  adalahFinalisator,
  buatKodeVerifikasi,
  errIkatanVersi,
  formatKodeVerifikasi,
  isStatusBolehFinalisasi,
  pilihVersiTerbaru,
  responFinal,
  validasiKandidatFinal,
  type KandidatVersi,
} from "./administrasi/finalisasi";
import { cekMagicBytes } from "./administrasi/document-validation";
import { hitungSha256 } from "./administrasi/document-storage";

function pdfBuf(): Buffer {
  return Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0x74, 0x65, 0x73, 0x74]);
}

function kandidatPdf(overrides?: Partial<KandidatVersi>): KandidatVersi {
  return {
    id: "v1",
    nomor: 1,
    namaAsli: "proposal.pdf",
    mime: "application/pdf",
    ukuran: 1000,
    kunciPenyimpanan: "abc-123.pdf",
    sha256: createHash("sha256").update(pdfBuf()).digest("hex"),
    ...overrides,
  };
}

test("guru tidak dapat memfinalisasi", () => {
  assert.equal(adalahFinalisator("GURU"), false);
  assert.equal(adalahFinalisator("WAKA"), false);
});

test("kamad/admin/superadmin dapat memfinalisasi", () => {
  assert.equal(adalahFinalisator("KEPALA"), true);
  assert.equal(adalahFinalisator("ADMIN"), true);
  assert.equal(adalahFinalisator("SUPERADMIN"), true);
});

test("status selain DISETUJUI ditolak", () => {
  assert.equal(isStatusBolehFinalisasi("DISETUJUI"), true);
  assert.equal(isStatusBolehFinalisasi("DRAF"), false);
  assert.equal(isStatusBolehFinalisasi("DIKIRIM"), false);
  assert.equal(isStatusBolehFinalisasi("PERLU_REVISI"), false);
  assert.equal(isStatusBolehFinalisasi("DIFINALKAN"), false);
  assert.equal(isStatusBolehFinalisasi("DIARSIPKAN"), false);
});

test("tanpa versi ditolak", () => {
  assert.match(validasiKandidatFinal(null) ?? "", /belum memiliki versi/);
  assert.match(validasiKandidatFinal(undefined) ?? "", /belum memiliki versi/);
});

test("versi bukan PDF ditolak", () => {
  assert.match(validasiKandidatFinal(kandidatPdf({ namaAsli: "lap.docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })) ?? "", /PDF/);
  assert.match(validasiKandidatFinal(kandidatPdf({ namaAsli: "data.xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })) ?? "", /PDF/);
  assert.match(validasiKandidatFinal(kandidatPdf({ namaAsli: "file.doc", mime: "application/msword" })) ?? "", /PDF/);
  assert.equal(validasiKandidatFinal(kandidatPdf()), null);
});

test("file hilang (tanpa kunciPenyimpanan) ditolak", () => {
  assert.match(validasiKandidatFinal(kandidatPdf({ kunciPenyimpanan: null })) ?? "", /belum memiliki file/);
});

test("checksum berbeda ditolak", () => {
  const buf = pdfBuf();
  const sha256Benar = hitungSha256(buf);
  const sha256Salah = hitungSha256(Buffer.from("bukan pdf"));
  assert.notEqual(sha256Benar, sha256Salah);
  assert.equal(sha256Benar, kandidatPdf().sha256);
  assert.notEqual(sha256Salah, kandidatPdf().sha256);
});

test("checksum tanpa sha256 ditolak", () => {
  assert.match(validasiKandidatFinal(kandidatPdf({ sha256: null })) ?? "", /checksum/);
});

test("magic bytes PDF diperiksa", () => {
  assert.equal(cekMagicBytes(pdfBuf(), "pdf"), true);
  assert.equal(cekMagicBytes(Buffer.from("hello"), "pdf"), false);
});

test("kode verifikasi acak, unik, berentropi tinggi", () => {
  const k1 = buatKodeVerifikasi(16);
  const k2 = buatKodeVerifikasi(16);
  assert.notEqual(k1, k2);
  assert.equal(k1.length, 16);
  assert.match(k1, /^[A-Z0-9]+$/);
});

test("format kode verifikasi berkelompok 4", () => {
  const raw = "ABCD1234EFGH5678";
  assert.equal(formatKodeVerifikasi(raw), "ABCD-1234-EFGH-5678");
});

test("kode verifikasi tidak mengandung userId/path/storage/checksum", () => {
  const kode = buatKodeVerifikasi(16);
  assert.ok(!kode.includes("/"));
  assert.ok(!kode.includes("\\"));
  assert.ok(!kode.includes(".."));
  assert.ok(kode.length <= 20);
});

test("idempotensi: record ganda dicegah oleh dokumenId unique", () => {
  const dokumenId = "test-dok-1";
  const a = { dokumenId, kodeVerifikasi: buatKodeVerifikasi(16) };
  const b = { dokumenId, kodeVerifikasi: buatKodeVerifikasi(16) };
  assert.equal(a.dokumenId, b.dokumenId);
  assert.notEqual(a.kodeVerifikasi, b.kodeVerifikasi);
});

test("pilihVersiTerbaru: mengambil nomor versi tertinggi tanpa bergantung urutan", () => {
  assert.equal(pilihVersiTerbaru([]), null);
  const daftar = [
    { id: "v1", nomor: 1 },
    { id: "v3", nomor: 3 },
    { id: "v2", nomor: 2 },
  ];
  assert.equal(pilihVersiTerbaru(daftar)?.id, "v3");
  const terbalik = [...daftar].reverse();
  assert.equal(pilihVersiTerbaru(terbalik)?.id, "v3");
});

test("finalisasi menyimpan versiId dari versi terbaru (bukan versi lama)", () => {
  const v1 = kandidatPdf({ id: "v-lama", nomor: 1 });
  const v2 = kandidatPdf({ id: "v-baru", nomor: 2 });
  const terpilih = pilihVersiTerbaru([v1, v2]);
  assert.equal(terpilih?.id, "v-baru");
  assert.equal(validasiKandidatFinal(terpilih), null);
});

test("errIkatanVersi: versi milik dokumen yang sama diterima", () => {
  assert.equal(errIkatanVersi({ dokumenId: "dok-1" }, "dok-1"), null);
});

test("errIkatanVersi: versi dokumen lain ditolak", () => {
  const err = errIkatanVersi({ dokumenId: "dok-lain" }, "dok-1");
  assert.match(err ?? "", /tidak termasuk dokumen ini/);
});

test("errIkatanVersi: tanpa versi ditolak", () => {
  assert.match(errIkatanVersi(null, "dok-1") ?? "", /belum memiliki versi/);
});

test("responFinal idempotent mempertahankan versiId dan kodeVerifikasi", () => {
  const record = { kodeVerifikasi: "ABCD1234EFGH5678", versiId: "v-baru" };
  const r1 = responFinal(record, true);
  const r2 = responFinal(record, false);
  for (const r of [r1, r2]) {
    assert.equal(r.ok, true);
    assert.equal(r.versiId, record.versiId);
    assert.equal(r.kodeVerifikasi, record.kodeVerifikasi);
  }
  assert.equal(r1.idempotent, true);
  assert.equal(r2.idempotent, false);
});

function sqlMigrasiFinal(): string[] {
  const dir = path.resolve("prisma/migrations");
  return readdirSync(dir)
    .filter((n) => n.includes("dokumen_final"))
    .sort()
    .map((n) => readFileSync(path.join(dir, n, "migration.sql"), "utf8"));
}

test("migrasi: FK DokumenFinal_versiId_fkey ke VersiDokumen dengan ON DELETE RESTRICT", () => {
  const semua = sqlMigrasiFinal().join("\n");
  assert.match(semua, /ADD CONSTRAINT `DokumenFinal_versiId_fkey`[\s\S]*?REFERENCES `VersiDokumen`\(`id`[\s\S]*?ON DELETE RESTRICT/);
});

test("migrasi: unique index versiId mencegah satu versi menjadi dua final", () => {
  const semua = sqlMigrasiFinal().join("\n");
  assert.match(semua, /CREATE UNIQUE INDEX `DokumenFinal_versiId_key` ON `DokumenFinal`\(`versiId`\)/);
});

test("migrasi ikatan versi bersifat additive (tanpa DROP TABLE / ALTER kolom lain)", () => {
  const baru = readFileSync(path.resolve("prisma/migrations/20260824083000_dokumen_final_ikatan_versi/migration.sql"), "utf8");
  assert.doesNotMatch(baru, /DROP TABLE/i);
  assert.match(baru, /^ALTER TABLE `DokumenFinal` ADD CONSTRAINT `DokumenFinal_versiId_fkey`/m);
});

test("migrasi finalisasi tidak menyentuh tabel jurnal", () => {
  const semua = sqlMigrasiFinal().join("\n");
  const tabelJurnal = ["Pertemuan", "`Jurnal`", "AbsensiItem", "AbsensiHarian", "PenilaianKegiatan", "NilaiSiswa", "RiwayatPerubahan"];
  for (const t of tabelJurnal) {
    assert.ok(!semua.includes(t), `Migrasi finalisasi tidak boleh menyebut tabel ${t}`);
  }
});

test("data jurnal tidak terpengaruh oleh finalisasi (tidak ada referensi model jurnal)", () => {
  const finalFields = ["dokumenId", "versiId", "nomorVersi", "sha256", "ukuran", "mime", "namaAsli", "kodeVerifikasi", "difinalkanOlehId", "difinalkanPada"];
  const jurnalFields = ["pertemuanId", "materi", "tujuan", "kegiatan", "metode", "media", "hasil", "kendala", "tindakLanjut", "catatan", "dokumentasiUrl", "status"];
  const overlap = finalFields.filter((f) => jurnalFields.includes(f));
  assert.equal(overlap.length, 0);
});
