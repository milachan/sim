import type { Prisma, StatusDokumen } from "@prisma/client";
import { STATUS_DOKUMEN_LABEL } from "@/lib/dokumen-validasi";

// Helper presentasi & query untuk Dashboard dan Dokumen Saya (Rumah Administrasi).
// MURNI fungsi tanpa efek samping — mudah dites, dipakai server-side.

/** "Selesai" untuk pengaju: DISETUJUI + DIFINALKAN + DIARSIPKAN. */
export const STATUS_SELESAI_PENGAJU: readonly StatusDokumen[] = ["DISETUJUI", "DIFINALKAN", "DIARSIPKAN"];

export type JumlahPerStatus = Partial<Record<StatusDokumen, number>>;

export type StatistikPengaju = {
  draf: number;
  diproses: number;
  perluRevisi: number;
  selesai: number;
};

export function hitungStatistikPengaju(jumlah: JumlahPerStatus): StatistikPengaju {
  return {
    draf: jumlah.DRAF ?? 0,
    diproses: jumlah.DIKIRIM ?? 0,
    perluRevisi: jumlah.PERLU_REVISI ?? 0,
    selesai:
      (jumlah.DISETUJUI ?? 0) + (jumlah.DIFINALKAN ?? 0) + (jumlah.DIARSIPKAN ?? 0),
  };
}

export type StatistikPemeriksa = {
  menunggu: number;
  perluRevisi: number;
  disetujui: number;
  difinalkan: number;
};

export function hitungStatistikPemeriksa(jumlah: JumlahPerStatus): StatistikPemeriksa {
  return {
    menunggu: jumlah.DIKIRIM ?? 0,
    perluRevisi: jumlah.PERLU_REVISI ?? 0,
    disetujui: jumlah.DISETUJUI ?? 0,
    difinalkan: jumlah.DIFINALKAN ?? 0,
  };
}

/**
 * Bobot prioritas item "Perlu Tindakan": makin kecil makin didahulukan.
 * PERLU_REVISI lebih tinggi daripada draf biasa; DIKIRIM (untuk pemeriksa)
 * berada di antaranya.
 */
export const BOBOT_PRIORITAS_TINDAKAN: Record<StatusDokumen, number> = {
  PERLU_REVISI: 0,
  DIKIRIM: 1,
  DRAF: 2,
  DISETUJUI: 3,
  DIFINALKAN: 4,
  DIARSIPKAN: 5,
};

export function urutPrioritasTindakan<T extends { status: StatusDokumen }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => BOBOT_PRIORITAS_TINDAKAN[a.status] - BOBOT_PRIORITAS_TINDAKAN[b.status]
  );
}

/** Urutkan berdasarkan prioritas status lalu batasi maksimal n item. */
export function pilihPerluTindakan<T extends { status: StatusDokumen }>(items: T[], maks = 5): T[] {
  return urutPrioritasTindakan(items).slice(0, maks);
}

/** Gabungkan daftar item dari beberapa query, buang duplikat id, urut prioritas, batasi. */
export function gabungPerluTindakan<T extends { id: string; status: StatusDokumen }>(
  kelompok: T[][],
  maks = 5
): T[] {
  const lihat = new Map<string, T>();
  for (const daftar of kelompok) {
    for (const item of daftar) {
      if (!lihat.has(item.id)) lihat.set(item.id, item);
    }
  }
  return pilihPerluTindakan([...lihat.values()], maks);
}

// ====== Filter & pencarian Dokumen Saya (server-side via searchParams) ======

export type NilaiFilterDokumen = "semua" | "draf" | "dikirim" | "perlu_revisi" | "disetujui" | "difinalkan";

export type OpsiFilterDokumen = {
  nilai: NilaiFilterDokumen;
  label: string;
  statuses: readonly StatusDokumen[];
};

/** Filter status Dokumen Saya. "difinalkan" mencakup arsip agar tetap bisa dicari. */
export const OPSI_FILTER_DOKUMEN: readonly OpsiFilterDokumen[] = [
  { nilai: "semua", label: "Semua", statuses: [] },
  { nilai: "draf", label: "Draf", statuses: ["DRAF"] },
  { nilai: "dikirim", label: "Dikirim", statuses: ["DIKIRIM"] },
  { nilai: "perlu_revisi", label: "Perlu Revisi", statuses: ["PERLU_REVISI"] },
  { nilai: "disetujui", label: "Disetujui", statuses: ["DISETUJUI"] },
  { nilai: "difinalkan", label: "Difinalkan", statuses: ["DIFINALKAN", "DIARSIPKAN"] },
];

export function opsiFilterDokumen(nilai: string | null | undefined): OpsiFilterDokumen {
  return (
    OPSI_FILTER_DOKUMEN.find((o) => o.nilai === nilai) ??
    // Nilai asing/kosong kembali ke Semua.
    OPSI_FILTER_DOKUMEN[0]
  );
}

/** Bersihkan parameter pencarian; hasil kosong → null (tanpa kondisi query). */
export function bersihkanQueryCarian(raw: string | null | undefined): string | null {
  const q = (raw ?? "").trim();
  return q.length > 0 ? q : null;
}

export type WhereDokumenSaya = Prisma.DokumenWhereInput;

/**
 * Where aman untuk daftar dokumen milik pengguna.
 * - Selalu dibatasi pengajuUserId (data orang lain tidak pernah bocor).
 * - Filter valid menambah kondisi status; "semua" tanpa kondisi status.
 * - Pencarian kosong tidak menambah kondisi judul.
 */
