import type { JenisDokumen, Prisma, StatusDokumen } from "@prisma/client";
import { JENIS_DOKUMEN_LABEL } from "@/lib/dokumen-validasi";
import { isJenisDokumen } from "@/lib/dokumen-validasi";

// Helper murni untuk halaman Arsip dan katalog Template Dokumen.
// Tanpa efek samping — mudah dites, dipakai server-side (dan katalog di client).

/** Hanya dua status ini yang termasuk arsip. */
export const STATUS_ARSIP: readonly StatusDokumen[] = ["DIFINALKAN", "DIARSIPKAN"];

// ====== Filter arsip (server-side via searchParams) ======

/** Tahun finalisasi valid: rentang wajar. Nilai asing → null (tanpa filter). */
export function opsiTahunArsip(nilai: string | null | undefined, tahunIni: number): number | null {
  const t = Number(nilai);
  if (!Number.isInteger(t)) return null;
  if (t < 2000 || t > tahunIni + 1) return null;
  return t;
}

/** Jenis dokumen valid hanya yang dikenali sistem. Nilai asing → null. */
export function opsiJenisArsip(nilai: string | null | undefined): JenisDokumen | null {
  return isJenisDokumen(nilai) ? nilai : null;
}

/** Kepemilikan hanya relevan untuk pemeriksa. Nilai asing → "semua". */
export function opsiMilikArsip(nilai: string | null | undefined): "semua" | "saya" {
  return nilai === "saya" ? "saya" : "semua";
}

/** Daftar tahun untuk dropdown filter (tahun ini mundur 5 tahun). */
export function daftarTahunArsip(tahunIni: number, jumlah = 5): number[] {
  return Array.from({ length: Math.max(1, jumlah) }, (_, i) => tahunIni - i);
}

export type WhereArsip = Prisma.DokumenWhereInput;

/**
 * Where aman untuk daftar arsip:
 * - Selalu DIFINALKAN/DIARSIPKAN dan memiliki DokumenFinal.
 * - Guru/WAKA (bukan pemeriksa) SELALU terikat pengajuUserId.
 * - Pemeriksa: milik "saya" terikat pengajuUserId; "semua" tanpa batas.
 * - Pencarian kosong tidak menambah kondisi judul.
 */
export function bangunWhereArsip(
  userId: string,
  isPemeriksa: boolean,
  filter: { q?: string | null; jenis?: string | null; tahun?: number | null; milik?: "semua" | "saya" }
): WhereArsip {
  const where: WhereArsip = {
    status: { in: [...STATUS_ARSIP] },
    dokumenFinal: { isNot: null },
  };
  const milik = opsiMilikArsip(filter.milik);
  if (!isPemeriksa || milik === "saya") where.pengajuUserId = userId;

  const q = (filter.q ?? "").trim();
  if (q) where.judul = { contains: q };

  const jenis = opsiJenisArsip(filter.jenis);
  if (jenis) where.jenis = jenis;

  if (filter.tahun != null) {
    // Bentuk relation-filter murni (is) — sekaligus memastikan DokumenFinal ada.
    where.dokumenFinal = {
      is: {
        difinalkanPada: {
          gte: new Date(Date.UTC(filter.tahun, 0, 1)),
          lt: new Date(Date.UTC(filter.tahun + 1, 0, 1)),
        },
      },
    };
  }
  return where;
}// ====== Statistik arsip ======

export type BarisArsipRingkas = { status: StatusDokumen; jenis: string; pengajuUserId: string; difinalkanPada: Date | string };

export type StatistikArsip = {
  total: number;
  tahunIni: number;
  jumlahJenis: number;
};

/** Statistik dari baris yang sudah terscope — angka nyata dari database. */
export function hitungStatistikArsip(rows: BarisArsipRingkas[], tahunIni: number): StatistikArsip {
  const jenis = new Set<string>();
  let tahunIniCount = 0;
  for (const r of rows) {
    jenis.add(r.jenis);
    if (new Date(r.difinalkanPada).getUTCFullYear() === tahunIni) tahunIniCount += 1;
  }
  return { total: rows.length, tahunIni: tahunIniCount, jumlahJenis: jenis.size };
}

// ====== Katalog Template (konfigurasi UI, bukan data DB) ======

export type ItemKatalogTemplate = {
  jenis: string;
  label: string;
  ikon: string;
  deskripsi: string;
  /** Belum ada modul Template Dokumen — jujur: semua belum tersedia. */
  tersedia: false;
};

const DESKRIPSI_JENIS: Record<string, string> = {
  PROPOSAL: "Rencana kegiatan madrasah yang diajukan untuk persetujuan Kamad.",
  RPP_MODUL_AJAR: "Rencana Pelaksanaan Pembelajaran atau Modul Ajar mata pelajaran.",
  LAPORAN_KEGIATAN: "Laporan pelaksanaan kegiatan setelah kegiatan selesai.",
  DOKUMEN_UMUM: "Surat dan dokumen administrasi lain yang tidak masuk kategori khusus.",
};

const IKON_JENIS: Record<string, string> = {
  PROPOSAL: "file-plus",
  RPP_MODUL_AJAR: "book-open",
  LAPORAN_KEGIATAN: "clipboard-list",
  DOKUMEN_UMUM: "file-text",
};

/** Katalog dibangun dari JENIS_DOKUMEN_LABEL — sumber data resmi sistem. */
export function bangunKatalogTemplate(): ItemKatalogTemplate[] {
  return Object.entries(JENIS_DOKUMEN_LABEL).map(([jenis, label]) => ({
    jenis,
    label,
    ikon: IKON_JENIS[jenis] ?? "file-text",
    deskripsi: DESKRIPSI_JENIS[jenis] ?? "Dokumen administrasi madrasah.",
    tersedia: false,
  }));
}

/** Filter katalog client-side: cocokkan label atau deskripsi. Kosong → semua. */
export function filterKatalogTemplate(katalog: ItemKatalogTemplate[], q: string | null): ItemKatalogTemplate[] {
  const kata = (q ?? "").trim().toLowerCase();
  if (!kata) return katalog;
  return katalog.filter(
    (k) => k.label.toLowerCase().includes(kata) || k.deskripsi.toLowerCase().includes(kata)
  );
}

/** Langkah panduan penggunaan template; `tersedia` menandai kejujuran UI. */
export const LANGKAH_TEMPLATE: readonly { label: string; tersedia: boolean }[] = [
  { label: "Unduh template resmi ketika tersedia", tersedia: false },
  { label: "Lengkapi dokumen sesuai template", tersedia: true },
  { label: "Simpan sebagai PDF final", tersedia: true },
  { label: "Buat pengajuan dokumen", tersedia: true },
  { label: "Unggah file dan kirim ke Kamad", tersedia: true },
];
