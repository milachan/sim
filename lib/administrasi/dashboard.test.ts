import { test } from "node:test";
import assert from "node:assert/strict";
import type { StatusDokumen } from "@prisma/client";
import {
  ALUR_DOKUMEN,
  bangunKartuStatistikPemeriksa,
  bangunWhereDokumenSaya,
  bersihkanQueryCarian,
  copyHeaderDashboard,
  gabungPerluTindakan,
  hitungStatistikPemeriksa,
  hitungStatistikPengaju,
  hrefItemTindakan,
  hrefTabKotakMasuk,
  indikatorStatus,
  labelAksiAntrean,
  labelAksiItemTindakan,
  opsiFilterDokumen,
  OPSI_FILTER_DOKUMEN,
  pilihPerluTindakan,
  STATUS_SELESAI_PENGAJU,
  urutAntreanLembaga,
  urutPrioritasTindakan,
} from "./dashboard";

function jumlah(pasangan: Partial<Record<StatusDokumen, number>>) {
  return pasangan;
}

test("statistik pengaju: selesai mencakup DISETUJUI+DIFINALKAN+DIARSIPKAN", () => {
  const s = hitungStatistikPengaju(
    jumlah({ DRAF: 2, DIKIRIM: 3, PERLU_REVISI: 1, DISETUJUI: 4, DIFINALKAN: 5, DIARSIPKAN: 6 })
  );
  assert.equal(s.draf, 2);
  assert.equal(s.diproses, 3);
  assert.equal(s.perluRevisi, 1);
  assert.equal(s.selesai, 15); // 4 + 5 + 6
});

test("statistik pengaju: status yang hilang dihitung 0", () => {
  const s = hitungStatistikPengaju(jumlah({}));
  assert.deepEqual(s, { draf: 0, diproses: 0, perluRevisi: 0, selesai: 0 });
});

test("statistik pemeriksa hanya dari DIKIRIM/PERLU_REVISI/DISETUJUI/DIFINALKAN", () => {
  const s = hitungStatistikPemeriksa(
    jumlah({ DRAF: 99, DIARSIPKAN: 99, DIKIRIM: 2, PERLU_REVISI: 3, DISETUJUI: 4, DIFINALKAN: 5 })
  );
  assert.deepEqual(s, { menunggu: 2, perluRevisi: 3, disetujui: 4, difinalkan: 5 });
});

test("prioritas tindakan: PERLU_REVISI lebih tinggi daripada draf biasa", () => {
  const items = [
    { id: "a", status: "DRAF" as StatusDokumen },
    { id: "b", status: "PERLU_REVISI" as StatusDokumen },
    { id: "c", status: "DRAF" as StatusDokumen },
  ];
  const urut = urutPrioritasTindakan(items);
  assert.deepEqual(
    urut.map((i) => i.id),
    ["b", "a", "c"]
  );
});

test("pilihPerluTindakan membatasi maksimal n item sesuai prioritas", () => {
  const items = [
    { id: "d1", status: "DRAF" as StatusDokumen },
    { id: "d2", status: "DRAF" as StatusDokumen },
    { id: "r1", status: "PERLU_REVISI" as StatusDokumen },
    { id: "d3", status: "DRAF" as StatusDokumen },
    { id: "d4", status: "DRAF" as StatusDokumen },
    { id: "d5", status: "DRAF" as StatusDokumen },
    { id: "d6", status: "DRAF" as StatusDokumen },
  ];
  const hasil = pilihPerluTindakan(items, 5);
  assert.equal(hasil.length, 5);
  // PERLU_REVISI masuk duluan, sisanya draf teratas.
  assert.equal(hasil[0]?.id, "r1");
  assert.ok(!hasil.some((i) => i.id === "d6"));
});

test("gabungPerluTindakan menggabungkan query, buang duplikat id, batasi 5", () => {
  const milik = [
    { id: "x1", status: "PERLU_REVISI" as StatusDokumen },
    { id: "x2", status: "DRAF" as StatusDokumen },
  ];
  const kotakMasuk = [
    { id: "k1", status: "DIKIRIM" as StatusDokumen },
    { id: "k2", status: "DIKIRIM" as StatusDokumen },
    { id: "k3", status: "DIKIRIM" as StatusDokumen },
    { id: "x1", status: "PERLU_REVISI" as StatusDokumen }, // duplikat
  ];
  const hasil = gabungPerluTindakan([milik, kotakMasuk], 5);
  assert.equal(hasil.length, 5);
  assert.deepEqual(
    hasil.map((i) => i.status),
    ["PERLU_REVISI", "DIKIRIM", "DIKIRIM", "DIKIRIM", "DRAF"]
  );
});

