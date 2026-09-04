// Helper UI pusat notifikasi Administrasi — murni, tanpa efek samping,
// agar mudah dites. Pemetaan ikon per jenis + normalisasi filter +
// formatter badge + validator tautan internal untuk route pembuka.

import type { JenisNotifikasiAdministrasi } from "@prisma/client";
import { Archive, AlertTriangle, CheckCircle2, FileText, RefreshCw, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Badge jumlah unread: null (tanpa badge), "1".."99", lalu "99+". */
export function formatJumlahBadge(jumlah: number): string | null {
  if (!Number.isFinite(jumlah) || jumlah <= 0) return null;
  if (jumlah >= 100) return "99+";
  return String(jumlah);
}

export type FilterNotifikasi = "semua" | "belum" | "sudah";

/** Nilai asing/kosong kembali konsisten ke "semua". */
export function opsiFilterNotifikasi(nilai: string | null | undefined): FilterNotifikasi {
  if (nilai === "belum" || nilai === "sudah") return nilai;
  return "semua";
}

export const LABEL_FILTER_NOTIFIKASI: ReadonlyArray<{ nilai: FilterNotifikasi; label: string }> = [
  { nilai: "semua", label: "Semua" },
  { nilai: "belum", label: "Belum Dibaca" },
  { nilai: "sudah", label: "Sudah Dibaca" },
];

const IKON_JENIS: Record<JenisNotifikasiAdministrasi, LucideIcon> = {
  DOKUMEN_DIKIRIM: Send,
  REVISI_DIKIRIM: RefreshCw,
  PERLU_REVISI: AlertTriangle,
  DISETUJUI: CheckCircle2,
  DIFINALKAN: Archive,
};

export function ikonJenisNotifikasi(jenis: string): LucideIcon {
  return IKON_JENIS[jenis as JenisNotifikasiAdministrasi] ?? FileText;
}

/** Indikator tekstual status baca (bukan warna saja). */
export function labelStatusDibaca(dibacaPada: Date | string | null): string {
  return dibacaPada ? "Dibaca" : "Belum Dibaca";
}

/**
 * Validator tautan internal untuk redirect route pembuka.
 * Hanya path relatif yang diawali "/administrasi/" yang diizinkan;
 * tautan asing/scheme/kontrol karakter ditolak (null).
 */
export function tautanAmanNotifikasi(tautan: string | null | undefined): string | null {
  if (!tautan) return null;
  if (!tautan.startsWith("/administrasi/")) return null;
  if (/[\r\n\u0000]/.test(tautan)) return null;
  return tautan;
}
