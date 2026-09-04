import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BATAS_DESKRIPSI_TEMPLATE,
  BATAS_NAMA_TEMPLATE,
  mimeDariEkstensi,
  NAMESPACE_TEMPLATE,
  validasiFileTemplate,
  validasiMetadataTemplate,
} from "./template-validasi";
import { bolehBacaTemplate, bolehKelolaTemplate } from "@/lib/otorisasi";

// Unit test backend Template Dokumen — validasi, otorisasi, sanitasi, magic bytes.

const PDF = Buffer.concat([Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]), Buffer.alloc(64, 1)]);
const ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(64, 1)]);
const OLE = Buffer.concat([
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  Buffer.alloc(64, 1),
]);

function user(role: string) {
  return { id: "u-" + role.toLowerCase(), role, guruId: role === "GURU" ? "g-1" : null };
}

test("otorisasi: hanya ADMIN/SUPERADMIN dapat mengelola template", () => {
  assert.equal(bolehKelolaTemplate(user("ADMIN")), true);
  assert.equal(bolehKelolaTemplate(user("SUPERADMIN")), true);
  for (const r of ["GURU", "WAKA", "KEPALA"]) {
    assert.equal(bolehKelolaTemplate(user(r)), false, `${r} tidak boleh mengelola`);
  }
  assert.equal(bolehKelolaTemplate(null), false);
});

test("otorisasi: semua pengguna terautentikasi dapat membaca template aktif", () => {
  for (const r of ["GURU", "WAKA", "KEPALA", "ADMIN", "SUPERADMIN"]) {
    assert.equal(bolehBacaTemplate(user(r)), true);
  }
  assert.equal(bolehBacaTemplate(null), false);
});

test("validasi metadata: nama 1..190, deskripsi maks 2000, jenis valid", () => {
  assert.equal(validasiMetadataTemplate({ nama: "Template SPP", deskripsi: null, jenis: "DOKUMEN_UMUM" }), null);
  assert.equal(validasiMetadataTemplate({ nama: "T".repeat(190), jenis: "PROPOSAL" }), null);
  assert.match(validasiMetadataTemplate({ nama: "T".repeat(191), jenis: "PROPOSAL" }) ?? "", /maksimal 190/);
  assert.match(validasiMetadataTemplate({ nama: "AB", jenis: "PROPOSAL" }) ?? "", /minimal 3/);
  assert.equal(validasiMetadataTemplate({ nama: "Template OK", deskripsi: "D".repeat(2000), jenis: "PROPOSAL" }), null);
  assert.match(
    validasiMetadataTemplate({ nama: "Template OK", deskripsi: "D".repeat(2001), jenis: "PROPOSAL" }) ?? "",
    /maksimal 2000/
  );
  assert.match(validasiMetadataTemplate({ nama: "Template OK", jenis: "JENIS_PALSU" }) ?? "", /tidak valid/);
  assert.equal(BATAS_NAMA_TEMPLATE, 190);
  assert.equal(BATAS_DESKRIPSI_TEMPLATE, 2000);
});

test("validasi file: PDF valid diterima", () => {
  assert.equal(validasiFileTemplate("template-spp.pdf", "application/pdf", PDF.length, PDF), null);
});

test("validasi file: extension tidak diizinkan ditolak", () => {
  const err = validasiFileTemplate("virus.exe", "application/octet-stream", 100, Buffer.alloc(100));
  assert.match(err ?? "", /Extension tidak diizinkan/);
});

test("validasi file: ukuran di atas 10 MB ditolak", () => {
  const err = validasiFileTemplate("besar.pdf", "application/pdf", 10 * 1024 * 1024 + 1, PDF);
  assert.match(err ?? "", /maksimal 10 MB/);
});

test("validasi file: file kosong ditolak", () => {
  assert.match(validasiFileTemplate("kosong.pdf", "application/pdf", 0, Buffer.alloc(0)) ?? "", /kosong/);
});

test("validasi file: MIME tidak sesuai extension ditolak", () => {
  assert.match(validasiFileTemplate("a.pdf", "application/msword", PDF.length, PDF) ?? "", /MIME tidak sesuai/);
});

test("validasi file: magic bytes tidak cocok ditolak (ekse PDF palsu)", () => {
  const palsu = Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.alloc(64, 1)]); // MZ, bukan PDF
  assert.match(validasiFileTemplate("palsu.pdf", "application/pdf", palsu.length, palsu) ?? "", /tidak sesuai dengan extension/);
  // DOCX palsu berisi magic PDF → ditolak.
  assert.match(validasiFileTemplate("palsu.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", PDF.length, PDF) ?? "", /tidak sesuai/);
});

test("validasi file: DOCX (ZIP), XLSX (ZIP), DOC (OLE), XLS (OLE) diterima", () => {
  assert.equal(validasiFileTemplate("a.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ZIP.length, ZIP), null);
  assert.equal(validasiFileTemplate("a.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ZIP.length, ZIP), null);
  assert.equal(validasiFileTemplate("a.doc", "application/msword", OLE.length, OLE), null);
  assert.equal(validasiFileTemplate("a.xls", "application/vnd.ms-excel", OLE.length, OLE), null);
});

test("validasi file: nama dengan traversal ditolak", () => {
  for (const nama of ["../../etc/passwd.pdf", "folder\\rahasia.pdf", "a/b.pdf"]) {
    assert.match(validasiFileTemplate(nama, "application/pdf", PDF.length, PDF) ?? "", /tidak valid/);
  }
});

test("mime fallback diturunkan dari ekstensi, bukan metadata client", () => {
  assert.equal(mimeDariEkstensi("pdf"), "application/pdf");
  assert.equal(mimeDariEkstensi("xlsx"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(mimeDariEkstensi("aneh"), "application/octet-stream");
});

test("namespace storage template terpisah dari dokumen pengajuan", () => {
  assert.equal(NAMESPACE_TEMPLATE, "template");
});
