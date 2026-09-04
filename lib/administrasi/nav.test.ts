import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "path";
import type { Role } from "@prisma/client";
import {
  getAdministrasiBottomNav,
  getAdministrasiNav,
  isNavAktif,
} from "./nav-config";

const SEMUA_ROLE: Role[] = ["GURU", "WAKA", "KEPALA", "ADMIN", "SUPERADMIN"];

function semuaHref(role: Role): string[] {
  return getAdministrasiNav(role).flatMap((g) => g.items.map((i) => i.href));
}

test("guru melihat Dashboard, Dokumen Saya, Ajukan, Notifikasi, Arsip, Template", () => {
  const hrefs = semuaHref("GURU");
  for (const href of [
    "/administrasi",
    "/administrasi/dokumen-saya",
    "/administrasi/baru",
    "/administrasi/notifikasi",
    "/administrasi/arsip",
    "/administrasi/template",
  ]) {
    assert.ok(hrefs.includes(href), `GURU harus punya ${href}`);
  }
  const labels = getAdministrasiNav("GURU").map((g) => g.label);
  assert.deepEqual(labels, ["Ruang Kerja", "Arsip & Referensi"]);
});

test("guru biasa dan WAKA tidak melihat Kotak Masuk", () => {
  for (const role of ["GURU", "WAKA"] as Role[]) {
    assert.ok(!semuaHref(role).includes("/administrasi/kotak-masuk"), `${role} tidak boleh melihat Kotak Masuk`);
    const labels = getAdministrasiNav(role).map((g) => g.label);
    assert.ok(
      !labels.includes("Pemeriksaan"),
      `${role} tidak boleh punya kelompok Pemeriksaan`
    );
  }
});

test("KEPALA/ADMIN/SUPERADMIN: 3 kelompok nav tanpa Dokumen Pribadi", () => {
  for (const role of ["KEPALA", "ADMIN", "SUPERADMIN"] as Role[]) {
    const groups = getAdministrasiNav(role);
    const labels = groups.map((g) => g.label);
    assert.deepEqual(
      labels,
      ["Ringkasan", "Pemeriksaan", "Arsip & Referensi"],
      `${role} harus punya 3 kelompok: Ringkasan, Pemeriksaan, Arsip & Referensi (tanpa Dokumen Pribadi)`
    );

    // Ringkasan berisi Dashboard + Notifikasi
    const ringkasan = groups.find((g) => g.label === "Ringkasan")!;
    assert.deepEqual(
      ringkasan.items.map((i) => i.href),
      ["/administrasi", "/administrasi/notifikasi"]
    );

    // Pemeriksaan hanya berisi Kotak Masuk
    const pemeriksaan = groups.find((g) => g.label === "Pemeriksaan")!;
    assert.deepEqual(pemeriksaan.items.map((i) => i.href), ["/administrasi/kotak-masuk"]);

    // Tidak ada kelompok Dokumen Pribadi untuk pemeriksa.
    assert.ok(
      !labels.includes("Dokumen Pribadi"),
      `${role} TIDAK boleh punya kelompok Dokumen Pribadi`
    );
  }
});

test("KEPALA/ADMIN/SUPERADMIN: TIDAK memiliki href Dokumen Saya / Ajukan Dokumen", () => {
  for (const role of ["KEPALA", "ADMIN", "SUPERADMIN"] as Role[]) {
    const hrefs = semuaHref(role);
    assert.ok(
      !hrefs.includes("/administrasi/dokumen-saya"),
      `${role}: sidebar TIDAK boleh memuat Dokumen Saya`
    );
    assert.ok(
      !hrefs.includes("/administrasi/baru"),
      `${role}: sidebar TIDAK boleh memuat Ajukan Dokumen`
    );
  }
});

test("GURU/WAKA: TETAP memiliki href Dokumen Saya & Ajukan Dokumen", () => {
  for (const role of ["GURU", "WAKA"] as Role[]) {
    const hrefs = semuaHref(role);
    assert.ok(hrefs.includes("/administrasi/dokumen-saya"), `${role} harus punya Dokumen Saya`);
    assert.ok(hrefs.includes("/administrasi/baru"), `${role} harus punya Ajukan Dokumen`);
  }
});

test("Kotak Masuk ada di kelompok Pemeriksaan untuk KEPALA/ADMIN/SUPERADMIN", () => {
  for (const role of ["KEPALA", "ADMIN", "SUPERADMIN"] as Role[]) {
    const hrefs = semuaHref(role);
    assert.ok(hrefs.includes("/administrasi/kotak-masuk"), `${role} harus punya Kotak Masuk`);
  }
});

