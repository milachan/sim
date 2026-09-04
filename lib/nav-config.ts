import {
  BookOpen,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  Clock,
  FileBarChart,
  FileSpreadsheet,
  GraduationCap,
  History,
  Home,
  LayoutDashboard,
  NotebookPen,
  Radar,
  School,
  Settings,
  ShieldCheck,
  User,
  UserCheck,
  Users,
} from "lucide-react";
import type { JenisGuru, Role } from "@prisma/client";

export type BottomNavItem = { href: string; label: string; shortLabel: string; icon: typeof Home; ariaLabel: string };
export type SidebarItem = { href: string; label: string; icon: typeof Home };
export type SidebarGroup = { label: string; items: SidebarItem[] };

export const BOTTOM_NAV_GURU: BottomNavItem[] = [
  { href: "/", label: "Hari Ini", shortLabel: "Hari Ini", icon: Home, ariaLabel: "Hari Ini" },
  { href: "/jadwal", label: "Jadwal", shortLabel: "Jadwal", icon: CalendarDays, ariaLabel: "Jadwal Saya" },
  { href: "/jurnal", label: "Jurnal", shortLabel: "Jurnal", icon: BookOpen, ariaLabel: "Riwayat Jurnal" },
  { href: "/absensi-harian", label: "Absen Harian", shortLabel: "Absen Harian", icon: ClipboardCheck, ariaLabel: "Absensi Harian" },
  { href: "/nilai", label: "Nilai", shortLabel: "Nilai", icon: GraduationCap, ariaLabel: "Nilai" },
];

export const BOTTOM_NAV_KEPALA: BottomNavItem[] = [
  { href: "/kamad", label: "Ringkasan", shortLabel: "Ringkasan", icon: LayoutDashboard, ariaLabel: "Ringkasan Kepala Madrasah" },
  { href: "/pemantauan-absensi", label: "Absensi", shortLabel: "Absensi", icon: ClipboardCheck, ariaLabel: "Pemantauan Absensi" },
  { href: "/laporan", label: "Laporan", shortLabel: "Laporan", icon: FileBarChart, ariaLabel: "Laporan" },
  { href: "/laporan-bulanan", label: "Persetujuan", shortLabel: "Persetujuan", icon: CalendarRange, ariaLabel: "Persetujuan Laporan Bulanan" },
];

// WAKA terhubung (punya guruId): dashboard Waka + inti pengajaran + verifikasi.
// Maksimal 5 item — fitur lain tetap bisa diakses lewat menu samping/drawer.
export const BOTTOM_NAV_WAKA_TERHUBUNG: BottomNavItem[] = [
  { href: "/waka", label: "Beranda", shortLabel: "Beranda", icon: Radar, ariaLabel: "Beranda Waka" },
  { href: "/jadwal", label: "Jadwal", shortLabel: "Jadwal", icon: CalendarDays, ariaLabel: "Jadwal Saya" },
  { href: "/jurnal", label: "Jurnal", shortLabel: "Jurnal", icon: BookOpen, ariaLabel: "Jurnal Saya" },
  { href: "/absensi-harian", label: "Absen Harian", shortLabel: "Absen", icon: ClipboardCheck, ariaLabel: "Absensi Harian" },
  { href: "/laporan-bulanan", label: "Verifikasi", shortLabel: "Verifikasi", icon: CalendarRange, ariaLabel: "Verifikasi Laporan Bulanan" },
];

// WAKA tanpa guruId: hanya pemantauan.
export const BOTTOM_NAV_WAKA: BottomNavItem[] = [
  { href: "/waka", label: "Beranda", shortLabel: "Beranda", icon: Radar, ariaLabel: "Beranda Waka" },
  { href: "/pemantauan-absensi", label: "Absensi", shortLabel: "Absensi", icon: ClipboardCheck, ariaLabel: "Pemantauan Absensi" },
  { href: "/jurnal", label: "Jurnal", shortLabel: "Jurnal", icon: BookOpen, ariaLabel: "Kelengkapan Jurnal" },
  { href: "/laporan-bulanan", label: "Verifikasi", shortLabel: "Verifikasi", icon: CalendarRange, ariaLabel: "Verifikasi Laporan Bulanan" },
];

