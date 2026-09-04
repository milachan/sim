/**
 * Penyimpanan sementara kredensial akun baru (password polos) untuk unduhan
 * SEKALI pakai — khusus deployment satu instance, tanpa Redis/object storage.
 *
 * Batasan (didokumentasikan juga di README):
 * - Memory-only: hanya cocok untuk satu instance server.
 * - Token hilang bila server restart — admin harus mengulang import.
 * - Pada multi-instance/serverless, ganti dengan shared temporary store
 *   pada tahap storage berikutnya.
 *
 * Keamanan:
 * - Setiap entri menyimpan ownerUserId; hanya Admin/Super Admin yang melakukan
 *   import tersebut yang boleh mengunduh.
 * - Token sekali pakai dan kedaluwarsa cepat.
 * - Entri kedaluwarsa dibersihkan saat akses dan via cleanup terjadwal.
 * - Token acak CSPRNG; password TIDAK pernah masuk URL atau log.
 */

import { randomBytes } from "node:crypto";

export type BarisKredensial = {
  nama: string;
  kode: string;
  username: string;
  password: string;
  peran: string;
  wajib: string;
};

export type EntriKredensial = {
  ownerUserId: string;
  data: BarisKredensial[];
  expires: number;
};

export const KREDENSIAL_TTL_MS = 10 * 60 * 1000;

/** Singleton untuk route production. */
export const kredensialStore = new Map<string, EntriKredensial>();

/** Token acak CSPRNG — satu-satunya secret di URL (tanpa data lain). */
export function buatTokenKredensial(): string {
  return randomBytes(18).toString("base64url");
}

/** Hapus semua entri kedaluwarsa; dipanggil saat akses & via timer. */
export function bersihkanKedaluwarsa(store: Map<string, EntriKredensial>, now: number): void {
  for (const [token, entri] of store) {
    if (entri.expires < now) store.delete(token);
  }
}

export function simpanKredensial(
  store: Map<string, EntriKredensial>,
  ownerUserId: string,
  data: BarisKredensial[],
  opts?: { ttlMs?: number; now?: number }
): string {
  const now = opts?.now ?? Date.now();
  const ttlMs = opts?.ttlMs ?? KREDENSIAL_TTL_MS;
  bersihkanKedaluwarsa(store, now);
  const token = buatTokenKredensial();
  store.set(token, { ownerUserId, data, expires: now + ttlMs });
  return token;
}

export type HasilAmbilKredensial =
  | { ok: true; data: BarisKredensial[] }
  | /** generik: token salah/kedaluwarsa/bukan milik pemanggil */ { ok: false };

/**
 * Ambil kredensial SEKALI pakai, hanya oleh pemiliknya. Semua kegagalan
 * mengembalikan hasil yang sama (generik) agar keberadaan token tidak bocor.
 */
export function ambilKredensial(
  store: Map<string, EntriKredensial>,
  token: string,
  userId: string,
  now: number = Date.now()
): HasilAmbilKredensial {
  bersihkanKedaluwarsa(store, now);
  const entri = store.get(token);
  if (!entri) return { ok: false };
  if (entri.expires < now) {
    store.delete(token);
    return { ok: false };
  }
  if (entri.ownerUserId !== userId) return { ok: false };
  store.delete(token);
  if (entri.expires < now) return { ok: false };
  return { ok: true, data: entri.data };
}