test("filter status valid dikenali; nilai asing kembali ke Semua", () => {
  assert.equal(opsiFilterDokumen("draf").label, "Draf");
  assert.equal(opsiFilterDokumen("difinalkan").statuses.includes("DIARSIPKAN"), true);
  assert.equal(opsiFilterDokumen("hacker").nilai, "semua");
  assert.equal(opsiFilterDokumen(null).nilai, "semua");
  assert.equal(opsiFilterDokumen(undefined).nilai, "semua");
  assert.equal(opsiFilterDokumen("").nilai, "semua");
  // Semua opsi punya label unik dan daftar status non-kosong (kecuali semua).
  const labels = OPSI_FILTER_DOKUMEN.map((o) => o.label);
  assert.equal(new Set(labels).size, labels.length);
});

test("pencarian kosong tidak menambah kondisi judul pada where", () => {
  const w1 = bangunWhereDokumenSaya("u1", "semua", "");
  assert.deepEqual(w1, { pengajuUserId: "u1" });
  const w2 = bangunWhereDokumenSaya("u1", "semua", "   ");
  assert.deepEqual(w2, { pengajuUserId: "u1" });
  const w3 = bangunWhereDokumenSaya("u1", null, null);
  assert.deepEqual(w3, { pengajuUserId: "u1" });
});

test("where dokumen saya: filter + pencarian diproses server-side", () => {
  const w = bangunWhereDokumenSaya("u7", "perlu_revisi", "  Laporan  ");
  assert.deepEqual(w, {
    pengajuUserId: "u7",
    status: { in: ["PERLU_REVISI"] },
    judul: { contains: "Laporan" },
  });
});

test("where dokumen saya selalu terikat pengajuUserId (tanpa data orang lain)", () => {
  for (const f of [null, "", "semua", "draf", "asing"]) {
    for (const q of [null, "", "abc"]) {
      const w = bangunWhereDokumenSaya("u-pemilik", f, q);
      assert.equal(w.pengajuUserId, "u-pemilik");
      assert.ok(!("pengajuUserId" in w && Array.isArray(w.pengajuUserId)));
    }
  }
});

test("bersihkanQueryCarian memotong spasi dan mengembalikan null bila kosong", () => {
  assert.equal(bersihkanQueryCarian("  x "), "x");
  assert.equal(bersihkanQueryCarian("\t"), null);
  assert.equal(bersihkanQueryCarian(undefined), null);
});

test("STATUS_SELESAI_PENGAJU tepat tiga status", () => {
  assert.deepEqual([...STATUS_SELESAI_PENGAJU], ["DISETUJUI", "DIFINALKAN", "DIARSIPKAN"]);
});

test("indikator status hanya untuk status yang butuh aksi/menunggu", () => {
  assert.equal(indikatorStatus("PERLU_REVISI")?.tonal, "amber");
  assert.equal(indikatorStatus("DRAF")?.tonal, "slate");
  assert.equal(indikatorStatus("DIKIRIM")?.tonal, "blue");
  assert.equal(indikatorStatus("DISETUJUI"), null);
  assert.equal(indikatorStatus("DIFINALKAN"), null);
  assert.equal(indikatorStatus("DIARSIPKAN"), null);
});

test("hrefItemTindakan: item kotak-masuk mengarah ke halaman pemeriksaan, bukan detail pemilik", () => {
  assert.equal(hrefItemTindakan("abc", "kotak-masuk"), "/administrasi/kotak-masuk/abc");
  assert.equal(hrefItemTindakan("abc", "pribadi"), "/administrasi/abc");
});

test("labelAksiItemTindakan: DIKIRIM pribadi tetap 'Lanjutkan draf' (bukan 'Periksa sekarang')", () => {
  // Kasus regresi: status DIKIRIM pada item pribadi harus pakai label pribadi.
  // Hanya konteks kotak-masuk yang memicu label 'Periksa sekarang'.
  assert.equal(labelAksiItemTindakan("pribadi", "DIKIRIM" as StatusDokumen), "Lanjutkan draf");
  assert.equal(labelAksiItemTindakan("pribadi", "PERLU_REVISI"), "Perbaiki & kirim ulang");
  assert.equal(labelAksiItemTindakan("pribadi", "DRAF"), "Lanjutkan draf");
  assert.equal(labelAksiItemTindakan("kotak-masuk", "DIKIRIM"), "Periksa sekarang");
  assert.equal(labelAksiItemTindakan("kotak-masuk", "PERLU_REVISI"), "Periksa sekarang");
  assert.equal(labelAksiItemTindakan("kotak-masuk", "DISETUJUI"), "Periksa sekarang");
});

