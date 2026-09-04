import { BookOpen, FileBarChart, FileSpreadsheet } from "lucide-react";
import type { Role } from "@prisma/client";

// Fondasi konfigurasi workspace ("rumah") — MURNI, tanpa efek samping.
// Satu akun dapat memiliki beberapa rumah: Jurnal (default), Administrasi,
// dan Analisis Nilai. Modul ini TIDAK menyentuh login, redirect, AppShell,
// maupun route jurnal yang sudah ada.

export type WorkspaceId = "JURNAL" | "ADMINISTRASI" | "ANALISIS_NILAI";

export type Workspace = {
  id: WorkspaceId;
  label: string;
  deskripsi: string;
  href: string;
  icon: typeof BookOpen;
  tema: WorkspaceId;
  warnaAksen: string;
};

const DEFINISI_WORKSPACE: Record<WorkspaceId, Omit<Workspace, "href">> = {
  JURNAL: {
    id: "JURNAL",
    label: "Jurnal",
    deskripsi: "Jurnal mengajar, jadwal, absensi harian, dan laporan pembelajaran.",
    icon: BookOpen,
    tema: "JURNAL",
    warnaAksen: "#2563EB",
  },
  ADMINISTRASI: {
    id: "ADMINISTRASI",
    label: "Administrasi",
    deskripsi: "Surat menyurat, dokumen administrasi, dan kearsipan madrasah.",
    icon: FileSpreadsheet,
    tema: "ADMINISTRASI",
    warnaAksen: "#D97706",
  },
  ANALISIS_NILAI: {
    id: "ANALISIS_NILAI",
    label: "Analisis Nilai",
    deskripsi: "Analisis dan visualisasi capaian nilai siswa.",
    icon: FileBarChart,
    tema: "ANALISIS_NILAI",
    warnaAksen: "#7C3AED",
  },
};

/**
 * Alamat rumah jurnal sesuai role — konsisten dengan redirect login saat ini:
 * GURU -> /, WAKA -> /waka, KEPALA -> /kamad, ADMIN & SUPERADMIN -> /admin.
 * Akun PIKET khusus absensi harian.
 */
export function alamatRumahJurnal(role: Role, isAkunPiket?: boolean): string {
  if (isAkunPiket) return "/absensi-harian";
  if (role === "WAKA") return "/waka";
  if (role === "KEPALA") return "/kamad";
  if (role === "ADMIN" || role === "SUPERADMIN") return "/admin";
  return "/";
}

/**
 * Menentukan workspace aktif dari pathname (fungsi murni).
 * Route yang bukan milik rumah lain dianggap milik rumah Jurnal —
 * karena seluruh route jurnal existing tidak boleh berubah.
 */
export function tentukanWorkspaceAktif(
  pathname: string | null | undefined,
  workspaces: Workspace[]
): WorkspaceId {
  if (!pathname) return "JURNAL";
  for (const w of workspaces) {
    if (w.id === "JURNAL") continue;
    if (pathname === w.href || pathname.startsWith(w.href + "/")) return w.id;
  }
  return "JURNAL";
}

/**
 * Daftar rumah yang dapat diakses sebuah akun (fungsi murni).
 * - Jurnal selalu ada dan menjadi entri pertama (rumah default guru).
 * - Akun PIKET hanya mendapatkan rumah jurnal/absensi.
 * - Role lain mendapat ketiga rumah; guard halaman menyusul di tahap route.
 */
export function getWorkspaces(input: { role: Role; isAkunPiket?: boolean }): Workspace[] {
  const jurnal: Workspace = {
    ...DEFINISI_WORKSPACE.JURNAL,
    href: alamatRumahJurnal(input.role, input.isAkunPiket),
  };

  if (input.isAkunPiket) return [jurnal];

  return [
    jurnal,
    { ...DEFINISI_WORKSPACE.ADMINISTRASI, href: "/administrasi" },
    { ...DEFINISI_WORKSPACE.ANALISIS_NILAI, href: "/analisis-nilai" },
  ];
}
