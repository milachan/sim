import { randomBytes } from "crypto";
import { cekMagicBytes } from "./document-validation";
import { hitungSha256 } from "./document-storage";

const KODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa I/O/0/1 agar mudah dibaca

export function isStatusBolehFinalisasi(status: string): boolean {
  return status === "DISETUJUI";
}

export function adalahFinalisator(role: string | undefined | null): boolean {
  return role === "KEPALA" || role === "ADMIN" || role === "SUPERADMIN";
}

export function buatKodeVerifikasi(panjang = 16): string {
  const bytes = randomBytes(panjang);
  let kode = "";
  for (let i = 0; i < panjang; i++) kode += KODE_ALPHABET[bytes[i] % KODE_ALPHABET.length];
  return kode;
}

export function formatKodeVerifikasi(kode: string): string {
  const bersih = kode.replace(/[^A-Z0-9]/g, "");
  const blok = [];
  for (let i = 0; i < bersih.length; i += 4) blok.push(bersih.slice(i, i + 4));
  return blok.join("-");
}

export type KandidatVersi = {
  id: string;
  nomor: number;
  namaAsli: string | null;
  mime: string | null;
  ukuran: number | null;
  kunciPenyimpanan: string | null;
  sha256: string | null;
};

export function validasiKandidatFinal(v: KandidatVersi | null | undefined): string | null {
  if (!v) return "Dokumen belum memiliki versi.";
  if (!v.kunciPenyimpanan) return "Versi terbaru belum memiliki file. Unggah versi PDF sebelum finalisasi.";
  const ext = (v.namaAsli ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (ext !== "pdf" || v.mime !== "application/pdf") return "Unggah versi PDF sebelum finalisasi.";
  if (!v.sha256) return "Versi tidak memiliki checksum. Unggah ulang versi PDF.";
  return null;
}

export function pilihVersiTerbaru<T extends { nomor: number }>(versiList: readonly T[]): T | null {
  let terbaru: T | null = null;
  for (const v of versiList) {
    if (!terbaru || v.nomor > terbaru.nomor) terbaru = v;
  }
  return terbaru;
}

export type VersiTerikat = { dokumenId: string };

export function errIkatanVersi(v: VersiTerikat | null | undefined, dokumenId: string): string | null {
  if (!v) return "Dokumen belum memiliki versi.";
  if (v.dokumenId !== dokumenId) return "Versi tidak termasuk dokumen ini. Finalisasi dibatalkan.";
  return null;
}

export type RecordFinalRingkas = { kodeVerifikasi: string; versiId: string };

export function responFinal(f: RecordFinalRingkas, idempotent: boolean) {
  return { ok: true as const, idempotent, kodeVerifikasi: f.kodeVerifikasi, versiId: f.versiId };
}

export const PESAN_TOLAK_SETUJUI =
  "Dokumen belum memiliki versi PDF final. Kembalikan untuk revisi dan minta guru mengunggah PDF sebelum disetujui.";

export const SARAN_CATATAN_REVISI_PDF = "Mohon unggah dokumen versi final dalam format PDF.";

export const PERINGATAN_VERSI_BUKAN_PDF =
  "Versi terbaru dokumen ini belum berupa file PDF. Guru harus mengunggah versi PDF sebelum dokumen dapat disetujui dan difinalisasi.";

export type MuatBerkas = () => Promise<Buffer>;

export type HasilIntegritas =
  | { ok: true; buffer: Buffer; sha256Aktual: string }
  | { ok: false; alasan: string };

export async function verifikasiVersiPdf(v: KandidatVersi | null | undefined, muat: MuatBerkas): Promise<HasilIntegritas> {
  const errMeta = validasiKandidatFinal(v);
  if (errMeta) return { ok: false, alasan: errMeta };
  let buffer: Buffer;
  try {
    buffer = await muat();
  } catch {
    return { ok: false, alasan: "File tidak ditemukan di penyimpanan." };
  }
  const sha256Aktual = hitungSha256(buffer);
  if (sha256Aktual !== v!.sha256) return { ok: false, alasan: "Checksum file fisik tidak cocok dengan metadata versi." };
  if (!cekMagicBytes(buffer, (v!.namaAsli ?? "").split(".").pop()?.toLowerCase() ?? "")) {
    return { ok: false, alasan: "Isi file tidak sesuai dengan format PDF." };
  }
  return { ok: true, buffer, sha256Aktual };
}

export function siapSetujuiMetadata(v: KandidatVersi | null | undefined): boolean {
  return validasiKandidatFinal(v) === null;
}
