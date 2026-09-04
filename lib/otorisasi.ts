export type InfoUser = {
  id: string;
  role: string;
  guruId: string | null;
  /**
   * Data guru (bentuk nyata dari getCurrentUser). Wajib tersedia ketika
   * helper dipakai untuk keputusan terkait akun PIKET; bila tidak ada,
   * dianggap bukan PIKET (konservatif-aman).
   */
  guru?: { jenisGuru?: string | null; kode?: string | null } | null;
};

export type InfoPertemuan = {
  jadwalGuruId?: string | null;
  dibuatOlehId?: string | null;
};

export function adalahAdmin(role: string | undefined): boolean {
  return role === "ADMIN" || role === "SUPERADMIN";
}

export function adalahPemantau(role: string | undefined): boolean {
  return role === "WAKA" || role === "KEPALA";
}

/** Pengajar operasional = GURU atau WAKA dengan guruId valid (bisa kelola data miliknya). */
export function adalahPengajar(user: InfoUser | null | undefined): boolean {
  return !!user && !!user.guruId && (user.role === "GURU" || user.role === "WAKA");
}

/**
 * GURU/WAKA hanya boleh mengelola pertemuan dari jadwal yang guruId-nya sama dengan
 * user.guruId ATAU pertemuan manual yang dibuatOlehId-nya sama dengan user.id.
 * Tanpa guruId selalu ditolak. ADMIN/SUPERADMIN boleh mengelola semua.
 */
export function bolehKelolaPertemuan(
  user: InfoUser | null | undefined,
  p: InfoPertemuan
): boolean {
  if (!user) return false;
  if (adalahAdmin(user.role)) return true;
  if (!adalahPengajar(user)) return false;
  if (p.jadwalGuruId) return p.jadwalGuruId === user.guruId;
  return !!p.dibuatOlehId && p.dibuatOlehId === user.id;
}

/** Membaca detail pertemuan: ADMIN bebas, WAKA/KEPALA read-only, pengajar hanya miliknya. */
export function bolehBacaPertemuan(
  user: InfoUser | null | undefined,
  p: InfoPertemuan
): boolean {
  if (!user) return false;
  if (adalahAdmin(user.role) || adalahPemantau(user.role)) return true;
  return bolehKelolaPertemuan(user, p);
}

/** Kelola jadwal: ADMIN bebas, pengajar (GURU/WAKA) hanya jadwal miliknya (guruId wajib ada). */
export function bolehKelolaJadwal(
  user: InfoUser | null | undefined,
  guruId: string | null | undefined
): boolean {
  if (!user) return false;
  if (adalahAdmin(user.role)) return true;
  if (!adalahPengajar(user)) return false;
  return guruId === user.guruId;
}

/** Membaca detail jadwal: ADMIN bebas, WAKA/KEPALA read-only, pengajar hanya miliknya. */
export function bolehBacaJadwal(
  user: InfoUser | null | undefined,
  guruId: string | null | undefined
): boolean {
  if (!user) return false;
  if (adalahAdmin(user.role) || adalahPemantau(user.role)) return true;
  return bolehKelolaJadwal(user, guruId);
}

/** Kelola kegiatan penilaian: ADMIN bebas, pengajar hanya pada jadwal miliknya. */
export function bolehKelolaKegiatanNilai(
  user: InfoUser | null | undefined,
  jadwalGuruId: string | null | undefined
): boolean {
  return bolehKelolaJadwal(user, jadwalGuruId);
}

/** Membaca nilai siswa: ADMIN bebas, WAKA/KEPALA read-only, pengajar hanya miliknya. */
export function bolehBacaKegiatanNilai(
  user: InfoUser | null | undefined,
  jadwalGuruId: string | null | undefined
): boolean {
  if (!user) return false;
  if (adalahAdmin(user.role) || adalahPemantau(user.role)) return true;
  return bolehKelolaJadwal(user, jadwalGuruId);
}

/** Hapus catatan kejadian: ADMIN bebas, pengajar hanya catatan yang ia buat. */
export function bolehHapusCatatanKejadian(
  user: InfoUser | null | undefined,
  dibuatOlehId: string | null | undefined
): boolean {
  if (!user) return false;
  if (adalahAdmin(user.role)) return true;
  if (!adalahPengajar(user)) return false;
  return !!dibuatOlehId && dibuatOlehId === user.id;
}

export type InfoDokumen = { pengajuUserId: string; status: string };

export function bolehBacaDokumen(user: InfoUser | null | undefined, d: InfoDokumen): boolean {
  if (!user) return false;
  if (adalahAdmin(user.role)) return true;
  if (user.role === "KEPALA") return d.status !== "DRAF" || d.pengajuUserId === user.id;
  return d.pengajuUserId === user.id;
}

export function bolehKelolaDokumenDraf(user: InfoUser | null | undefined, d: InfoDokumen): boolean {
  if (!user) return false;
  // Mutasi pengaju: hanya pengaju sah (GURU non-PIKET atau WAKA) yang boleh
  // mengelola draf, bahkan ketika dokumen lama milik pemeriksa.
  if (!bolehMengajukanDokumen(user)) return false;
  if (d.status !== "DRAF") return false;
  return d.pengajuUserId === user.id;
}

