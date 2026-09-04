import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { labelAksiTemplate, saringDaftarTemplate, type ItemDaftarTemplate } from "./administrasi/template-validasi";

// Kontrak UI Template Dokumen (guru + admin).

const baca = (rel: string) => readFileSync(path.resolve(rel), "utf8");

function item(opsi: Partial<ItemDaftarTemplate>): ItemDaftarTemplate {
  return {
    id: opsi.id ?? "t1",
    jenis: opsi.jenis ?? "PROPOSAL",
    nama: opsi.nama ?? "Template A",
    deskripsi: opsi.deskripsi ?? null,
    aktif: opsi.aktif ?? true,
    jumlahVersi: opsi.jumlahVersi ?? 1,
    versiTerbaru: opsi.versiTerbaru ?? {
      id: "v1",
      nomor: 1,
      namaAsli: "a.pdf",
      ukuran: 100,
      sha256: "x",
      createdAt: new Date(),
    },
  };
}

test("pengguna biasa hanya melihat template aktif (action memfilter aktif)", () => {
  const action = baca("lib/actions/template.ts");
  assert.match(action, /kelola \? \{\} : \{ aktif: true \}/);
});

test("pengguna biasa hanya mendapat versi terbaru (take 1, nomor desc)", () => {
  const action = baca("lib/actions/template.ts");
  assert.match(action, /orderBy: \{ nomor: "desc" \},\s*\n\s*take: 1/);
  assert.ok(!action.includes("kunciPenyimpanan"), "storage key tidak boleh di-select");
});

test("admin melihat aktif/nonaktif; statistik memakai data nyata", () => {
  const page = baca("app/(administrasi)/administrasi/template/page.tsx");
  assert.match(page, /bolehKelolaTemplate/);
  assert.match(page, /nonaktif: semua\.filter/);
  assert.match(page, /totalVersi: semua\.reduce/);
});

test("filter katalog server-side: q/jenis/status, urut jenis lalu nama", () => {
  const items = [
    item({ id: "1", nama: "B Template", jenis: "PROPOSAL", aktif: false }),
    item({ id: "2", nama: "A Template", jenis: "LAPORAN_KEGIATAN", aktif: true }),
    item({ id: "3", nama: "A Lain", jenis: "PROPOSAL", aktif: true, deskripsi: "khusus spp" }),
  ];
  const hasil = saringDaftarTemplate(items, {});
  assert.deepEqual(
    hasil.map((h) => h.id),
    ["2", "3", "1"] // jenis LAPORAN_KEGIATAN dulu (L < P), tiap jenis diurut nama
  );
  const q = saringDaftarTemplate(items, { q: "spp" });
  assert.deepEqual(q.map((h) => h.id), ["3"]); // cocok via deskripsi
  const aktif = saringDaftarTemplate(items, { status: "aktif" });
  assert.equal(aktif.length, 2);
  const nonaktif = saringDaftarTemplate(items, { status: "nonaktif" });
  assert.deepEqual(nonaktif.map((h) => h.id), ["1"]);
  const jenis = saringDaftarTemplate(items, { jenis: "LAPORAN_KEGIATAN" });
  assert.deepEqual(jenis.map((h) => h.id), ["2"]);
  // Nilai asing diabaikan.
  assert.equal(saringDaftarTemplate(items, { status: "asing", jenis: "palsu", q: "   " }).length, 3);
});

test("label audit manusiawi; aksi tak dikenal generik tanpa JSON", () => {
  assert.equal(labelAksiTemplate("dibuat").label, "Template dibuat");
  assert.equal(labelAksiTemplate("metadata_diubah").label, "Informasi diperbarui");
  assert.equal(labelAksiTemplate("versi_diunggah").label, "Versi diunggah");
  assert.equal(labelAksiTemplate("diaktifkan").label, "Template diaktifkan");
  assert.equal(labelAksiTemplate("dinonaktifkan").label, "Template dinonaktifkan");
  const asing = labelAksiTemplate("aksi_baru_belum_dikenal");
  assert.equal(asing.label, "Aktivitas template");
  assert.equal(asing.dikenal, false);
});