export function bangunWhereDokumenSaya(
  pengajuUserId: string,
  filterNilai: string | null | undefined,
  qRaw: string | null | undefined
): WhereDokumenSaya {
  const where: WhereDokumenSaya = { pengajuUserId };
  const { statuses } = opsiFilterDokumen(filterNilai);
  if (statuses.length > 0) where.status = { in: [...statuses] };
  const q = bersihkanQueryCarian(qRaw);
  if (q) where.judul = { contains: q };
  return where;
}

// ====== Indikator tampilan per status ======

export type IndikatorAksi = { label: string; tonal: "amber" | "blue" | "slate" };

/** Label kecil pada kartu dokumen yang menandai tindakan yang diperlukan. */
export function indikatorStatus(status: StatusDokumen): IndikatorAksi | null {
  switch (status) {
    case "PERLU_REVISI":
      return { label: "Perlu revisi Anda", tonal: "amber" };
    case "DRAF":
      return { label: "Lengkapi & kirim", tonal: "slate" };
    case "DIKIRIM":
      return { label: "Menunggu pemeriksaan", tonal: "blue" };
    default:
      return null;
  }
}

/** Label singkat alur dokumen di dashboard. */
export const ALUR_DOKUMEN: readonly string[] = [
  STATUS_DOKUMEN_LABEL.DRAF,
  "Unggah",
  STATUS_DOKUMEN_LABEL.DIKIRIM,
  "Diperiksa",
  STATUS_DOKUMEN_LABEL.DISETUJUI,
  STATUS_DOKUMEN_LABEL.DIFINALKAN,
];

// ====== Aturan href & label item "Perlu Tindakan" di dashboard ======
// Tujuan & label ditentukan oleh konteks item (pribadi vs kotak-masuk),
// bukan oleh status — agar item DIKIRIM milik pengaju tidak salah diarahkan.

export type KonteksItemTindakan = "pribadi" | "kotak-masuk";

export function hrefItemTindakan(id: string, konteks: KonteksItemTindakan): string {
  return konteks === "kotak-masuk"
    ? `/administrasi/kotak-masuk/${id}`
    : `/administrasi/${id}`;
}

export function labelAksiItemTindakan(
  konteks: KonteksItemTindakan,
  status: StatusDokumen
): string {
  if (konteks === "kotak-masuk") return "Periksa sekarang";
  if (status === "PERLU_REVISI") return "Perbaiki & kirim ulang";
  return "Lanjutkan draf";
}

// ====== Aturan href tab statistik (Kotak Masuk) ======
// Setiap kartu statistik pemeriksa membuka tab yang sesuai sehingga klik
// langsung ke antrean yang relevan — bukan ke tab default Menunggu.

export type NilaiTabPemeriksa =
  | "menunggu"
  | "perlu_revisi"
  | "disetujui"
  | "difinalkan";

export function hrefTabKotakMasuk(tab: NilaiTabPemeriksa): string {
  // Tab default "menunggu" tidak butuh query string (sesuai helper halaman tujuan).
  if (tab === "menunggu") return "/administrasi/kotak-masuk";
  return `/administrasi/kotak-masuk?tab=${tab}`;
}

// ====== Antrean lembaga: hanya dokumen yang siap ditangani pemeriksa ======
// - Maksimal N entri.
// - DIKIRIM paling lama menunggu di atas (updatedAt menaik).
// - Dokumen milik sendiri tetap di antrean (tidak dihapus) agar tidak hilang
//   dari antrean lembaga, tetapi ditandai "Menunggu pemeriksa lain".

export type ItemAntrean = {
  id: string;
  judul: string;
  updatedAt: Date;
  pengajuUserId: string;
  milikSendiri: boolean;
};

export function urutAntreanLembaga(
  items: readonly { id: string; updatedAt: Date | string }[],
  maks = 5
): { id: string; updatedAt: Date }[] {
  return [...items]
    .map((i) => ({ id: i.id, updatedAt: i.updatedAt instanceof Date ? i.updatedAt : new Date(i.updatedAt) }))
    .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
    .slice(0, maks);
}

export function labelAksiAntrean(milikSendiri: boolean): string {
  return milikSendiri ? "Menunggu pemeriksa lain" : "Periksa sekarang";
}

// ====== Statistik ringkas untuk kartu dashboard pemeriksa ======
// Menjaga label & urutan kartu konsisten dengan halaman Kotak Masuk.

export type KartuStatistikPemeriksa = {
  tab: NilaiTabPemeriksa;
  label: string;
  nilai: number;
};

export function bangunKartuStatistikPemeriksa(
  jumlah: JumlahPerStatus
): KartuStatistikPemeriksa[] {
  return [
    { tab: "menunggu", label: "Menunggu Tindakan", nilai: jumlah.DIKIRIM ?? 0 },
    { tab: "perlu_revisi", label: "Menunggu Perbaikan Guru", nilai: jumlah.PERLU_REVISI ?? 0 },
    { tab: "disetujui", label: "Disetujui / Perlu Finalisasi", nilai: jumlah.DISETUJUI ?? 0 },
    { tab: "difinalkan", label: "Difinalkan", nilai: (jumlah.DIFINALKAN ?? 0) + (jumlah.DIARSIPKAN ?? 0) },
  ];
}

// ====== Copy role-aware untuk header dashboard ======

export function copyHeaderDashboard(role: string): { eyebrow: string; subtitle: string } {
  if (role === "KEPALA" || role === "ADMIN" || role === "SUPERADMIN") {
    return {
      eyebrow: "Ruang kerja pemeriksa",
      subtitle:
        "Pantau pengajuan guru, lakukan pemeriksaan, dan finalisasi dokumen yang telah disetujui.",
    };
  }
  return {
    eyebrow: "Rumah Administrasi",
    subtitle: "Kelola dokumen administrasi Anda mulai dari draf hingga difinalkan.",
  };
}
