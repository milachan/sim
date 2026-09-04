// Helper analisis nilai MURNI (tanpa Prisma/JSX). Dipakai halaman
// /analisis-nilai yang read-only. Semua fungsi aman terhadap array kosong,
// nilai null, dan nilai maksimal tidak valid.

/** Pembulatan stabil ke 1 desimal (menghindari artefak float biner). */
export function bulatkan1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

/**
 * Normalisasi nilai ke persentase 0–100: nilai / maksimal * 100.
 * - nilai null/undefined atau bukan angka → null (tidak ikut dihitung).
 * - maksimal tidak valid (<= 0, NaN, Infinity) → null.
 * - hasil di-clamp ke rentang 0–100 lalu dibulatkan 1 desimal.
 */
export function normalisasiPersen(
  nilai: number | null | undefined,
  maksimal: number | null | undefined
): number | null {
  if (typeof nilai !== "number" || !Number.isFinite(nilai)) return null;
  if (typeof maksimal !== "number" || !Number.isFinite(maksimal) || maksimal <= 0) return null;
  const raw = (nilai / maksimal) * 100;
  const clamp = Math.min(100, Math.max(0, raw));
  return bulatkan1(clamp);
}

/** Rata-rata; null bila tidak ada nilai valid. */
export function rataRata(values: number[]): number | null {
  const valid = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (!valid.length) return null;
  return valid.reduce((a, v) => a + v, 0) / valid.length;
}

/** Median; null bila kosong. Genap = rata-rata dua nilai tengah (bisa desimal). */
export function median(values: number[]): number | null {
  const valid = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (!valid.length) return null;
  const urut = [...valid].sort((a, b) => a - b);
  const tengah = Math.floor(urut.length / 2);
  if (urut.length % 2 === 1) return urut[tengah]!;
  return (urut[tengah - 1]! + urut[tengah]!) / 2;
}

/** Nilai minimum & maksimum; null bila kosong. */
export function minMaks(values: number[]): { min: number; max: number } | null {
  const valid = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (!valid.length) return null;
  return { min: Math.min(...valid), max: Math.max(...valid) };
}

export type RingkasanNilai = {
  jumlahNilai: number;
  terisi: number;
  belumTerisi: number;
  rata: number | null;
  median: number | null;
  tertinggi: number | null;
  terendah: number | null;
};

/** Ringkasan dari daftar nilai mentah (boleh berisi null). */
export function ringkasNilai(entries: Array<number | null | undefined>): RingkasanNilai {
  const valid = entries.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const mm = minMaks(valid);
  return {
    jumlahNilai: entries.length,
    terisi: valid.length,
    belumTerisi: entries.length - valid.length,
    rata: rataRata(valid),
    median: median(valid),
    tertinggi: mm?.max ?? null,
    terendah: mm?.min ?? null,
  };
}

export type RentangDistribusi = {
  label: string;
  batasBawah: number; // inklusif
  batasAtas: number; // eksklusif (kecuali rentang terakhir)
  jumlah: number;
};

const RENTANG: Array<{ label: string; batasBawah: number; batasAtas: number }> = [
  { label: "0 – <60", batasBawah: 0, batasAtas: 60 },
  { label: "60 – <75", batasBawah: 60, batasAtas: 75 },
  { label: "75 – <90", batasBawah: 75, batasAtas: 90 },
  { label: "90 – 100", batasBawah: 90, batasAtas: 101 },
];

/**
 * Distribusi persentase ke rentang 0–<60, 60–<75, 75–<90, 90–100.
 * Nilai di luar 0–100 diabaikan. Urutan hasil tetap mengikuti RENTANG.
 */
export function distribusiRentang(persenList: number[]): RentangDistribusi[] {
  const hasil: RentangDistribusi[] = RENTANG.map((r) => ({ ...r, jumlah: 0 }));
  for (const p of persenList) {
    if (typeof p !== "number" || !Number.isFinite(p)) continue;
    const idx = hasil.findIndex(
      (r) => p >= r.batasBawah && (p < r.batasAtas || (r.label === "90 – 100" && p <= 100))
    );
    if (idx >= 0) hasil[idx]!.jumlah++;
  }
  return hasil;
}

export type HitunganStatus = Record<"DIKUMPULKAN" | "BELUM" | "TERLAMBAT", number>;

/** Hitung baris per StatusKumpul; status tak dikenal diabaikan. */
export function hitungStatusPengumpulan(statusList: string[]): HitunganStatus {
  const out: HitunganStatus = { DIKUMPULKAN: 0, BELUM: 0, TERLAMBAT: 0 };
  for (const s of statusList) {
    if (s === "DIKUMPULKAN" || s === "BELUM" || s === "TERLAMBAT") out[s]++;
  }
  return out;
}

export type InputTren = {
  id: string;
  judul: string;
  tanggal: Date | string;
  nilaiMaksimal: number;
  /** Rata-rata nilai mentah kegiatan (null bila belum ada nilai terisi). */
  rataNilai: number | null;
};

export type TitikTren = { id: string; label: string; shortLabel: string; persen: number };

function potong(s: string, maks: number): string {
  return s.length > maks ? `${s.slice(0, maks - 1)}…` : s;
}

function tanggalPendek(t: Date | string): string {
  const d = typeof t === "string" ? new Date(t) : t;
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Susun titik tren persentase (rata-rata ternormalisasi) dari kegiatan terbaru.
 * Input diasumsikan terurut terbaru → terlama. Hanya kegiatan valid yang dipakai:
 * nilaiMaksimal > 0 finite DAN rataNilai terisi. Maksimal `batas` titik,
 * hasil diurutkan kronologis (lama → baru) untuk digambar sebagai tren.
 */
export function susunTrenKegiatan(items: InputTren[], batas = 6): TitikTren[] {
  const titik: TitikTren[] = [];
  for (const k of items) {
    if (titik.length >= batas) break;
    const persen = normalisasiPersen(k.rataNilai ?? null, k.nilaiMaksimal);
    if (persen === null) continue;
    const tg = tanggalPendek(k.tanggal);
    titik.push({
      id: k.id,
      label: potong(k.judul, 24),
      shortLabel: tg ? tg : potong(k.judul, 8),
      persen,
    });
  }
  return titik.reverse();
}
