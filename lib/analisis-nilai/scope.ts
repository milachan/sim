import { adalahAdmin, adalahPemantau, type InfoUser } from "@/lib/otorisasi";

/**
 * Turunan scope baca dari aturan existing bolehBacaKegiatanNilai:
 * - ADMIN/SUPERADMIN/WAKA/KEPALA → lihat semua kegiatan penilaian.
 * - GURU dengan guruId → hanya kegiatan pada jadwal miliknya.
 * - Selain itu (termasuk GURU tanpa guruId / tanpa user) → tanpa akses.
 * Fungsi murni; query Prisma dibangun di halaman dari hasil ini sehingga
 * pembatasan terjadi di server, bukan sekadar menyembunyikan UI.
 */
export type ScopeAnalisisNilai = { lihatSemua: boolean };

export function scopeBacaAnalisisNilai(user: InfoUser | null | undefined): ScopeAnalisisNilai | null {
  if (!user) return null;
  if (adalahAdmin(user.role) || adalahPemantau(user.role)) return { lihatSemua: true };
  if (user.role === "GURU" && !!user.guruId) return { lihatSemua: false };
  return null;
}

/** Where Prisma untuk daftar kegiatan sesuai scope; null berarti tidak berhak sama sekali. */
export function whereScopeKegiatan(
  user: InfoUser | null | undefined
): Record<string, unknown> | null {
  const scope = scopeBacaAnalisisNilai(user);
  if (!scope) return null;
  return scope.lihatSemua ? {} : { jadwal: { guruId: user!.guruId! } };
}
