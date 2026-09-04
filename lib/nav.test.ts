import { test } from "node:test";
import assert from "node:assert/strict";
import { isNavActive, hitungBadgeIncomplete } from "./absensi-harian";
import { getBottomNavConfig, getSidebarNav } from "./nav-config";

test("Absen Harian aktif di daftar dan detail", () => {
  assert.equal(isNavActive("/absensi-harian", "/absensi-harian"), true);
  assert.equal(isNavActive("/absensi-harian/kelas123", "/absensi-harian"), true);
  assert.equal(isNavActive("/absensi-harian/kelas123?x=1".split("?")[0], "/absensi-harian"), true);
});

test("tidak aktif di halaman lain", () => {
  assert.equal(isNavActive("/absensi", "/absensi-harian"), false);
  assert.equal(isNavActive("/jurnal", "/absensi-harian"), false);
  assert.equal(isNavActive("/", "/absensi-harian"), false);
});

test("root hanya aktif di /", () => {
  assert.equal(isNavActive("/", "/"), true);
  assert.equal(isNavActive("/jadwal", "/"), false);
});

test("badge: guru jam pertama 2 kelas, 1 lengkap 1 belum => 1", () => {
  const m = new Map([["k1", { lengkap: true }], ["k2", { lengkap: false }]]);
  assert.equal(hitungBadgeIncomplete(["k1", "k2"], m), 1);
});

test("badge: semua lengkap => 0", () => {
  const m = new Map([["k1", { lengkap: true }], ["k2", { lengkap: true }]]);
  assert.equal(hitungBadgeIncomplete(["k1", "k2"], m), 0);
});

test("badge: guru bukan jam pertama tidak dihitung", () => {
  const m = new Map([["kX", { lengkap: false }]]);
  assert.equal(hitungBadgeIncomplete([], m), 0);
  assert.equal(hitungBadgeIncomplete(["k1"], new Map()), 1);
});

test("badge: wali kelas bukan jam pertama tidak dihitung (hanya jam pertama)", () => {
  const m = new Map([["kWali", { lengkap: false }]]);
  assert.equal(hitungBadgeIncomplete([], m), 0);
});

test("badge: guru BK bukan jam pertama => 0", () => {
  assert.equal(hitungBadgeIncomplete([], new Map([["k1", { lengkap: false }]])), 0);
});

test("badge: akun PIKET tidak dihitung sebagai kewajiban", () => {
  assert.equal(hitungBadgeIncomplete([], new Map()), 0);
});

test("badge: belum ada validasi dianggap belum (tidak membuat data)", () => {
  const m = new Map<string, { lengkap: boolean }>();
  assert.equal(hitungBadgeIncomplete(["k1", "k2"], m), 2);
});

test("KEPALA bottom nav: 4 item sesuai daftar", () => {
  const nav = getBottomNavConfig("KEPALA", "BIASA", false)!;
  assert.equal(nav.length, 4);
  assert.deepEqual(nav.map((n) => n.href), ["/kamad", "/pemantauan-absensi", "/laporan", "/laporan-bulanan"]);
});

test("WAKA bottom nav (tanpa guruId): 4 item pemantauan", () => {
  const nav = getBottomNavConfig("WAKA", "BIASA", false, null)!;
  assert.equal(nav.length, 4);
  assert.deepEqual(nav.map((n) => n.href), ["/waka", "/pemantauan-absensi", "/jurnal", "/laporan-bulanan"]);
});

test("WAKA bottom nav (terhubung): maksimal 5 item, dashboard + inti pengajaran", () => {
  const nav = getBottomNavConfig("WAKA", "BIASA", false, "g1")!;
  assert.ok(nav.length <= 5);
  const hrefs = nav.map((n) => n.href);
  assert.equal(new Set(hrefs).size, hrefs.length);
  assert.ok(hrefs.includes("/waka"));
  assert.ok(hrefs.includes("/jadwal"));
  assert.ok(hrefs.includes("/jurnal"));
  assert.ok(hrefs.includes("/absensi-harian"));
});

