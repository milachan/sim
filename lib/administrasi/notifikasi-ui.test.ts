import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import type { Role } from "@prisma/client";
import {
  formatJumlahBadge,
  opsiFilterNotifikasi,
  labelStatusDibaca,
  tautanAmanNotifikasi,
  ikonJenisNotifikasi,
} from "./notifikasi-ui";
import { getAdministrasiBottomNav, getAdministrasiNav, isNavAktif } from "./nav-config";

const baca = (rel: string) => readFileSync(path.resolve(rel), "utf8");

const SEMUA_JENIS = ["DOKUMEN_DIKIRIM", "REVISI_DIKIRIM", "PERLU_REVISI", "DISETUJUI", "DIFINALKAN"];
const SEMUA_ROLE: Role[] = ["GURU", "WAKA", "KEPALA", "ADMIN", "SUPERADMIN"];

test("formatJumlahBadge: nol tanpa badge, 1–99 angka, ≥100 selalu 99+", () => {
  assert.equal(formatJumlahBadge(0), null);
  assert.equal(formatJumlahBadge(-3), null);
  assert.equal(formatJumlahBadge(Number.NaN), null);
  assert.equal(formatJumlahBadge(1), "1");
  assert.equal(formatJumlahBadge(9), "9");
  assert.equal(formatJumlahBadge(10), "10");
  assert.equal(formatJumlahBadge(99), "99");
  assert.equal(formatJumlahBadge(100), "99+");
  assert.equal(formatJumlahBadge(250), "99+");
});

test("opsiFilterNotifikasi: nilai asing kembali konsisten ke 'semua'", () => {
  for (const asing of [null, undefined, "", "hack", "../../", "BELUM", "Semua", "belum OR 1=1"]) {
    assert.equal(opsiFilterNotifikasi(asing as string | null | undefined), "semua", `nilai ${String(asing)} harus 'semua'`);
  }
  assert.equal(opsiFilterNotifikasi("belum"), "belum");
  assert.equal(opsiFilterNotifikasi("sudah"), "sudah");
  // Idempoten: hasil dinormalisasi tidak berubah bila diproses ulang.
  for (const masukan of ["belum", "sudah", "hack"]) {
    const sekali = opsiFilterNotifikasi(masukan);
    assert.equal(opsiFilterNotifikasi(sekali), sekali);
  }
});

test("labelStatusDibaca: indikator teks, bukan warna saja", () => {
  assert.equal(labelStatusDibaca(null), "Belum Dibaca");
  assert.equal(labelStatusDibaca(new Date()), "Dibaca");
  assert.notEqual(labelStatusDibaca(null), labelStatusDibaca(new Date()));
});

test("tautanAmanNotifikasi: hanya path internal /administrasi/ yang lolos", () => {
  assert.equal(tautanAmanNotifikasi("/administrasi/doc123"), "/administrasi/doc123");
  assert.equal(tautanAmanNotifikasi("/administrasi/doc123?x=1"), "/administrasi/doc123?x=1");
  assert.equal(tautanAmanNotifikasi(null), null);
  assert.equal(tautanAmanNotifikasi(""), null);
  assert.equal(tautanAmanNotifikasi("https://evil.com/administrasi/x"), null);
  assert.equal(tautanAmanNotifikasi("//evil.com"), null);
  assert.equal(tautanAmanNotifikasi("javascript:alert(1)"), null);
  assert.equal(tautanAmanNotifikasi("/administrator/x"), null);
  assert.equal(tautanAmanNotifikasi("/administrasi\n/ok"), null);
  assert.equal(tautanAmanNotifikasi("administrasi/doc"), null);
});

test("ikonJenisNotifikasi: kelima jenis punya ikon, jenis asing fallback", () => {
  for (const jenis of SEMUA_JENIS) {
    assert.ok(ikonJenisNotifikasi(jenis), `jenis ${jenis} harus punya ikon`);
  }
  // Jenis yang belum dikenal tetap mendapat ikon fallback (tidak melempar).
  assert.ok(ikonJenisNotifikasi("JENIS_PALING_BARU"));
});

// ---------- Kontrak UI: layout, shell, lonceng ----------

const srcLayout = baca("app/(administrasi)/administrasi/layout.tsx");

test("layout: unread dihitung server-side dari session, shell hanya menerima angka", () => {
  assert.match(srcLayout, /jumlahNotifikasiBelumDibaca\(user\.id\)/);
  assert.match(srcLayout, /jumlahNotifikasiBelum=\{jumlahNotifikasiBelum\}/);
  // Data mentah tidak boleh dikirim ke shell client.
  assert.doesNotMatch(srcLayout, /daftarNotifikasiUser/);
});

const srcLonceng = baca("components/administrasi/tombol-notifikasi.tsx");

test("lonceng: link ke pusat notifikasi, aria-label menyebut unread, badge kondisional", () => {
  assert.match(srcLonceng, /href="\/administrasi\/notifikasi"/);
  assert.match(srcLonceng, /aria-label=\{label\}/);
  assert.match(srcLonceng, /belum dibaca/);
  assert.match(srcLonceng, /formatJumlahBadge\(jumlah\)/);
  assert.match(srcLonceng, /badge !== null &&/);
  // Target sentuh minimal 44px.
  assert.match(srcLonceng, /h-11 w-11/);
  // Badge dekoratif tidak dibacakan dua kali oleh screen reader.
  assert.match(srcLonceng, /aria-hidden="true"/);
});

const srcShell = baca("components/administrasi/administrasi-shell.tsx");