export const BOTTOM_NAV_PIKET: BottomNavItem[] = [
  { href: "/absensi-harian", label: "Absensi", shortLabel: "Absensi", icon: ClipboardCheck, ariaLabel: "Absensi Harian" },
  { href: "/kelola-absensi", label: "Rekap", shortLabel: "Rekap", icon: FileBarChart, ariaLabel: "Kelola Absensi" },
  { href: "/piket/penanggung-jawab", label: "Penanggung Jawab", shortLabel: "Pengisi", icon: UserCheck, ariaLabel: "Pengisi & Wali Kelas" },
  { href: "/profil", label: "Profil", shortLabel: "Profil", icon: User, ariaLabel: "Profil" },
];

export const BOTTOM_NAV_BK: BottomNavItem[] = [
  { href: "/bk", label: "Pantauan BK", shortLabel: "BK", icon: Users, ariaLabel: "Pantauan BK" },
  { href: "/profil", label: "Profil", shortLabel: "Profil", icon: User, ariaLabel: "Profil" },
];

export function getBottomNavConfig(
  role: Role,
  jenisGuru: JenisGuru,
  isAkunPiket: boolean,
  guruId?: string | null
): BottomNavItem[] | null {
  if (isAkunPiket) return BOTTOM_NAV_PIKET;
  if (role === "GURU" && jenisGuru === "BK") return BOTTOM_NAV_BK;
  if (role === "GURU") return BOTTOM_NAV_GURU;
  if (role === "WAKA") return guruId ? BOTTOM_NAV_WAKA_TERHUBUNG : BOTTOM_NAV_WAKA;
  if (role === "KEPALA") return BOTTOM_NAV_KEPALA;
  return null;
}

// ── Sidebar desktop ──

const GRUP_ADMIN_DATA_MASTER: SidebarGroup = {
  label: "Data Master",
  items: [
    { href: "/admin", label: "Dashboard Admin", icon: LayoutDashboard },
    { href: "/admin/guru", label: "Data Guru", icon: Users },
    { href: "/admin/siswa", label: "Data Siswa", icon: User },
    { href: "/admin/kelas", label: "Kelas & Rombel", icon: School },
    { href: "/admin/mapel", label: "Mata Pelajaran", icon: NotebookPen },
    { href: "/admin/jadwal", label: "Jadwal Pelajaran", icon: CalendarDays },
    { href: "/admin/tahun-ajaran", label: "Tahun Ajaran", icon: GraduationCap },
    { href: "/admin/jam-pelajaran", label: "Jam Pelajaran", icon: Clock },
    { href: "/admin/kalender", label: "Kalender Akademik", icon: CalendarDays },
    { href: "/admin/import", label: "Import Excel", icon: FileSpreadsheet },
  ],
};

const GRUP_ADMIN_OPERASIONAL: SidebarGroup = {
  label: "Operasional",
  items: [
    { href: "/absensi-harian", label: "Absensi Harian", icon: ClipboardCheck },
    { href: "/laporan", label: "Laporan", icon: FileBarChart },
    { href: "/laporan-bulanan", label: "Laporan Bulanan", icon: CalendarRange },
  ],
};

const GRUP_ADMIN_SISTEM: SidebarGroup = {
  label: "Sistem",
  items: [
    { href: "/admin/users", label: "Hak Akses", icon: ShieldCheck },
    { href: "/admin/riwayat", label: "Riwayat Perubahan", icon: History },
    { href: "/admin/pengaturan", label: "Pengaturan Sistem", icon: Settings },
    { href: "/profil", label: "Profil", icon: User },
  ],
};

const GRUP_WAKA_PEMANTAUAN: SidebarGroup = {
  label: "Pemantauan Waka",
  items: [
    { href: "/waka", label: "Beranda Pemantauan", icon: Radar },
    { href: "/pemantauan-absensi", label: "Pemantauan Absensi", icon: ClipboardCheck },
    { href: "/laporan", label: "Laporan", icon: FileBarChart },
    { href: "/laporan-bulanan", label: "Laporan Bulanan", icon: CalendarRange },
    { href: "/profil", label: "Profil", icon: User },
  ],
};