test("tidak ada href duplikat untuk semua role", () => {
  for (const role of SEMUA_ROLE) {
    const hrefs = semuaHref(role);
    assert.deepEqual([...new Set(hrefs)], hrefs, `${role} memiliki href duplikat`);
    const bottom = getAdministrasiBottomNav(role).map((i) => i.href);
    assert.deepEqual([...new Set(bottom)], bottom, `${role} memiliki href bottom nav duplikat`);
  }
});

test("bottom nav: guru 3 item, KEPALA/ADMIN/SUPERADMIN 4 item persis", () => {
  assert.equal(getAdministrasiBottomNav("GURU").length, 3);
  assert.equal(getAdministrasiBottomNav("KEPALA").length, 4);
  assert.equal(getAdministrasiBottomNav("ADMIN").length, 4);
  assert.equal(getAdministrasiBottomNav("SUPERADMIN").length, 4);
  assert.deepEqual(getAdministrasiBottomNav("KEPALA").map((i) => i.href), [
    "/administrasi",
    "/administrasi/kotak-masuk",
    "/administrasi/arsip",
    "/administrasi/notifikasi",
  ]);
});

test("bottom nav KEPALA: tidak memuat Ajukan/Dokumen Saya (tetap di drawer)", () => {
  for (const role of ["KEPALA", "ADMIN", "SUPERADMIN"] as Role[]) {
    const hrefs = getAdministrasiBottomNav(role).map((i) => i.href);
    assert.ok(!hrefs.includes("/administrasi/dokumen-saya"), `${role}: bottom nav tidak memuat Dokumen Saya`);
    assert.ok(!hrefs.includes("/administrasi/baru"), `${role}: bottom nav tidak memuat Ajukan`);
  }
});

test("bottom nav guru: 3 item lama tidak berubah", () => {
  assert.deepEqual(getAdministrasiBottomNav("GURU").map((i) => i.href), [
    "/administrasi",
    "/administrasi/dokumen-saya",
    "/administrasi/baru",
  ]);
});

test("active route: detail dokumen menandai Dokumen Saya", () => {
  const hrefDokumen = "/administrasi/dokumen-saya";
  assert.equal(isNavAktif("/administrasi/dokumen-saya", hrefDokumen), true);
  assert.equal(isNavAktif("/administrasi/doc123", hrefDokumen), true);
  // route khusus bukan detail dokumen
  assert.equal(isNavAktif("/administrasi/baru", hrefDokumen), false);
  assert.equal(isNavAktif("/administrasi/arsip", hrefDokumen), false);
  assert.equal(isNavAktif("/administrasi/kotak-masuk", hrefDokumen), false);
  assert.equal(isNavAktif("/administrasi/notifikasi", hrefDokumen), false);
});

test("active route: kotak masuk detail tetap menandai Kotak Masuk", () => {
  const hrefKotak = "/administrasi/kotak-masuk";
  assert.equal(isNavAktif("/administrasi/kotak-masuk", hrefKotak), true);
  assert.equal(isNavAktif("/administrasi/kotak-masuk/doc456", hrefKotak), true);
  assert.equal(isNavAktif("/administrasi", hrefKotak), false);
});

test("active route: notifikasi detail menandai Notifikasi", () => {
  assert.equal(isNavAktif("/administrasi/notifikasi", "/administrasi/notifikasi"), true);
  assert.equal(isNavAktif("/administrasi/notifikasi/x/buka", "/administrasi/notifikasi"), true);
});

test("active route: dashboard hanya aktif persis di /administrasi", () => {
  assert.equal(isNavAktif("/administrasi", "/administrasi"), true);
  assert.equal(isNavAktif("/administrasi/", "/administrasi"), true);
  assert.equal(isNavAktif("/administrasi/doc1", "/administrasi"), false);
  assert.equal(isNavAktif("/", "/administrasi"), false);
  assert.equal(isNavAktif(null, "/administrasi"), false);
});

test("seluruh target navigasi memiliki halaman", () => {
  const dasar = path.resolve("app/(administrasi)/administrasi");
  const target: Record<string, string> = {
    "/administrasi": path.join(dasar, "page.tsx"),
    "/administrasi/dokumen-saya": path.join(dasar, "dokumen-saya/page.tsx"),
    "/administrasi/baru": path.join(dasar, "baru/page.tsx"),
    "/administrasi/kotak-masuk": path.join(dasar, "kotak-masuk/page.tsx"),
    "/administrasi/arsip": path.join(dasar, "arsip/page.tsx"),
    "/administrasi/template": path.join(dasar, "template/page.tsx"),
    "/administrasi/notifikasi": path.join(dasar, "notifikasi/page.tsx"),
  };
  for (const role of SEMUA_ROLE) {
    for (const href of semuaHref(role)) {
      const file = target[href];
      assert.ok(file, `href ${href} belum dipetakan ke halaman`);
      assert.ok(existsSync(file), `halaman untuk ${href} tidak ditemukan: ${file}`);
    }
  }
});