test("sidebar WAKA terhubung: dua kelompok (Pengajaran Saya + Pemantauan Waka) tanpa href duplikat", () => {
  const groups = getSidebarNav("WAKA", { guruId: "g1" });
  assert.deepEqual(groups.map((g) => g.label), ["Pengajaran Saya", "Pemantauan Waka"]);
  const hrefs = groups.flatMap((g) => g.items.map((i) => i.href));
  assert.deepEqual([...new Set(hrefs)].sort(), [...hrefs].sort());
  const pengajaran = groups[0].items.map((i) => i.href);
  assert.deepEqual(pengajaran, ["/jadwal", "/jurnal", "/absensi", "/absensi-harian", "/nilai"]);
  const pemantauan = groups[1].items.map((i) => i.href);
  assert.ok(pemantauan.includes("/waka"));
  assert.ok(pemantauan.includes("/pemantauan-absensi"));
  assert.ok(pemantauan.includes("/laporan"));
  assert.ok(pemantauan.includes("/laporan-bulanan"));
  assert.ok(pemantauan.includes("/profil"));
  // Akses pengajaran milik Waka tidak hilang, pemantauan tetap ada.
  assert.ok(!pemantauan.includes("/jadwal"));
});

test("sidebar WAKA tanpa guruId: hanya kelompok Pemantauan Waka", () => {
  const groups = getSidebarNav("WAKA", { guruId: null });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, "Pemantauan Waka");
  const hrefs = groups[0].items.map((i) => i.href);
  assert.equal(new Set(hrefs).size, hrefs.length);
  assert.ok(!hrefs.includes("/jadwal"));
  assert.ok(!hrefs.includes("/nilai"));
});

test("tidak ada href duplikat untuk SEMUA konfigurasi role", () => {
  const konfigurasi: { nama: string; groups: ReturnType<typeof getSidebarNav> }[] = [
    { nama: "GURU", groups: getSidebarNav("GURU", { jenisGuru: "BIASA" }) },
    { nama: "GURU BK", groups: getSidebarNav("GURU", { jenisGuru: "BK" }) },
    { nama: "GURU PIKET", groups: getSidebarNav("GURU", { isAkunPiket: true }) },
    { nama: "WAKA terhubung", groups: getSidebarNav("WAKA", { guruId: "g1" }) },
    { nama: "WAKA lepas", groups: getSidebarNav("WAKA", {}) },
    { nama: "KEPALA", groups: getSidebarNav("KEPALA") },
    { nama: "ADMIN", groups: getSidebarNav("ADMIN") },
    { nama: "SUPERADMIN", groups: getSidebarNav("SUPERADMIN") },
  ];
  for (const k of konfigurasi) {
    const hrefs = k.groups.flatMap((g) => g.items.map((i) => i.href));
    assert.deepEqual(
      [...new Set(hrefs)],
      hrefs,
      `${k.nama} memiliki href duplikat: ${hrefs.join(", ")}`
    );
  }
});

test("PIKET bottom nav: 4 item sesuai daftar", () => {
  const nav = getBottomNavConfig("GURU", "PIKET", true)!;
  assert.equal(nav.length, 4);
  assert.deepEqual(nav.map((n) => n.href), [
    "/absensi-harian",
    "/kelola-absensi",
    "/piket/penanggung-jawab",
    "/profil",
  ]);
});

test("BK bottom nav: 2 item sesuai daftar", () => {
  const nav = getBottomNavConfig("GURU", "BK", false)!;
  assert.equal(nav.length, 2);
  assert.deepEqual(nav.map((n) => n.href), ["/bk", "/profil"]);
});

test("BK tidak pakai nav Guru biasa", () => {
  const bk = getBottomNavConfig("GURU", "BK", false)!;
  const guru = getBottomNavConfig("GURU", "BIASA", false)!;
  assert.notDeepEqual(bk.map((n) => n.href), guru.map((n) => n.href));
});

test("Piket tidak pakai nav Guru biasa", () => {
  const piket = getBottomNavConfig("GURU", "PIKET", true)!;
  const guru = getBottomNavConfig("GURU", "BIASA", false)!;
  assert.notDeepEqual(piket.map((n) => n.href), guru.map((n) => n.href));
});

test("isNavActive: detail laporan-bulanan aktifkan parent", () => {
  assert.equal(isNavActive("/laporan-bulanan/2026-08", "/laporan-bulanan"), true);
  assert.equal(isNavActive("/laporan-bulanan", "/laporan-bulanan"), true);
  assert.equal(isNavActive("/laporan-bulanan/2026-08/extra", "/laporan-bulanan"), true);
  assert.equal(isNavActive("/laporan", "/laporan-bulanan"), false);
});

test("ADMIN/SUPERADMIN tidak punya bottom nav mobile", () => {
  assert.equal(getBottomNavConfig("ADMIN", "BIASA", false), null);
  assert.equal(getBottomNavConfig("SUPERADMIN", "BIASA", false), null);
});
