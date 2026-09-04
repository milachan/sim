import type { Role, StatusAbsensi, StatusJurnal, StatusPertemuan, JenisKegiatan, StatusKumpul, SumberPertemuan, StatusLaporan, Hari, JenisGuru, PeranPengisiAbsensi } from "@prisma/client";

export const HARI = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"] as const;
export const HARI_LABEL: Record<string, string> = {
  SENIN: "Senin",
  SELASA: "Selasa",
  RABU: "Rabu",
  KAMIS: "Kamis",
  JUMAT: "Jumat",
  SABTU: "Sabtu",
};

/**
 * Struktur jam pelajaran — single source of truth.
 * Format waktu konsisten "HH:mm" (24 jam) — sama dengan kolom JamPelajaran di DB.
 *
 * JAM_PELAJARAN adalah nested map: HARI → jamKe → { mulai, selesai }.
 * - BIASA: Senin–Sabtu (Jumat pakai JUMAT).
 * - JUMAT: hanya 6 jam (1–6) untuk waktu ibadah Jumat.
 * - Durasi 1 jam ≈ 40 menit. Ada jeda istirahat di antara blok.
 *
 * Hari khusus (Jumat) terpisah karena waktu mengajar lebih pendek.
 * Konstanta ini dipakai sebagai:
 *   1. Default di admin/jam-pelajaran saat DB kosong.
 *   2. Fallback server-side bila DB tidak tersedia / rusak.
 * Untuk data terkini dari DB, gunakan helper waktuJamFromDb() dan
 * jamMaksHariFromDb() di lib/jam-utils.ts.
 */
export const JAM_PELAJARAN: Record<Hari, Record<number, { mulai: string; selesai: string }>> = {
  SENIN: {
    1: { mulai: "07:15", selesai: "07:55" },
    2: { mulai: "07:55", selesai: "08:35" },
    3: { mulai: "08:35", selesai: "09:15" },
    4: { mulai: "09:15", selesai: "09:55" },
    5: { mulai: "10:10", selesai: "10:50" },
    6: { mulai: "10:50", selesai: "11:30" },
    7: { mulai: "11:30", selesai: "12:10" },
    8: { mulai: "12:40", selesai: "13:20" },
    9: { mulai: "13:20", selesai: "14:00" },
  },
  SELASA: {
    1: { mulai: "07:15", selesai: "07:55" },
    2: { mulai: "07:55", selesai: "08:35" },
    3: { mulai: "08:35", selesai: "09:15" },
    4: { mulai: "09:15", selesai: "09:55" },
    5: { mulai: "10:10", selesai: "10:50" },
    6: { mulai: "10:50", selesai: "11:30" },
    7: { mulai: "11:30", selesai: "12:10" },
    8: { mulai: "12:40", selesai: "13:20" },
    9: { mulai: "13:20", selesai: "14:00" },
  },
  RABU: {
    1: { mulai: "07:15", selesai: "07:55" },
    2: { mulai: "07:55", selesai: "08:35" },
    3: { mulai: "08:35", selesai: "09:15" },
    4: { mulai: "09:15", selesai: "09:55" },
    5: { mulai: "10:10", selesai: "10:50" },
    6: { mulai: "10:50", selesai: "11:30" },
    7: { mulai: "11:30", selesai: "12:10" },
    8: { mulai: "12:40", selesai: "13:20" },
    9: { mulai: "13:20", selesai: "14:00" },
  },
  KAMIS: {
    1: { mulai: "07:15", selesai: "07:55" },
    2: { mulai: "07:55", selesai: "08:35" },
    3: { mulai: "08:35", selesai: "09:15" },
    4: { mulai: "09:15", selesai: "09:55" },
    5: { mulai: "10:10", selesai: "10:50" },
    6: { mulai: "10:50", selesai: "11:30" },
    7: { mulai: "11:30", selesai: "12:10" },
    8: { mulai: "12:40", selesai: "13:20" },
    9: { mulai: "13:20", selesai: "14:00" },
  },
  JUMAT: {
    1: { mulai: "06:50", selesai: "07:25" },
    2: { mulai: "07:25", selesai: "08:05" },
    3: { mulai: "08:05", selesai: "08:45" },
    4: { mulai: "08:45", selesai: "09:25" },
    5: { mulai: "09:40", selesai: "10:20" },
    6: { mulai: "10:20", selesai: "11:00" },
  },
  SABTU: {
    1: { mulai: "07:15", selesai: "07:55" },
    2: { mulai: "07:55", selesai: "08:35" },
    3: { mulai: "08:35", selesai: "09:15" },
    4: { mulai: "09:15", selesai: "09:55" },
    5: { mulai: "10:10", selesai: "10:50" },
    6: { mulai: "10:50", selesai: "11:30" },
    7: { mulai: "11:30", selesai: "12:10" },
    8: { mulai: "12:40", selesai: "13:20" },
    9: { mulai: "13:20", selesai: "14:00" },
  },
};

