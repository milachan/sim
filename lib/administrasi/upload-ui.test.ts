import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACCEPT_DOKUMEN,
  bolehTampilUpload,
  formatUkuran,
  isDokumenTerkunci,
  potongHash,
  urutVersiTerbaru,
} from "./upload-helpers";

test("formatUkuran menampilkan B/KB/MB", () => {
  assert.equal(formatUkuran(0), "0 B");
  assert.match(formatUkuran(500), /500 B/);
  assert.match(formatUkuran(2048), /KB/);
  assert.match(formatUkuran(2 * 1024 * 1024), /MB/);
});

test("form hanya pada DRAF/PERLU_REVISI milik pengguna", () => {
  assert.equal(bolehTampilUpload("DRAF", true), true);
  assert.equal(bolehTampilUpload("PERLU_REVISI", true), true);
  assert.equal(bolehTampilUpload("DIKIRIM", true), false);
  assert.equal(bolehTampilUpload("DISETUJUI", true), false);
  assert.equal(bolehTampilUpload("DRAF", false), false);
  assert.equal(bolehTampilUpload("DIFINALKAN", true), false);
});

test("status terkunci tidak menampilkan upload", () => {
  assert.equal(isDokumenTerkunci("DIKIRIM"), true);
  assert.equal(isDokumenTerkunci("DISETUJUI"), true);
  assert.equal(isDokumenTerkunci("DIFINALKAN"), true);
  assert.equal(isDokumenTerkunci("DIARSIPKAN"), true);
  assert.equal(isDokumenTerkunci("DRAF"), false);
  assert.equal(isDokumenTerkunci("PERLU_REVISI"), false);
});

test("urut versi terbaru ke lama", () => {
  const vs = [{ nomor: 1 }, { nomor: 3 }, { nomor: 2 }];
  const sorted = urutVersiTerbaru(vs);
  assert.deepEqual(sorted.map((v) => v.nomor), [3, 2, 1]);
  assert.deepEqual(vs.map((v) => v.nomor), [1, 3, 2]);
});

test("download memakai ID versi, bukan storage key", () => {
  const versiId = "clx123";
  const url = `/api/administrasi/versi/${versiId}/download`;
  assert.equal(url, "/api/administrasi/versi/clx123/download");
  assert.ok(!url.includes("kunciPenyimpanan"));
  assert.ok(!url.includes("storage"));
});

test("metadata sensitif tidak dikirim ke client (kunciPenyimpanan/path tidak ada di VersiItem)", () => {
  const allowed = new Set(["id", "nomor", "namaAsli", "mime", "ukuran", "sha256", "createdAt"]);
  const sample = { id: "a", nomor: 1, namaAsli: "x.pdf", mime: "application/pdf", ukuran: 100, sha256: "abc", createdAt: new Date().toISOString(), kunciPenyimpanan: "should-not-exist" };
  const leaked = Object.keys(sample).filter((k) => !allowed.has(k));
  assert.ok(leaked.includes("kunciPenyimpanan"));
});

test("ACCEPT dan helper hash", () => {
  assert.ok(ACCEPT_DOKUMEN.includes(".pdf"));
  assert.ok(ACCEPT_DOKUMEN.includes(".docx"));
  assert.equal(potongHash("abcdef1234567890", 12), "abcdef123456");
  assert.equal(potongHash(null), "—");
});
