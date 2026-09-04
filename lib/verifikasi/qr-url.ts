import { formatKodeVerifikasi } from "@/lib/administrasi/finalisasi";

// Generator URL verifikasi Dokumen Final — server-only.
// Base URL diambil dari konfigurasi environment terpercaya (NEXTAUTH_URL),
// TIDAK PERNAH dari header Host/x-forwarded-host request publik.
// URL hanya berisi parameter kode — tanpa dokumenId, userId, judul,
// checksum, storage key, atau path file.

function hostLokal(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h.endsWith(".local") || h.endsWith(".lan")) return true;
  if (!h.includes(".")) return true; // nama mesin LAN
  const ip = h.split(".");
  if (ip.length === 4 && ip.every((n) => /^\d+$/.test(n))) {
    const a = Number(ip[0]);
    const b = Number(ip[1]);
    if (a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return true;
  }
  return false;
}

/** Base URL terpercaya untuk URL verifikasi (tanpa trailing slash ganda). */
export function baseUrlVerifikasi(env = process.env): string {
  const mentah = env.NEXTAUTH_URL?.trim() ?? "";
  if (!mentah) throw new Error("NEXTAUTH_URL belum dikonfigurasi untuk URL verifikasi.");
  let url: URL;
  try {
    url = new URL(mentah);
  } catch {
    throw new Error("NEXTAUTH_URL bukan URL valid.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("NEXTAUTH_URL harus memakai protokol http/https.");
  }
  // Aturan: HTTPS wajib untuk host publik; localhost/LAN (development &
  // staging lokal) boleh HTTP tanpa memandang NODE_ENV.
  if (url.protocol !== "https:" && !hostLokal(url.hostname)) {
    throw new Error("Base URL verifikasi untuk host publik harus memakai HTTPS.");
  }
  // Normalisasi: buang trailing slash ganda (tersisa satu atau nol).
  const pathBersih = url.pathname.replace(/\/+$/, "");
  return `${url.protocol}//${url.host}${pathBersih}`;
}

/** URL absolut verifikasi untuk sebuah kode DokumenFinal (dari DB, bukan client). */
export function urlVerifikasiKode(kodeVerifikasi: string): string {
  return `${baseUrlVerifikasi()}/verifikasi-dokumen?kode=${encodeURIComponent(kodeVerifikasi)}`;
}

/** Payload persis yang dienkode ke dalam QR — sama dengan URL verifikasi. */
export function payloadQrVerifikasi(kodeVerifikasi: string): string {
  return urlVerifikasiKode(kodeVerifikasi);
}

export function kodeTerformat(kodeVerifikasi: string): string {
  return formatKodeVerifikasi(kodeVerifikasi);
}