/** Daftar urutan jam pelajaran default Senin–Sabtu (1..9). */
export const JAM_MULAI = Object.keys(JAM_PELAJARAN.SENIN).map(Number);

/** Jumlah jam pelajaran default per hari (derived — jangan hardcode ulang). */
export const JAM_MAKS: Record<Hari, number> = Object.fromEntries(
  (Object.keys(JAM_PELAJARAN) as Hari[]).map((h) => [h, Object.keys(JAM_PELAJARAN[h]).length])
) as Record<Hari, number>;

/**
 * Jumlah jam pelajaran maksimal pada suatu hari.
 * Fallback hardcoded — dipakai di server component tanpa akses DB langsung.
 * Untuk validasi form admin dan import, gunakan jamMaksHariFromDb() di lib/jam-utils.ts.
 */
export function jamMaksHari(hari: Hari): number {
  return JAM_MAKS[hari];
}

/**
 * Apakah jadwal jatuh pada jam upacara bendera (Senin jam ke-1).
 * Hari Senin jam pertama biasanya untuk upacara, jadi jam mengajar dimulai
 * sedikit lebih lambat — ditandai agar guru & admin tahu.
 */
export function apakahJamUpacara(hari: Hari, jamKeMulai: number): boolean {
  return hari === "SENIN" && jamKeMulai === 1;
}

/**
 * Jam pelajaran yang membuka hari — acuan "guru jam pertama" absensi harian
 * kelas. Senin dibuka upacara bendera pada jam ke-1, sehingga jam mengajar
 * pertama jatuh di jam ke-2; hari lain dimulai jam ke-1.
 * Kelas yang pada hari itu tidak memiliki jadwal di jam pembuka tidak punya
 * guru jam pertama — pengisiannya menjadi tanggung jawab piket/wali sebagai backup.
 */
export function jamPembukaHari(hari: Hari): number {
  return hari === "SENIN" ? 2 : 1;
}

/**
 * Waktu mulai–selesai sebuah jam pelajaran pada hari tertentu, atau null bila di luar jangkauan.
 * Fallback dari hardcoded JAM_PELAJARAN. Untuk data terkini dari DB, gunakan waktuJamFromDb().
 */
export function waktuJam(hari: Hari, jam: number): { mulai: string; selesai: string } | null {
  return JAM_PELAJARAN[hari]?.[jam] ?? null;
}

/** Rentang waktu "HH:mm–HH:mm" untuk rentang jam ke-mulai sampai ke-selesai, atau null. */
export function rentangJam(hari: Hari, mulai: number, selesai: number): string | null {
  const a = waktuJam(hari, mulai);
  const b = waktuJam(hari, selesai);
  if (!a || !b) return null;
  return `${a.mulai}–${b.selesai}`;
}

