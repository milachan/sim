import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import type { JenisNotifikasiAdministrasi } from "@prisma/client";
import { susunTeksNotifikasi, kunciEvent, tautanNotifikasi } from "./notifikasi";

const baca = (rel: string) => readFileSync(path.resolve(rel), "utf8");

const SEMUA_JENIS: JenisNotifikasiAdministrasi[] = [
  "DOKUMEN_DIKIRIM",
  "REVISI_DIKIRIM",
  "PERLU_REVISI",
  "DISETUJUI",
  "DIFINALKAN",
];

test("susunTeksNotifikasi: kelima jenis punya judul & isi tetap yang berbeda", () => {
  const teksSet = new Set<string>();
  for (const jenis of SEMUA_JENIS) {
    const t = susunTeksNotifikasi(jenis, "Proposal Kegiatan");
    assert.ok(t.judul.length > 0);
    assert.ok(t.isi.includes("Proposal Kegiatan"));
    teksSet.add(t.judul);
  }
  assert.equal(teksSet.size, SEMUA_JENIS.length);
});

test("susunTeksNotifikasi: isi tidak pernah memuat metadata sensitif", () => {
  // Builder hanya menerima (jenis, judul) — storage key/checksum/catatan revisi
  // mustahil ikut karena tidak ada parameter untuk itu. Judul panjang dipotong.
  for (const jenis of SEMUA_JENIS) {
    const t = susunTeksNotifikasi(jenis, "x".repeat(300));
    assert.ok(t.isi.length <= 400, `isi ${jenis} harus muat di VARCHAR(400)`);
    assert.ok(!t.isi.includes("kunciPenyimpanan"));
    assert.ok(!t.isi.includes("sha256"));
    assert.ok(!/[0-9a-f]{64}/i.test(t.isi));
  }
});

test("tautanNotifikasi: link internal hanya dibentuk dari dokumenId", () => {
  assert.equal(tautanNotifikasi({ dokumenId: "doc123" }), "/administrasi/doc123");
});

test("kunciEvent: unik per aksi + id riwayat sumber", () => {
  assert.equal(kunciEvent("kirim", "rw1"), "kirim:rw1");
  assert.notEqual(kunciEvent("kirim", "rw1"), kunciEvent("kirim-revisi", "rw1"));
  assert.notEqual(kunciEvent("kirim", "rw1"), kunciEvent("kirim", "rw2"));
});

function potongFungsi(src: string, nama: string): string {
  const awal = src.indexOf(`export async function ${nama}`);
  assert.ok(awal > -1, `${nama} harus ada`);
  const akhir = src.indexOf("export async function", awal + 10);
  return src.slice(awal, akhir > 0 ? akhir : undefined);
}

test("kontrak lima transisi: notifikasi dibuat dalam transaksi yang sama dengan perubahan status", () => {
  const src = baca("lib/actions/dokumen.ts");
  const kasus: Array<{ fn: string; penerima: RegExp; jenis: string; aksiRiwayat: string }> = [
    { fn: "kirimDokumen", penerima: /buatNotifikasiKamad/, jenis: '"DOKUMEN_DIKIRIM"', aksiRiwayat: 'kunciEvent("kirim"' },
    { fn: "kirimRevisiDokumen", penerima: /buatNotifikasiKamad/, jenis: '"REVISI_DIKIRIM"', aksiRiwayat: 'kunciEvent("kirim-revisi"' },
    { fn: "mintaRevisiDokumen", penerima: /buatNotifikasiPemilik/, jenis: '"PERLU_REVISI"', aksiRiwayat: 'kunciEvent("minta-revisi"' },
    { fn: "setujuiDokumen", penerima: /buatNotifikasiPemilik/, jenis: '"DISETUJUI"', aksiRiwayat: 'kunciEvent("setujui"' },
    { fn: "finalisasiDokumen", penerima: /buatNotifikasiPemilik/, jenis: '"DIFINALKAN"', aksiRiwayat: 'kunciEvent("finalisasi"' },
  ];
  for (const k of kasus) {
    const body = potongFungsi(src, k.fn);
    const idxTx = body.indexOf("$transaction(async");
    const idxNotif = body.search(k.penerima);
    const idxJenis = body.indexOf(k.jenis, idxTx);
    const idxKey = body.indexOf(k.aksiRiwayat, idxTx);
    assert.ok(idxTx > -1, `${k.fn}: harus pakai transaksi interaktif`);
    assert.ok(idxNotif > idxTx, `${k.fn}: buatNotifikasi harus di dalam transaksi`);
    assert.ok(idxJenis > idxTx, `${k.fn}: jenis notifikasi harus di dalam transaksi`);
    assert.ok(idxKey > idxTx, `${k.fn}: event key dari riwayat harus di dalam transaksi`);
  }
});

test("kontrak keamanan: dokumen.ts tidak membuat notifikasi di luar service", () => {
  const src = baca("lib/actions/dokumen.ts");
  assert.doesNotMatch(src, /notifikasiAdministrasi\.(create|upsert|updateMany)/);
  assert.doesNotMatch(src, /(pertemuan|absensi|penilaian|nilaiSiswa|\bjurnal\b)/i);
});
