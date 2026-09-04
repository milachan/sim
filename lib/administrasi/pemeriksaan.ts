import type { StatusDokumen } from "@prisma/client";
import { adalahFinalisator } from "./finalisasi";

// Helper presentasi & query untuk Kotak Masuk / detail pemeriksaan Kamad.
// MURNI fungsi tanpa efek samping — mudah dites, dipakai server-side.

// ====== Tab filter Kotak Masuk (server-side via searchParams) ======

export type NilaiTabKotakMasuk = "menunggu" | "perlu_revisi" | "disetujui" | "difinalkan" | "semua";

export type OpsiTabKotakMasuk = {
  nilai: NilaiTabKotakMasuk;
  label: string;
  statuses: readonly StatusDokumen[];
};

/** Tab kotak masuk. Default "menunggu" (DIKIRIM); DIARSIPKAN digabung ke Difinalkan. */
export const OPSI_TAB_KOTAK_MASUK: readonly OpsiTabKotakMasuk[] = [
  { nilai: "menunggu", label: "Menunggu Tindakan", statuses: ["DIKIRIM"] },
  { nilai: "perlu_revisi", label: "Perlu Revisi", statuses: ["PERLU_REVISI"] },
  { nilai: "disetujui", label: "Disetujui", statuses: ["DISETUJUI"] },
  { nilai: "difinalkan", label: "Difinalkan", statuses: ["DIFINALKAN", "DIARSIPKAN"] },
  {
    nilai: "semua",
    label: "Semua",
    statuses: ["DIKIRIM", "PERLU_REVISI", "DISETUJUI", "DIFINALKAN", "DIARSIPKAN"],
  },
];

export function opsiTabKotakMasuk(nilai: string | null | undefined): OpsiTabKotakMasuk {
  return (
    OPSI_TAB_KOTAK_MASUK.find((o) => o.nilai === nilai) ??
    // Nilai asing/kosong kembali ke default Menunggu Tindakan.
    OPSI_TAB_KOTAK_MASUK[0]
  );
}

/**
 * Urutan daftar kotak masuk:
 * - DIKIRIM paling lama menunggu di paling atas (updatedAt menaik).
 * - Status lain terbaru ke terlama (updatedAt menurun).
 */
export function urutkanKotakMasuk<T extends { status: StatusDokumen; updatedAt: Date | string }>(
  items: readonly T[]
): T[] {
  const waktu = (d: Date | string) => new Date(d).getTime();
  return [...items].sort((a, b) => {
    if (a.status === "DIKIRIM" && b.status !== "DIKIRIM") return -1;
    if (b.status === "DIKIRIM" && a.status !== "DIKIRIM") return 1;
    if (a.status === "DIKIRIM" && b.status === "DIKIRIM") return waktu(a.updatedAt) - waktu(b.updatedAt);
    return waktu(b.updatedAt) - waktu(a.updatedAt);
  });
}

/** Label durasi "lama menunggu" untuk dokumen DIKIRIM. */
export function lamaMenunggu(dari: Date | string, sekarang: Date | string = new Date()): string {
  const ms = new Date(sekarang).getTime() - new Date(dari).getTime();
  const menit = Math.floor(ms / 60000);
  if (menit < 1) return "baru saja";
  if (menit < 60) return `${menit} menit`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam`;
  const hari = Math.floor(jam / 24);
  if (hari < 7) return `${hari} hari`;
  const minggu = Math.floor(hari / 7);
  if (minggu < 4) return `${minggu} minggu`;
  const bulan = Math.floor(hari / (24 * 30));
  return `${bulan} bulan`;
}

// ====== Timeline manusiawi ======

export type ItemTimeline = {
  id: string;
  aksi: string;
  dariStatus: string | null;
  keStatus: string | null;
  payload: unknown;
  waktu: Date | string;
  aktorNama?: string | null;
};

type LabelAksi = { label: string; dikenal: true } | { label: string; dikenal: false };

const LABEL_AKSI: Record<string, string> = {
  buat: "Dokumen dibuat",
  ubah: "Informasi diperbarui",
  "ubah-draf": "Informasi diperbarui",
  upload: "Versi file diunggah",
  kirim: "Dikirim ke Kamad",
  revisi: "Revisi diminta",
  "minta-revisi": "Revisi diminta",
  kirim_revisi: "Revisi dikirim ulang",
  "kirim-revisi": "Revisi dikirim ulang",
  setujui: "Disetujui",
  finalisasi: "Difinalkan",
};

/** Label manusiawi aksi riwayat. Aksi tidak dikenal → label generik tanpa dump JSON. */
export function labelAksiTimeline(aksi: string): LabelAksi {
  const label = LABEL_AKSI[aksi];
  if (label) return { label, dikenal: true };
  return { label: "Aktivitas dokumen", dikenal: false };
}

/**
 * Catatan manusiawi dari payload riwayat — HANYA teks catatan revisi.
 * Tidak pernah menampilkan JSON mentah, ID internal, atau storage key.
 */
export function catatanTimeline(payload: unknown): string | null {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return null;
  const catatan = (payload as { catatan?: unknown }).catatan;
  if (typeof catatan === "string" && catatan.trim().length > 0) return catatan.trim();
  return null;
}

/** Nomor versi dari payload upload/finalisasi (aman, tanpa ID/storage key). */
export function nomorVersiTimeline(payload: unknown): number | null {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return null;
  const nomor = (payload as { nomor?: unknown; nomorVersi?: unknown }).nomor ?? (payload as { nomorVersi?: unknown }).nomorVersi;
  return typeof nomor === "number" && Number.isFinite(nomor) ? nomor : null;
}

// ====== Aturan tampilan aksi (server-side tetap sumber kebenaran) ======

/** Panel finalisasi hanya untuk pemeriksa pada dokumen DISETUJUI. */
export function bolehLihatFinalisasi(role: string | undefined | null, status: string): boolean {
  return adalahFinalisator(role) && status === "DISETUJUI";
}

/** Tombol Setujui hanya pada DIKIRIM dengan versi terbaru PDF siap. */
export function bolehLihatSetujui(status: string, siapPdf: boolean): boolean {
  return status === "DIKIRIM" && siapPdf;
}

/** Unduhan selalu lewat endpoint berbasis versiId — tanpa storage key. */
export function hrefUnduhVersi(versiId: string): string {
  return `/api/administrasi/versi/${versiId}/download`;
}