/** Konversi "HH:mm" → menit sejak tengah malam (0..1439). */
export function menitDariWaktu(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/** Waktu dinding WIB (UTC+7) dari sebuah instan, dalam menit sejak tengah malam.
 *  Dibaca lewat komponen UTC setelah offset +7 agar tidak bergantung zona waktu server/browser. */
export function menitWib(sekarang: Date): number {
  const wib = new Date(sekarang.getTime() + 7 * 60 * 60 * 1000);
  return wib.getUTCHours() * 60 + wib.getUTCMinutes();
}

/** Jam pelajaran (jamKe) yang sedang berlangsung pada hari & waktu tertentu — atau null bila
 *  di luar jam (belum mulai / jeda istirahat / sudah usai). Basis waktu: JAM_PELAJARAN. */
export function jamKeBerjalan(hari: Hari, sekarang: Date): number | null {
  const tabel = JAM_PELAJARAN[hari];
  if (!tabel) return null;
  const menit = menitWib(sekarang);
  for (const [jamKeStr, w] of Object.entries(tabel)) {
    if (menit >= menitDariWaktu(w.mulai) && menit < menitDariWaktu(w.selesai)) return Number(jamKeStr);
  }
  return null;
}

export const STATUS_ABSENSI_LABEL: Record<StatusAbsensi, string> = {
  HADIR: "Hadir",
  SAKIT: "Sakit",
  IZIN: "Izin",
  ALPA: "Alpa",
  TERLAMBAT: "Terlambat",
  DISPENSASI: "Dispensasi",
};

export const STATUS_ABSENSI_SHORT: Record<StatusAbsensi, string> = {
  HADIR: "H",
  SAKIT: "S",
  IZIN: "I",
  ALPA: "A",
  TERLAMBAT: "T",
  DISPENSASI: "D",
};

export const STATUS_ABSENSI_BADGE: Record<StatusAbsensi, string> = {
  HADIR: "bg-emerald-100 text-emerald-700",
  SAKIT: "bg-amber-100 text-amber-700",
  IZIN: "bg-sky-100 text-sky-700",
  ALPA: "bg-rose-100 text-rose-700",
  TERLAMBAT: "bg-orange-100 text-orange-700",
  DISPENSASI: "bg-violet-100 text-violet-700",
};

export const STATUS_PERTEMUAN_LABEL: Record<StatusPertemuan, string> = {
  BELUM_DIMULAI: "Belum Dimulai",
  ABSENSI_TERISI: "Absensi Terisi",
  JURNAL_TERISI: "Jurnal Terisi",
  LENGKAP: "Lengkap",
  TIDAK_TERLAKSANA: "Tidak Terlaksana",
};

// Status absensi harian kelas per hari — satu sumber data (AbsensiHarian).
// Peran pengisi menentukan status: guru jam pertama (utama), guru piket
// (backup), atau wali kelas (berhak mengubah kelas yang diwalikannya).
export type StatusAbsensiHarian = PeranPengisiAbsensi | "BELUM_DIISI";

export const STATUS_ABSENSI_HARIAN_LABEL: Record<StatusAbsensiHarian, string> = {
  BELUM_DIISI: "Belum Diisi",
  GURU_JAM_PERTAMA: "Sudah Diisi Guru Jam 1",
  GURU_PIKET: "Diisi Guru Piket",
  WALI_KELAS: "Diisi Wali Kelas",
};

export const STATUS_ABSENSI_HARIAN_BADGE: Record<StatusAbsensiHarian, string> = {
  BELUM_DIISI: "bg-slate-100 text-slate-600",
  GURU_JAM_PERTAMA: "bg-emerald-100 text-emerald-700",
  GURU_PIKET: "bg-amber-100 text-amber-700",
  WALI_KELAS: "bg-violet-100 text-violet-700",
};

export const STATUS_PERTEMUAN_BADGE: Record<StatusPertemuan, string> = {
  BELUM_DIMULAI: "bg-slate-100 text-slate-600",
  ABSENSI_TERISI: "bg-yellow-100 text-yellow-700",
  JURNAL_TERISI: "bg-sky-100 text-sky-700",
  LENGKAP: "bg-emerald-100 text-emerald-700",
  TIDAK_TERLAKSANA: "bg-slate-200 text-slate-500 line-through",
};

export const STATUS_JURNAL_LABEL: Record<StatusJurnal, string> = {
  DRAFT: "Konsep",
  TERKIRIM: "Terkirim",
};

export const SUMBER_PERTEMUAN_LABEL: Record<SumberPertemuan, string> = {
  OTOMATIS: "Otomatis",
  MANUAL: "Manual",
};

export const JENIS_KEGIATAN_LABEL: Record<JenisKegiatan, string> = {
  TUGAS: "Tugas",
  KUIS: "Kuis",
  ULANGAN_HARIAN: "Ulangan Harian",
  PRAKTIK: "Praktik",
  PROYEK: "Proyek",
  PRESENTASI: "Presentasi",
  PORTOFOLIO: "Portofolio",
  PTS: "PTS",
  PAS: "PAS/SAS",
  REMEDIAL: "Remedial",
  PENGAYAAN: "Pengayaan",
};

export const JENIS_KEGIATAN_WARNA: Record<JenisKegiatan, string> = {
  TUGAS: "bg-indigo-100 text-indigo-700",
  KUIS: "bg-teal-100 text-teal-700",
  ULANGAN_HARIAN: "bg-rose-100 text-rose-700",
  PRAKTIK: "bg-orange-100 text-orange-700",
  PROYEK: "bg-fuchsia-100 text-fuchsia-700",
  PRESENTASI: "bg-cyan-100 text-cyan-700",
  PORTOFOLIO: "bg-lime-100 text-lime-700",
  PTS: "bg-violet-100 text-violet-700",
  PAS: "bg-blue-100 text-blue-700",
  REMEDIAL: "bg-red-100 text-red-700",
  PENGAYAAN: "bg-emerald-100 text-emerald-700",
};

export const STATUS_KUMPUL_LABEL: Record<StatusKumpul, string> = {
  DIKUMPULKAN: "Dikumpulkan",
  BELUM: "Belum Kumpul",
  TERLAMBAT: "Terlambat",
};

export const STATUS_KUMPUL_BADGE: Record<StatusKumpul, string> = {
  DIKUMPULKAN: "bg-emerald-100 text-emerald-700",
  BELUM: "bg-slate-100 text-slate-600",
  TERLAMBAT: "bg-orange-100 text-orange-700",
};

export const ROLE_LABEL: Record<Role, string> = {
  GURU: "Guru",
  WAKA: "Waka Kurikulum",
  ADMIN: "Admin Akademik",
  SUPERADMIN: "Super Admin",
  KEPALA: "Kepala Madrasah",
};

export const ROLE_BADGE: Record<Role, string> = {
  GURU: "bg-sky-100 text-sky-700",
  WAKA: "bg-violet-100 text-violet-700",
  ADMIN: "bg-indigo-100 text-indigo-700",
  SUPERADMIN: "bg-rose-100 text-rose-700",
  KEPALA: "bg-emerald-100 text-emerald-700",
};

export const STATUS_SISWA_LABEL = {
  AKTIF: "Aktif",
  ALUMNI: "Alumni",
  KELUAR: "Keluar",
} as const;

export const MAPEL_KODE: Record<string, string> = {
  "Al-Qur'an Hadits": "AQH",
  "Akidah Akhlaq": "AKA",
  Fiqih: "FIQ",
  SKI: "SKI",
  "Bahasa Arab": "BAR",
  "Bahasa Indonesia": "BIN",
  Matematika: "MTK",
  "Bahasa Inggris": "BIG",
  IPA: "IPA",
  IPS: "IPS",
  "Pendidikan Pancasila": "PP",
  "Bahasa Jawa": "BJW",
  PJOK: "PJOK",
  Informatika: "INF",
  "Seni Budaya": "SBK",
  Prakarya: "PKR",
  Tahfidz: "TAH",
  "Bimbingan Konseling": "BK",
  BK: "BK",
};

/** Nama kanonik mata pelajaran Bimbingan Konseling. Dipakai sebagai referensi
 *  single source untuk filter & query jadwal BK (bukan hardcoded string). */
export const MAPEL_BK_NAMA = "Bimbingan Konseling";

// Jenis guru: label & warna badge untuk Data Guru & menu.
export const JENIS_GURU_LABEL: Record<JenisGuru, string> = {
  BIASA: "Guru Biasa",
  PIKET: "Guru Piket",
  WALI_KELAS: "Guru Wali Kelas",
  BK: "Guru BK",
};

export const JENIS_GURU_BADGE: Record<JenisGuru, string> = {
  BIASA: "bg-slate-100 text-slate-600",
  PIKET: "bg-amber-100 text-amber-700",
  WALI_KELAS: "bg-violet-100 text-violet-700",
  BK: "bg-sky-100 text-sky-700",
};

/**
 * Normalisasi teks untuk pencocokan nama (huruf kecil, tanpa spasi/tanda baca).
 * Dipakai saat import: nama di file bisa beda tipis dengan yang di database.
 */
export function normText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Ambil kode guru dari nama berformat "Nama, Gelar (K5)" → "K5".
 * Kode adalah huruf diikuti angka di dalam kurung di akhir nama.
 */
export function kodeDariNamaGuru(nama: string): string | null {
  const m = nama.trim().match(/\(([A-Za-z]\d{1,3})\)\s*$/);
  return m ? m[1].toUpperCase() : null;
}

/** Nama guru tanpa kode di belakang, mis. "Akhmadi, S.Pd. (K5)" → "Akhmadi, S.Pd.". */
export function namaTanpaKodeGuru(nama: string): string {
  return nama.trim().replace(/\([A-Za-z]\d{1,3}\)\s*$/, "").replace(/\s+$/, "").trim();
}

/**
 * Tingkat kelas dari nama kelas: "IX A" → 9, "VIII G" → 8, "7A" → 7.
 * Mengembalikan null bila tidak bisa dikenali.
 */
export function tingkatDariNamaKelas(nama: string): number | null {
  const t = nama.trim().toUpperCase();
  // Regex tegas: cocokkan awalan Romawi yang berdiri sendiri, bukan prefix parsial.
  // Urutan terpanjang dahulu (XII/XI sebelum X) agar "XII" tidak tertangkap sebagai "X".
  const m = t.match(/^(XII|XI|X|IX|VIII|VII)\b/);
  if (m) {
    const romawi: Record<string, number> = { VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 };
    return romawi[m[1]];
  }
  const angka = t.match(/^(\d{1,2})/);
  return angka ? Number(angka[1]) : null;
}

/**
 * Alias nama mapel dari file jadwal → nama kanonik di database.
 * Mis. file menulis "Akidah Ahlak" sementara DB memakai "Akidah Akhlaq".
 */
export const MAPEL_ALIAS: Record<string, string> = {
  "akidah ahlak": "Akidah Akhlaq",
  "akidah akhlak": "Akidah Akhlaq",
  fikih: "Fiqih",
  fiqih: "Fiqih",
  "qur'an hadist": "Al-Qur'an Hadits",
  "qur'an hadits": "Al-Qur'an Hadits",
  "al-qur'an hadist": "Al-Qur'an Hadits",
  "al-qur'an hadits": "Al-Qur'an Hadits",
};

/** Nama mapel kanonik dari nama di file (lewat alias), atau nama asli bila tidak ada alias. */
export function mapelKanonik(nama: string): string {
  return MAPEL_ALIAS[nama.trim().toLowerCase()] ?? nama.trim();
}

export const JENIS_KEGIATAN_LIST = Object.keys(JENIS_KEGIATAN_LABEL) as JenisKegiatan[];

export const STATUS_LAPORAN_LABEL: Record<StatusLaporan, string> = {
  DRAFT: "Konsep",
  DIPERIKSA: "Sudah Diperiksa",
  DISETUJUI: "Disetujui",
};

export const STATUS_LAPORAN_BADGE: Record<StatusLaporan, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  DIPERIKSA: "bg-amber-100 text-amber-700",
  DISETUJUI: "bg-emerald-100 text-emerald-700",
};

export const STATUS_LAPORAN_URUTAN: StatusLaporan[] = ["DRAFT", "DIPERIKSA", "DISETUJUI"];
