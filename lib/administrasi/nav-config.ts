import { Archive, Bell, FilePlus2, FileText, Inbox, LayoutDashboard, LayoutTemplate } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Role } from "@prisma/client";

// Konfigurasi navigasi Rumah Administrasi — MURNI, tanpa efek samping.
// Pemeriksaan (kotak masuk) hanya untuk KEPALA/ADMIN/SUPERADMIN, selaras
// dengan adalahPemeriksaDokumen() di lib/otorisasi.ts. Akun PIKET diblokir
// di layout (redirect), sehingga konfigurasi ini tidak punya kasus PIKET.

export type ItemNav = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type KelompokNav = {
  label: string;
  items: ItemNav[];
};

export function adalahPemeriksaAdministrasi(role: Role): boolean {
  return role === "KEPALA" || role === "ADMIN" || role === "SUPERADMIN";
}

const NAV_DASHBOARD: ItemNav = { label: "Dashboard", href: "/administrasi", icon: LayoutDashboard };
const NAV_DOKUMEN_SAYA: ItemNav = { label: "Dokumen Saya", href: "/administrasi/dokumen-saya", icon: FileText };
const NAV_AJUKAN: ItemNav = { label: "Ajukan Dokumen", href: "/administrasi/baru", icon: FilePlus2 };
const NAV_NOTIFIKASI: ItemNav = { label: "Notifikasi", href: "/administrasi/notifikasi", icon: Bell };
const NAV_KOTAK_MASUK: ItemNav = { label: "Kotak Masuk", href: "/administrasi/kotak-masuk", icon: Inbox };
const NAV_ARSIP: ItemNav = { label: "Arsip", href: "/administrasi/arsip", icon: Archive };
const NAV_TEMPLATE: ItemNav = { label: "Template Dokumen", href: "/administrasi/template", icon: LayoutTemplate };

/**
 * Susunan sidebar KEPALA/ADMIN/SUPERADMIN: pekerjaan pemeriksaan diprioritaskan.
 * Dokumen pribadi TIDAK ditampilkan — KEPALA/ADMIN/SUPERADMIN bukan pengaju,
 * melainkan pemeriksa dan finalisator (lihat bolehMengajukanDokumen).
 *
 *   RINGKASAN         → Dashboard, Notifikasi
 *   PEMERIKSAAN       → Kotak Masuk
 *   ARSIP & REFERENSI → Arsip, Template Dokumen
 */
function navSidebarPemeriksa(): KelompokNav[] {
  return [
    { label: "Ringkasan", items: [NAV_DASHBOARD, NAV_NOTIFIKASI] },
    { label: "Pemeriksaan", items: [NAV_KOTAK_MASUK] },
    { label: "Arsip & Referensi", items: [NAV_ARSIP, NAV_TEMPLATE] },
  ];
}

/**
 * Susunan sidebar GURU/WAKA: tidak ada kelompok Pemeriksaan.
 * Dokumen Saya dan Ajukan Dokumen tetap di urutan teratas (pengalaman guru lama).
 */
function navSidebarPengaju(): KelompokNav[] {
  return [
    { label: "Ruang Kerja", items: [NAV_DASHBOARD, NAV_DOKUMEN_SAYA, NAV_AJUKAN, NAV_NOTIFIKASI] },
    { label: "Arsip & Referensi", items: [NAV_ARSIP, NAV_TEMPLATE] },
  ];
}

export function getAdministrasiNav(role: Role): KelompokNav[] {
  if (adalahPemeriksaAdministrasi(role)) return navSidebarPemeriksa();
  return navSidebarPengaju();
}

export type ItemBottomNav = ItemNav;

/**
 * Bottom navigation mobile — dibatasi 4 item karena ruang layar sempit.
 * - GURU/WAKA: 3 item (Dashboard, Dokumen, Ajukan) — pengalaman lama.
 * - Pemeriksa: 4 item (Dashboard, Kotak Masuk, Arsip, Notifikasi) sesuai
 *   prioritas KEPALA. Item "Dokumen Saya" & "Ajukan Dokumen" tetap
 *   tersedia di drawer (sidebar lengkap).
 */
export function getAdministrasiBottomNav(role: Role): ItemBottomNav[] {
  if (adalahPemeriksaAdministrasi(role)) {
    return [NAV_DASHBOARD, NAV_KOTAK_MASUK, NAV_ARSIP, NAV_NOTIFIKASI];
  }
  return [
    { label: "Dashboard", href: NAV_DASHBOARD.href, icon: NAV_DASHBOARD.icon },
    { label: "Dokumen", href: NAV_DOKUMEN_SAYA.href, icon: NAV_DOKUMEN_SAYA.icon },
    { label: "Ajukan", href: NAV_AJUKAN.href, icon: NAV_AJUKAN.icon },
  ];
}

// Segmen pertama setelah /administrasi/ yang merupakan route khusus —
// selain itu dianggap detail dokumen (/administrasi/<id>).
const ROUTE_KHUSUS = new Set(["baru", "dokumen-saya", "arsip", "template", "kotak-masuk", "notifikasi"]);

/**
 * Apakah sebuah pathname mengaktifkan item navigasi ber-label href.
 * - Dashboard hanya aktif di /administrasi persis.
 * - Detail dokumen (/administrasi/<id>) menandai "Dokumen Saya".
 * - Sub-route kotak masuk (/administrasi/kotak-masuk/<id>) tetap menandai
 *   "Kotak Masuk".
 */
export function isNavAktif(pathname: string | null | undefined, href: string): boolean {
  const p = (pathname ?? "").replace(/\/+$/, "");
  if (!p || !p.startsWith("/administrasi")) return false;

  if (href === "/administrasi") return p === "/administrasi";

  if (href === "/administrasi/dokumen-saya") {
    if (p === href) return true;
    const cocokDetail = p.match(/^\/administrasi\/([^/]+)$/);
    return !!cocokDetail && !ROUTE_KHUSUS.has(cocokDetail[1]);
  }

  return p === href || p.startsWith(href + "/");
}