test("storage key dan userId tidak dirender pada UI template", () => {
  for (const rel of [
    "app/(administrasi)/administrasi/template/page.tsx",
    "app/(administrasi)/administrasi/template/baru/page.tsx",
    "app/(administrasi)/administrasi/template/[id]/page.tsx",
    "components/administrasi/template/form-template-baru.tsx",
    "components/administrasi/template/form-ubah-template.tsx",
    "components/administrasi/template/upload-versi-template.tsx",
    "components/administrasi/template/aksi-status-template.tsx",
  ]) {
    const src = baca(rel);
    assert.ok(!src.includes("kunciPenyimpanan"), `${rel} tidak boleh menyentuh storage key`);
    // ID internal tidak boleh dirender langsung sebagai konten (lookup nama boleh).
    assert.ok(!/\{v\.dibuatOlehId\}|\{r\.aktorUserId\}/.test(src), `${rel} tidak boleh merender ID internal`);
  }
  // Halaman detail memakai nama pengunggah, bukan ID.
  assert.match(baca("app/(administrasi)/administrasi/template/[id]/page.tsx"), /namaUser\.get/);
});

test("tombol unduh memakai versiId (hrefUnduhVersi)", () => {
  const page = baca("app/(administrasi)/administrasi/template/page.tsx");
  assert.match(page, /hrefUnduhVersiTemplate\(v\.id\)/);
  const detail = baca("app/(administrasi)/administrasi/template/[id]/page.tsx");
  assert.match(detail, /hrefUnduhVersiTemplate\(v\.id\)/);
});

test("aktivasi/nonaktif mencegah double-submit dan memakai konfirmasi dua langkah", () => {
  const src = baca("components/administrasi/template/aksi-status-template.tsx");
  assert.match(src, /KonfirmasiDuaLangkah/);
  assert.match(src, /pending=\{pending\}/); // state pending diteruskan → tombol disabled
  assert.match(src, /aria-live/);
  assert.match(src, /tidak dihapus/);
  // Aktifkan tanpa versi: tombol disabled + alasan tekstual.
  assert.match(src, /jumlahVersi >= 1/);
  assert.match(src, /belum memiliki versi file/);
});

test("route baru & detail ditolak untuk non-admin (notFound, tanpa bocor)", () => {
  for (const rel of [
    "app/(administrasi)/administrasi/template/baru/page.tsx",
    "app/(administrasi)/administrasi/template/[id]/page.tsx",
  ]) {
    const src = baca(rel);
    assert.match(src, /bolehKelolaTemplate\(user\)/);
    assert.match(src, /notFound\(\)/);
    assert.ok(!/redirect\("\/administrasi"\)/.test(src), `${rel} memakai notFound, bukan redirect yang membocorkan`);
  }
});

test("empty state katalog pengguna sesuai spesifikasi", () => {
  const page = baca("app/(administrasi)/administrasi/template/page.tsx");
  assert.match(page, /Admin belum menyediakan template resmi\./);
  assert.match(page, /Tidak ada template yang cocok/);
  // Non-admin tidak melihat kartu nonaktif: render hanya dari hasil saringan action aktif.
  assert.match(baca("lib/actions/template.ts"), /aktif: true/);
});

test("form baru memakai konstanta nama server & menjelaskan nonaktif", () => {
  const form = baca("components/administrasi/template/form-template-baru.tsx");
  assert.match(form, /BATAS_NAMA_TEMPLATE/);
  assert.ok(!/maxLength=\{190\}/.test(form));
  assert.match(form, /nonaktif/i);
  assert.match(form, /aria-live|role="alert"/);
});

test("upload versi: loading/error/success, tanpa storage key", () => {
  const up = baca("components/administrasi/template/upload-versi-template.tsx");
  assert.match(up, /disabled=\{pending \|\| !file\}/);
  assert.match(up, /role="alert"/);
  assert.match(up, /aria-live/);
  assert.match(up, /router\.refresh\(\)/);
  assert.match(up, /Maksimal 10 MB/);
  assert.ok(!up.includes("kunciPenyimpanan"));
});

test("download route: aturan akses & header aman", () => {
  const src = baca("app/api/administrasi/template/versi/[id]/download/route.ts");
  assert.match(src, /private, no-store/);
  assert.match(src, /X-Content-Type-Options.*nosniff|nosniff/);
  assert.match(src, /Content-Disposition/);
  assert.match(src, /nomor: "desc"/); // versi terbaru untuk pengguna biasa
  assert.match(src, /bolehKelolaTemplate/);
  assert.ok(!src.includes("storagePath"));
});