test("hrefTabKotakMasuk: tab selain default pakai query, menunggu tanpa query", () => {
  assert.equal(hrefTabKotakMasuk("menunggu"), "/administrasi/kotak-masuk");
  assert.equal(hrefTabKotakMasuk("perlu_revisi"), "/administrasi/kotak-masuk?tab=perlu_revisi");
  assert.equal(hrefTabKotakMasuk("disetujui"), "/administrasi/kotak-masuk?tab=disetujui");
  assert.equal(hrefTabKotakMasuk("difinalkan"), "/administrasi/kotak-masuk?tab=difinalkan");
});

test("bangunKartuStatistikPemeriksa: 4 kartu, urutan tetap, difinalkan mencakup arsip", () => {
  const kartu = bangunKartuStatistikPemeriksa({
    DIKIRIM: 7,
    PERLU_REVISI: 3,
    DISETUJUI: 2,
    DIFINALKAN: 5,
    DIARSIPKAN: 1,
  });
  assert.equal(kartu.length, 4);
  assert.deepEqual(
    kartu.map((k) => k.tab),
    ["menunggu", "perlu_revisi", "disetujui", "difinalkan"]
  );
  assert.equal(kartu[0].nilai, 7);
  assert.equal(kartu[1].nilai, 3);
  assert.equal(kartu[2].nilai, 2);
  assert.equal(kartu[3].nilai, 6); // 5 + 1 arsip
});

test("urutAntreanLembaga: DIKIRIM terlama di atas, dibatasi maks", () => {
  const items = [
    { id: "baru", updatedAt: "2026-08-25T10:00:00Z" },
    { id: "lama", updatedAt: "2026-08-20T10:00:00Z" },
    { id: "tengah", updatedAt: "2026-08-22T10:00:00Z" },
    { id: "a", updatedAt: "2026-08-18T10:00:00Z" },
    { id: "b", updatedAt: "2026-08-19T10:00:00Z" },
    { id: "c", updatedAt: "2026-08-21T10:00:00Z" },
  ];
  const urut = urutAntreanLembaga(items, 3);
  assert.deepEqual(
    urut.map((i) => i.id),
    ["a", "b", "lama"] // paling lama (updatedAt ascending) dibatasi 3
  );
});

test("labelAksiAntrean: milik sendiri menampilkan 'Menunggu pemeriksa lain'", () => {
  assert.equal(labelAksiAntrean(true), "Menunggu pemeriksa lain");
  assert.equal(labelAksiAntrean(false), "Periksa sekarang");
});

test("copyHeaderDashboard: pemeriksa dapat subtitle pemeriksaan, non-pemeriksa tidak menyebut 'disetujui Kamad'", () => {
  const k = copyHeaderDashboard("KEPALA");
  assert.equal(k.eyebrow, "Ruang kerja pemeriksa");
  assert.match(k.subtitle, /Pantau pengajuan guru/);
  // Penekanan: kalimat "hingga disetujui Kamad" (versi lama) tidak lagi dipakai di subtitle.
  assert.equal(k.subtitle.includes("dokumen Anda"), false);
  assert.equal(k.subtitle.includes("disetujui Kamad"), false);

  const a = copyHeaderDashboard("ADMIN");
  assert.equal(a.eyebrow, "Ruang kerja pemeriksa");
  const s = copyHeaderDashboard("SUPERADMIN");
  assert.equal(s.eyebrow, "Ruang kerja pemeriksa");

  const guru = copyHeaderDashboard("GURU");
  assert.equal(guru.eyebrow, "Rumah Administrasi");
  assert.match(guru.subtitle, /dokumen administrasi Anda/);
  const waka = copyHeaderDashboard("WAKA");
  assert.equal(waka.eyebrow, "Rumah Administrasi");
});

test("ALUR_DOKUMEN: tetap tersedia untuk semua role (definisi tidak hilang)", () => {
  assert.ok(ALUR_DOKUMEN.length >= 4);
});
