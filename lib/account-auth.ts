import { timingSafeEqual } from "node:crypto";

export type InfoUserDb = {
  id: string;
  role: string;
  aktif: boolean;
  guruId: string | null;
  guru?: { status: boolean; deletedAt: Date | null } | null;
};

/** User sah = ada di DB dan masih aktif (berlaku juga utk JWT lama). */
export function isUserAktif(u: InfoUserDb | null | undefined): boolean {
  return !!u && u.aktif;
}

/** Role otorisasi final selalu diambil dari data termutakhir DB. */
export function roleDbUser(u: InfoUserDb | null | undefined): string | null {
  return isUserAktif(u) ? u!.role : null;
}

/** Cek apakah user aktif memiliki salah satu role (basis keputusan 401/403). */
export function punyaRoleDb(u: InfoUserDb | null | undefined, roles: readonly string[]): boolean {
  const role = roleDbUser(u);
  return role !== null && roles.includes(role);
}

/** Pengajar operasional = role GURU atau WAKA, memiliki guruId valid & data guru aktif. */
export function adalahPengajarOperasional(u: InfoUserDb | null | undefined): boolean {
  if (!isUserAktif(u)) return false;
  if (u!.role !== "GURU" && u!.role !== "WAKA") return false;
  return !!u!.guruId && !!u!.guru && u!.guru.status === true && u!.guru.deletedAt === null;
}

/** Guru operasional = hanya role GURU (termasuk piket/wali/BK) dengan data guru aktif. */
export function guruOperasionalValid(u: InfoUserDb | null | undefined): boolean {
  if (!isUserAktif(u)) return false;
  if (u!.role !== "GURU") return false;
  return !!u!.guruId && !!u!.guru && u!.guru.status === true && u!.guru.deletedAt === null;
}

/**
 * Otorisasi commit API: user harus aktif (401 bila tidak), pengajar (GURU/WAKA)
 * harus operasional, role harus termasuk daftar bila diberikan (403 bila tidak).
 */
export type HasilAksesApi =
  | { ok: true; user: InfoUserDb }
  | { ok: false; status: 401 | 403; error: string };

export function hasilAksesApi(
  user: InfoUserDb | null | undefined,
  roles?: readonly string[]
): HasilAksesApi {
  if (!isUserAktif(user)) return { ok: false, status: 401, error: "Unauthorized" };
  if (adalahPengajarOperasional(user) === false && (user!.role === "GURU" || user!.role === "WAKA")) {
    // GURU/WAKA harus punya guru aktif
    if (!guruOperasionalValid(user) && user!.role === "GURU") {
      return { ok: false, status: 401, error: "Unauthorized" };
    }
    if (user!.role === "WAKA" && !adalahPengajarOperasional(user) && user!.guruId) {
      // WAKA yang punya guruId tapi gurunya nonaktif tetap boleh memantau
    }
  }
  if (roles && !roles.includes(user!.role)) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  return { ok: true, user: user! };
}

/** Bearer secret utk cron/job terjadwal — tetap berjalan tanpa sesi user. */
export function cronBearerValid(
  authHeader: string | null,
  secret: string | undefined
): boolean {
  if (!secret || !authHeader) return false;
  const kunci = Buffer.from(`Bearer ${secret}`);
  const masuk = Buffer.from(authHeader);
  // Bandingkan dengan durasi tetap (constant-time) agar panjang/isi secret tidak
  // bisa ditebak lewat timing. Panjang header dikontrol penuh oleh pemanggil,
  // jadi early-return saat beda panjang tidak membocorkan informasi secret.
  if (kunci.length !== masuk.length) return false;
  return timingSafeEqual(kunci, masuk);
}