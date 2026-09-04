import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./prisma";
import { hasilAksesApi, type HasilAksesApi } from "./account-auth";
import { adalahAkunPiket } from "./otorisasi";

/**
 * Muat user TERBARU dari database berdasarkan session JWT, pastikan user masih
 * ada dan aktif. GURU wajib memiliki data guru yang masih aktif (tidak
 * dinonaktifkan / soft-delete). Role otorisasi diambil dari DB, bukan JWT.
 *
 * `roles` opsional: bila diberikan, user yang aktif namun role-nya tidak
 * termasuk akan ditolak (403); selain itu 401 untuk tidak login/akun tidak sah.
 *
 * Field `guru.jenisGuru` dan `guru.kode` ikut dimuat agar caller dapat
 * mendeteksi akun PIKET tanpa query tambahan.
 */
export async function apiAktif(roles?: readonly string[]): Promise<HasilAksesApi> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false, status: 401, error: "Unauthorized" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      aktif: true,
      guruId: true,
      guru: { select: { status: true, deletedAt: true, jenisGuru: true, kode: true } },
    },
  });

  return hasilAksesApi(user, roles);
}

/**
 * Bentuk user yang siap dipakai untuk keputusan capability pengajuan dokumen.
 * Mengambil hasil apiAktif dan melempar 401/403 bila tidak sah; mengembalikan
 * objek user lengkap dengan data guru untuk PIKET detection.
 *
 * Catatan: dipanggil dari endpoint /api/administrasi yang butuh pembedaan
 * akun PIKET — bukan untuk endpoint yang sudah cukup dengan `apiAktif` + `roles`.
 */
export type HasilAksesDenganPiket =
  | { ok: true; user: { id: string; role: string; guruId: string | null; guru: { jenisGuru: string | null; kode: string | null; status: boolean; deletedAt: Date | null } | null } }
  | { ok: false; status: 401 | 403; error: string };

export async function apiAktifDenganPiket(): Promise<HasilAksesDenganPiket> {
  const auth = await apiAktif();
  if (!auth.ok) return auth;
  const u = auth.user as unknown as {
    id: string;
    role: string;
    guruId: string | null;
    guru?: { jenisGuru: string | null; kode: string | null; status: boolean; deletedAt: Date | null } | null;
  };
  // Eksplisitkan null pada saat relasi tidak ada — kompatibel dengan
  // perhitungan PIKET yang membutuhkan triple-check.
  const user = {
    id: u.id,
    role: u.role,
    guruId: u.guruId,
    guru: u.guru ?? null,
  };
  return { ok: true, user };
}

/** Re-export agar caller tidak perlu import langsung dari otorisasi. */
export { adalahAkunPiket };