test("shell: terima angka unread, lonceng di desktop + mobile, tanpa popover", () => {
  assert.match(srcShell, /jumlahNotifikasiBelum: number/);
  assert.match(srcShell, /<TombolNotifikasi jumlah=\{jumlahNotifikasiBelum\}/);
  // Dua penempatan: sidebar desktop (PanelIdentitas aksi) dan header mobile.
  assert.match(srcShell, /aksi=\{<TombolNotifikasi jumlah=\{jumlahNotifikasiBelum\}/);
  assert.doesNotMatch(srcShell.toLowerCase(), /popover|dropdown|popup/);
});

// ---------- Kontrak server action ----------

const srcAction = baca("lib/actions/notifikasi.ts");

test("action notifikasi: user dari session, bukan dari client", () => {
  assert.ok(srcAction.trimStart().startsWith('"use server"'), "harus directive use server");
  assert.match(srcAction, /export async function tandaiSatuNotifikasiDibaca\(notifikasiId: string\)/);
  assert.match(srcAction, /export async function tandaiSemuaNotifikasiSaya\(\)/);
  assert.match(srcAction, /wajibLogin\(\)/);
  assert.match(srcAction, /tandaiNotifikasiDibaca\(user\.id, notifikasiId\)/);
  assert.match(srcAction, /tandaiSemuaNotifikasiDibaca\(user\.id\)/);
  // penerimaUserId/userId tidak pernah jadi parameter client.
  assert.doesNotMatch(srcAction, /(userId|penerimaUserId)\s*[:?]/);
});

const srcTandaiSemua = baca("components/administrasi/tombol-tandai-semua.tsx");

test("tombol tandai semua: hanya saat unread>0, live region stabil saat refresh", () => {
  assert.match(srcTandaiSemua, /if \(jumlah <= 0\)/);
  // Tombol tidak dirender saat nol; live region aria-live tetap ada di kedua cabang.
  const hitungLive = srcTandaiSemua.match(/aria-live="polite"/g) ?? [];
  assert.ok(hitungLive.length >= 1, "harus punya live region");
  assert.match(srcTandaiSemua, /role="status"/);
  assert.match(srcTandaiSemua, /disabled=\{pending\}/);
  assert.match(srcTandaiSemua, /router\.refresh\(\)/);
  assert.match(srcTandaiSemua, /tandaiSemuaNotifikasiSaya/);
});

// ---------- Kontrak route pembuka ----------

const srcBuka = baca("app/(administrasi)/administrasi/notifikasi/[id]/buka/page.tsx");

test("route buka: milik session saja, tandai dibaca, redirect tervalidasi", () => {
  assert.match(srcBuka, /penerimaUserId: user\.id/);
  assert.match(srcBuka, /tautanAmanNotifikasi\(tautanNotifikasi\(baris\)\)/);
  assert.match(srcBuka, /tandaiNotifikasiDibaca\(user\.id, id\)/);
  assert.match(srcBuka, /redirect\("\/administrasi\/notifikasi"\)/);
  // Tandai dibaca hanya jika belum dibaca.
  assert.match(srcBuka, /if \(!baris\.dibacaPada\)/);
});

// ---------- Kontrak halaman pusat notifikasi ----------

const srcHalaman = baca("app/(administrasi)/administrasi/notifikasi/page.tsx");

test("halaman: komponen DS wajib, filter server-side, batas 50", () => {
  for (const komponen of ["PageHeader", "FilterTabs", "EmptyState", "<Alert", "Card"]) {
    assert.ok(srcHalaman.includes(komponen), `halaman harus memakai ${komponen}`);
  }
  assert.match(srcHalaman, /opsiFilterNotifikasi\(searchParams\?\.f\)/);
  assert.match(srcHalaman, /batas: BATAS_DAFTAR/);
  assert.match(srcHalaman, /BATAS_DAFTAR = 50/);
  // Label status tekstual pada setiap item.
  assert.match(srcHalaman, /labelStatusDibaca\(n\.dibacaPada\)/);
});

test("halaman: tidak ada metadata sensitif dirender", () => {
  assert.doesNotMatch(srcHalaman, /eventKey|penerimaUserId|dokumenId|storageKey|sha256/);
});

// ---------- Navigasi ----------

test("nav: Notifikasi untuk semua role, bottom nav utama tidak berubah", () => {
  for (const role of SEMUA_ROLE) {
    const hrefs = getAdministrasiNav(role).flatMap((g) => g.items.map((i) => i.href));
    assert.ok(hrefs.includes("/administrasi/notifikasi"), `${role} harus melihat menu Notifikasi`);
    const bottom = getAdministrasiBottomNav(role).map((i) => i.href);
    if (role === "KEPALA" || role === "ADMIN" || role === "SUPERADMIN") {
      // KEPALA/ADMIN/SUPERADMIN: bottom nav 4 item sesuai prioritas Kamad.
      assert.ok(
        bottom.includes("/administrasi/notifikasi"),
        `bottom nav ${role} memuat Notifikasi (4 item)`
      );
    } else {
      // GURU/WAKA: bottom nav 3 item klasik, tidak memuat Notifikasi.
      assert.ok(
        !bottom.includes("/administrasi/notifikasi"),
        `bottom nav ${role} tidak boleh berubah`
      );
    }
  }
});

test("nav: route notifikasi tidak dianggap detail dokumen", () => {
  assert.equal(isNavAktif("/administrasi/notifikasi", "/administrasi/notifikasi"), true);
  assert.equal(isNavAktif("/administrasi/notifikasi/abc/buka", "/administrasi/notifikasi"), true);
  assert.equal(isNavAktif("/administrasi/notifikasi", "/administrasi/dokumen-saya"), false);
  // Detail dokumen tetap menandai Dokumen Saya.
  assert.equal(isNavAktif("/administrasi/abc123", "/administrasi/dokumen-saya"), true);
});
