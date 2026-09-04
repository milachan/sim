import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import { id as localeId } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTanggal(d: Date | string | null | undefined, pattern = "EEE, d MMM yyyy") {
  if (!d) return "-";
  const date = typeof d === "string" ? parseISO(d) : d;
  return format(date, pattern, { locale: localeId });
}

/**
 * Tengah malam UTC dari tanggal kalender. Kolom `tanggal` (DATE MySQL) dibandingkan
 * Prisma sebagai string UTC, jadi semua tanggal dipakai sebagai tengah malam UTC agar
 * query tanggal persis (`tanggal: hariIni`) cocok dengan baris yang tersimpan.
 *
 * Idempoten: input yang sudah tengah malam UTC (mis. hasil panggilan sebelumnya atau
 * string "YYYY-MM-DD") dipertahankan apa adanya; input lain (mis. tengah malam lokal
 * atau waktu saat ini) diambil komponen tanggal kalendernya.
 */
export function mulaiHari(d: Date | string = new Date()) {
  const date = typeof d === "string" ? new Date(d) : d;
  const sudahUTCMidnight =
    date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0 && date.getUTCMilliseconds() === 0;
  if (sudahUTCMidnight) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

export function formatTanggalPanjang(d: Date | string | null | undefined) {
  return formatTanggal(d, "EEEE, d MMMM yyyy");
}

export function formatJam(d: Date | string | null | undefined) {
  if (!d) return "-";
  const date = typeof d === "string" ? parseISO(d) : d;
  return format(date, "HH:mm");
}

export function labelHariIni(d: Date | string) {
  const date = typeof d === "string" ? parseISO(d) : d;
  if (isToday(date)) return "Hari ini";
  if (isYesterday(date)) return "Kemarin";
  return format(date, "d MMM yyyy", { locale: localeId });
}

export function formatAngka(n: number | null | undefined, decimals = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return n.toLocaleString("id-ID", { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
}

export function persen(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function inisial(nama: string) {
  return nama
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((k) => k[0]?.toUpperCase())
    .join("");
}

export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/**
 * KKM (Kriteria Ketuntasan Minimal) default untuk penilaian.
 * Bisa dioverride per kegiatan lewat field kegiatan.kkm, tapi
 * skema saat ini belum menyimpan KKM sehingga dipakai nilai default.
 */
export const KKM_DEFAULT = 75;

export type StatusNilai = "TUNTAS" | "REMIDI" | "KOSONG";

/**
 * Menentukan status nilai siswa terhadap KKM.
 * - KOSONG: nilai belum terisi (null)
 * - REMIDI: nilai terisi tapi di bawah KKM
 * - TUNTAS: nilai terisi dan >= KKM
 *
 * Status pengumpulan (BELUM/TERLAMBAT) TIDAK membatalkan nilai yang sudah
 * terisi — guru yang mengetik nilai tanpa mengubah status kumpul tetap
 * terhitung (bukan "kosong") agar ringkasan konsisten dengan data nilainya.
 */
export function statusNilai(
  nilai: number | null,
  _statusKumpul?: "DIKUMPULKAN" | "BELUM" | "TERLAMBAT",
  kkm: number = KKM_DEFAULT,
): StatusNilai {
  if (nilai === null || nilai === undefined) return "KOSONG";
  if (nilai < kkm) return "REMIDI";
  return "TUNTAS";
}