export function bolehRevisiDokumen(user: InfoUser | null | undefined, d: InfoDokumen): boolean {
  if (!user) return false;
  if (!bolehMengajukanDokumen(user)) return false;
  if (d.status !== "PERLU_REVISI") return false;
  return d.pengajuUserId === user.id;
}

export function bolehKirimDokumen(user: InfoUser | null | undefined, d: InfoDokumen): boolean {
  if (!user) return false;
  if (!bolehMengajukanDokumen(user)) return false;
  if (d.pengajuUserId !== user.id) return false;
  return d.status === "DRAF" || d.status === "PERLU_REVISI";
}

export function adalahPemeriksaDokumen(role: string | undefined): boolean {
  return role === "KEPALA" || role === "ADMIN" || role === "SUPERADMIN";
}

/**
 * Deteksi akun PIKET: PIKET bukan role terpisah melainkan akun GURU
 * dengan guru.jenisGuru === "PIKET" dan guru.kode === "PIKET" (pola
 * yang sama dengan deteksi piket di seluruh codebase).
 *
 * - null/undefined → false.
 * - Role bukan GURU → false.
 * - guru tidak tersedia (bukan data user lengkap) → false.
 *
 * Hanya dipakai untuk keputusan capability "boleh mengajukan" — tidak
 * menggantikan cek `isAkunPiket` pada layout/sidebar jurnal yang sudah ada.
 */
export function adalahAkunPiket(
  user:
    | (InfoUser & { guru?: { jenisGuru?: string | null; kode?: string | null } | null })
    | null
    | undefined
): boolean {
  if (!user) return false;
  if (user.role !== "GURU") return false;
  const g = user.guru;
  if (!g) return false;
  return g.jenisGuru === "PIKET" && g.kode === "PIKET";
}

/**
 * Sumber tunggal aturan "siapa yang boleh membuat / melanjutkan
 * pengajuan dokumen pribadi" di Rumah Administrasi.
 *
 * Aturan:
 * - GURU non-PIKET → true.
 * - WAKA → true (WAKA tidak punya jenisGuru PIKET).
 * - GURU PIKET → false (akun piket dialihkan oleh layout Administrasi,
 *   dan helper ini adalah pagar tambahan untuk server action & API).
 * - KEPALA/ADMIN/SUPERADMIN → false (pemeriksa/finalisator, bukan pengaju).
 * - null → false.
 *
 * Pemanggil WAJIB memberikan user lengkap (dari getCurrentUser / apiAktif),
 * sehingga deteksi PIKET dapat dilakukan dengan benar. Pesan penolakan
 * generik — tidak menyebut "pemeriksa" karena PIKET juga ditolak di sini.
 */
export function bolehMengajukanDokumen(
  user: InfoUser | null | undefined
): boolean {
  if (!user) return false;
  if (adalahAkunPiket(user)) return false;
  return user.role === "GURU" || user.role === "WAKA";
}

/** Pesan generik untuk penolakan kemampuan pengajuan. */
export const PESAN_TOLAK_MENGAJUKAN =
  "Akun ini tidak dapat membuat pengajuan dokumen pribadi.";

/** Dokumen tidak boleh ditangani oleh pengajunya sendiri (konflik kepentingan). */
export function adalahKonflikKepentingan(user: InfoUser | null | undefined, d: InfoDokumen): boolean {
  if (!user) return false;
  return !!d.pengajuUserId && d.pengajuUserId === user.id;
}

export function bolehMintaRevisi(user: InfoUser | null | undefined, d: InfoDokumen): boolean {
  if (!user) return false;
  if (!adalahPemeriksaDokumen(user.role)) return false;
  if (adalahKonflikKepentingan(user, d)) return false;
  return d.status === "DIKIRIM";
}

export function bolehSetujuiDokumen(user: InfoUser | null | undefined, d: InfoDokumen): boolean {
  if (!user) return false;
  if (!adalahPemeriksaDokumen(user.role)) return false;
  if (adalahKonflikKepentingan(user, d)) return false;
  return d.status === "DIKIRIM";
}

export const TRANSISI_DOKUMEN_VALID: Record<string, string[]> = {
  DRAF: ["DIKIRIM"],
  DIKIRIM: ["PERLU_REVISI", "DISETUJUI"],
  PERLU_REVISI: ["DIKIRIM"],
};

export function isTransisiDokumenValid(dari: string, ke: string): boolean {
  return (TRANSISI_DOKUMEN_VALID[dari] ?? []).includes(ke);
}
// ===== Template Dokumen (Rumah Administrasi) =====
// Pengelolaan: ADMIN/SUPERADMIN. Pembacaan template aktif: semua pengguna
// terautentikasi (GURU/WAKA/KEPALA/ADMIN/SUPERADMIN). Otorisasi tidak pernah
// bergantung pada UI.

export function bolehKelolaTemplate(user: InfoUser | null | undefined): boolean {
  return !!user && adalahAdmin(user.role);
}

export function bolehBacaTemplate(user: InfoUser | null | undefined): boolean {
  return !!user;
}
