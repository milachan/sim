import type { JenisDokumen, StatusDokumen } from "@prisma/client";

export const JENIS_DOKUMEN_LABEL: Record<JenisDokumen, string> = {
  PROPOSAL: "Proposal",
  RPP_MODUL_AJAR: "RPP / Modul Ajar",
  LAPORAN_KEGIATAN: "Laporan Kegiatan",
  DOKUMEN_UMUM: "Dokumen Umum",
};

export const STATUS_DOKUMEN_LABEL: Record<StatusDokumen, string> = {
  DRAF: "Draf",
  DIKIRIM: "Dikirim",
  PERLU_REVISI: "Perlu Revisi",
  DISETUJUI: "Disetujui",
  DIFINALKAN: "Difinalkan",
  DIARSIPKAN: "Diarsipkan",
};

export const STATUS_DOKUMEN_BADGE: Record<StatusDokumen, string> = {
  DRAF: "bg-slate-100 text-slate-600",
  DIKIRIM: "bg-blue-100 text-blue-700",
  PERLU_REVISI: "bg-amber-100 text-amber-700",
  DISETUJUI: "bg-emerald-100 text-emerald-700",
  DIFINALKAN: "bg-violet-100 text-violet-700",
  DIARSIPKAN: "bg-zinc-100 text-zinc-600",
};

export const JENIS_DOKUMEN_VALUES: readonly JenisDokumen[] = [
  "PROPOSAL",
  "RPP_MODUL_AJAR",
  "LAPORAN_KEGIATAN",
  "DOKUMEN_UMUM",
] as const;

export function isJenisDokumen(v: unknown): v is JenisDokumen {
  return typeof v === "string" && (JENIS_DOKUMEN_VALUES as readonly string[]).includes(v);
}

export type DokumenInput = { judul: string; jenis: JenisDokumen | string; ringkasan?: string | null };

/**
 * Batas panjang judul dokumen pada SEMUA boundary (validasi server & maxLength UI).
 * Kolom `judul` di DB adalah VARCHAR(191) default MySQL — 190 memberi ruang aman
 * agar penyimpanan tidak gagal (Prisma P2000). Jangan menulis angka 190 literal
 * di tempat lain; selalu impor konstanta ini.
 */
export const BATAS_JUDUL_DOKUMEN = 190;

export function validasiDokumen(input: DokumenInput): string | null {
  const judul = input.judul?.trim() ?? "";
  if (judul.length < 5) return "Judul minimal 5 karakter.";
  if (judul.length > BATAS_JUDUL_DOKUMEN) return `Judul maksimal ${BATAS_JUDUL_DOKUMEN} karakter.`;
  if (!isJenisDokumen(input.jenis)) return "Jenis dokumen tidak valid.";
  const ringkasan = (input.ringkasan ?? "").trim();
  if (ringkasan.length > 2000) return "Keterangan maksimal 2000 karakter.";
  return null;
}

export function normalisasiDokumen(input: DokumenInput): { judul: string; jenis: JenisDokumen; ringkasan: string | null } {
  return {
    judul: input.judul.trim(),
    jenis: input.jenis as JenisDokumen,
    ringkasan: (input.ringkasan ?? "").trim() ? (input.ringkasan ?? "").trim() : null,
  };
}

export function validasiCatatanRevisi(catatan: string | null | undefined): string | null {
  const c = (catatan ?? "").trim();
  if (c.length < 10) return "Catatan revisi minimal 10 karakter.";
  if (c.length > 2000) return "Catatan revisi maksimal 2000 karakter.";
  return null;
}
