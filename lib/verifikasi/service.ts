import { prisma } from "@/lib/prisma";
import { bukaFile, hitungSha256 } from "@/lib/administrasi/document-storage";
import { cekMagicBytes } from "@/lib/administrasi/document-validation";
import { bolehBacaDokumen, type InfoUser } from "@/lib/otorisasi";
import { formatKodeVerifikasi } from "@/lib/administrasi/finalisasi";

// Service verifikasi kode Dokumen Final — server-only.
// Publik hanya menerima data aman; kegagalan teknis diringkas menjadi
// INTEGRITAS_BERMASALAH tanpa path/exception/checksum expected.

export const ALFABET_KODE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa I/O/0/1
const PANJANG_KODE = 16;

export type StatusVerifikasi =
  | "VALID"
  | "TIDAK_DITEMUKAN"
  | "FORMAT_TIDAK_VALID"
  | "INTEGRITAS_BERMASALAH";

/** Uppercase + buang spasi/tanda hubung/karakter asing agar input mudah. */
export function normalisasiKodeVerifikasi(raw: string): string {
  return (raw ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** Format salah → ditolak SEBELUM query database/storage. */
export function validasiFormatKode(kodeNormal: string): string | null {
  if (kodeNormal.length !== PANJANG_KODE) {
    return `Kode verifikasi harus terdiri dari ${PANJANG_KODE} karakter huruf/angka.`;
  }
  for (const c of kodeNormal) {
    if (!ALFABET_KODE.includes(c)) {
      return "Kode memuat karakter yang tidak digunakan sistem (I, O, 0, dan 1 dihindari).";
    }
  }
  return null;
}

export type HasilVerifikasi =
  | { status: "VALID"; publik: InfoPublikVerifikasi }
  | { status: "FORMAT_TIDAK_VALID"; pesan: string }
  | { status: "TIDAK_DITEMUKAN"; pesan: string }
  | { status: "INTEGRITAS_BERMASALAH"; pesan: string };

export type InfoPublikVerifikasi = {
  kodeTerformat: string;
  jenisDokumen: string;
  nomorVersiFinal: number;
  difinalkanPada: Date;
  sha256: string;
  namaInstansi: string | null;
  /** Hanya untuk pengguna login yang berwenang membaca dokumen terkait. */
  linkDetail: string | null;
};

const PESAN_TIDAK_DITEMUKAN = "Kode tidak ditemukan atau dokumen tidak dapat diverifikasi.";
const PESAN_INTEGRITAS = "Dokumen tercatat, tetapi integritas file tidak dapat dikonfirmasi.";

export async function verifikasiKodeDokumen(rawKode: string, user?: InfoUser | null): Promise<HasilVerifikasi> {
  const kode = normalisasiKodeVerifikasi(rawKode);
  const errFormat = validasiFormatKode(kode);
  if (errFormat) return { status: "FORMAT_TIDAK_VALID", pesan: errFormat };

  const f = await prisma.dokumenFinal.findUnique({
    where: { kodeVerifikasi: kode },
    select: {
      dokumenId: true,
      versiId: true,
      nomorVersi: true,
      namaAsli: true,
      mime: true,
      ukuran: true,
      sha256: true,
      difinalkanPada: true,
      dokumen: {
        select: { jenis: true, status: true, pengajuUserId: true },
      },
    },
  });
  // Kode tidak ada, ATAU dokumen tidak lagi final/arsip → pesan netral sama.
  if (!f || (f.dokumen.status !== "DIFINALKAN" && f.dokumen.status !== "DIARSIPKAN")) {
    return { status: "TIDAK_DITEMUKAN", pesan: PESAN_TIDAK_DITEMUKAN };
  }

  // Integritas metadata: relasi versi & snapshot harus cocok.
  const v = await prisma.versiDokumen.findUnique({
    where: { id: f.versiId },
    select: { dokumenId: true, nomor: true, namaAsli: true, mime: true, ukuran: true, sha256: true, kunciPenyimpanan: true },
  });
  const metadataRusak =
    !v ||
    v.dokumenId !== f.dokumenId ||
    f.nomorVersi !== v.nomor ||
    f.namaAsli !== v.namaAsli ||
    f.mime !== v.mime ||
    f.ukuran !== v.ukuran ||
    f.sha256 !== v.sha256;
  if (metadataRusak || !v || !v.kunciPenyimpanan) {
    return { status: "INTEGRITAS_BERMASALAH", pesan: PESAN_INTEGRITAS };
  }

  // Integritas file fisik: buka, hitung ulang SHA-256, cek ukuran & magic bytes.
  let buffer: Buffer;
  try {
    buffer = await bukaFile(v.kunciPenyimpanan);
  } catch {
    return { status: "INTEGRITAS_BERMASALAH", pesan: PESAN_INTEGRITAS };
  }
  const shaUlang = hitungSha256(buffer);
  if (shaUlang !== v.sha256 || shaUlang !== f.sha256) {
    return { status: "INTEGRITAS_BERMASALAH", pesan: PESAN_INTEGRITAS };
  }
  if (buffer.length !== v.ukuran) {
    return { status: "INTEGRITAS_BERMASALAH", pesan: PESAN_INTEGRITAS };
  }
  if (!cekMagicBytes(buffer, "pdf")) {
    return { status: "INTEGRITAS_BERMASALAH", pesan: PESAN_INTEGRITAS };
  }

  const sekolah = await prisma.sekolah.findFirst({ select: { nama: true } });
  const bolehDetail =
    !!user && bolehBacaDokumen(user, { pengajuUserId: f.dokumen.pengajuUserId, status: f.dokumen.status });

  return {
    status: "VALID",
    publik: {
      kodeTerformat: formatKodeVerifikasi(kode),
      jenisDokumen: f.dokumen.jenis,
      nomorVersiFinal: f.nomorVersi,
      difinalkanPada: f.difinalkanPada,
      sha256: f.sha256,
      namaInstansi: sekolah?.nama ?? null,
      linkDetail: bolehDetail ? `/administrasi/${f.dokumenId}` : null,
    },
  };
}

/** Rate limiter in-memory (per instance, hilang saat restart) — untuk unit test. */
export function buatPembatasLaju(opsi: { maks: number; jendelaMs: number }) {
  const map = new Map<string, { jumlah: number; resetAt: number }>();
  return {
    /** true = masih boleh; false = limit tercapai. */
    habiskan(kunci: string, sekarang: number): boolean {
      const entri = map.get(kunci);
      if (!entri || sekarang > entri.resetAt) {
        map.set(kunci, { jumlah: 1, resetAt: sekarang + opsi.jendelaMs });
        return true;
      }
      entri.jumlah += 1;
      return entri.jumlah <= opsi.maks;
    },
  };
}