/**
 * Susunan sidebar desktop per role (MURNI — mudah dites tanpa render React).
 * Jaminan penting: tidak ada dua item dengan href sama dalam satu konfigurasi.
 */
export function getSidebarNav(
  role: Role,
  opts?: { jenisGuru?: JenisGuru; isAkunPiket?: boolean; guruId?: string | null }
): SidebarGroup[] {
  // Akun khusus piket (kode PIKET): menu ringkas untuk mengisi absensi harian.
  if (opts?.isAkunPiket) {
    return [
      {
        label: "Petugas Piket",
        items: [
          { href: "/absensi-harian", label: "Absensi Harian", icon: ClipboardCheck },
          { href: "/kelola-absensi", label: "Kelola Absensi", icon: FileBarChart },
          { href: "/piket/penanggung-jawab", label: "Pengisi & Wali Kelas", icon: UserCheck },
          { href: "/profil", label: "Profil", icon: User },
        ],
      },
    ];
  }

  if (role === "WAKA") {
    // WAKA terhubung (punya guruId aktif): fitur pengajaran miliknya sendiri +
    // kelompok pemantauan. WAKA tanpa guruId: hanya pemantauan.
    if (opts?.guruId) {
      const pengajaran: SidebarGroup = {
        label: "Pengajaran Saya",
        items: [
          { href: "/jadwal", label: "Jadwal Saya", icon: CalendarDays },
          { href: "/jurnal", label: "Jurnal Saya", icon: BookOpen },
          { href: "/absensi", label: "Absensi Pribadi", icon: ClipboardCheck },
          { href: "/absensi-harian", label: "Absensi Harian", icon: ClipboardCheck },
          { href: "/nilai", label: "Penilaian", icon: GraduationCap },
        ],
      };
      return [pengajaran, GRUP_WAKA_PEMANTAUAN];
    }
    return [GRUP_WAKA_PEMANTAUAN];
  }

  if (role === "GURU") {
    const grup: SidebarGroup = {
      label: "Menu Guru",
      items: [
        { href: "/", label: "Hari Ini", icon: Home },
        { href: "/ringkasan", label: "Ringkasan", icon: LayoutDashboard },
        { href: "/jadwal", label: "Jadwal Saya", icon: CalendarDays },
        { href: "/jurnal", label: "Riwayat Jurnal", icon: BookOpen },
        { href: "/absensi-harian", label: "Absensi Harian", icon: ClipboardCheck },
        { href: "/absensi", label: "Catatan Kehadiran Pribadi", icon: ClipboardCheck },
        { href: "/nilai", label: "Nilai", icon: GraduationCap },
        { href: "/laporan", label: "Laporan", icon: FileBarChart },
        { href: "/profil", label: "Profil", icon: User },
      ],
    };
    if (opts?.jenisGuru === "BK") {
      grup.items.splice(grup.items.length - 1, 0, { href: "/bk", label: "Bimbingan Konseling", icon: Users });
    }
    return [grup];
  }

  if (role === "KEPALA") {
    return [
      {
        label: "Kepala Madrasah",
        items: [
          { href: "/kamad", label: "Ringkasan", icon: LayoutDashboard },
          { href: "/pemantauan-absensi", label: "Absensi Harian", icon: ClipboardCheck },
          { href: "/jadwal", label: "Jadwal Pelajaran", icon: CalendarDays },
          { href: "/laporan", label: "Laporan", icon: FileBarChart },
          { href: "/laporan-bulanan", label: "Persetujuan Laporan", icon: CalendarRange },
          { href: "/profil", label: "Profil", icon: User },
        ],
      },
    ];
  }

  // ADMIN & SUPERADMIN
  return [GRUP_ADMIN_DATA_MASTER, GRUP_ADMIN_OPERASIONAL, GRUP_ADMIN_SISTEM];
}
