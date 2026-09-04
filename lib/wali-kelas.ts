import { prisma } from "@/lib/prisma";
import { mulaiHari } from "@/lib/utils";

/** Data minimum riwayat yang cukup untuk resolusi (murni, tanpa DB). */
export type RiwayatWaliRingkas = {
  id: string;
  kelasId: string;
  guruId: string;
  semesterId: string | null;
  mulai: Date;
  selesai: Date | null;
};

/**
 * Pilih wali kelas sebuah kelas pada tangal tertentu — MURNI (tanpa I/O).
 *
 * Prioritas:
 * 1. riwayat yang rentang temporalnya mencakup tanggal (mulai ≤ t, dan
 *    selesai = null atau selesai ≥ t),
 * 2. di antara kandidat, yang `semesterId`-nya cocok dengan semester terpilih,
 * 3. urutan deterministik: mulainya paling akhir, lalu id.
 *
 * Mengembalikan `guruId` wali kala itu, atau null bila tidak ada riwayat
 * yang aktif pada tanggal tsb.
 */
export function pilihWaliKelasPadaTanggal(
  riwayat: RiwayatWaliRingkas[],
  tanggal: Date,
  semesterId?: string | null
): string | null {
  const t = mulaiHari(tanggal);
  const temporal = riwayat.filter(
    (r) => r.mulai.getTime() <= t.getTime() && (!r.selesai || r.selesai.getTime() >= t.getTime())
  );
  if (temporal.length === 0) return null;

  if (semesterId) {
    const cocokSemester = temporal.find((r) => r.semesterId === semesterId);
    if (cocokSemester) return cocokSemester.guruId;
  }

  const terpilih = [...temporal].sort(
    (a, b) => b.mulai.getTime() - a.mulai.getTime() || (a.id < b.id ? -1 : 1)
  )[0];
  return terpilih.guruId ?? null;
}

/**
 * Wali kelas yang memegang sebuah kelas pada tanggal tertentu.
 * Sumber utama: `WaliKelasRiwayat` (temporal + semesterId). `Kelas.waliKelasId`
 * TIDAK dipakai di sini agar wali kelas saat ini tidak otomatis memperoleh hak
 * untuk periode historis.
 */
export async function cariWaliKelasPadaTanggal(
  kelasId: string,
  tanggal: Date,
  opts?: { semesterId?: string | null }
): Promise<string | null> {
  const riwayat = await prisma.waliKelasRiwayat.findMany({
    where: { kelasId },
    select: { id: true, kelasId: true, guruId: true, semesterId: true, mulai: true, selesai: true },
  });
  return pilihWaliKelasPadaTanggal(riwayat, tanggal, opts?.semesterId);
}

/**
 * Peta wali kelas (kelasId → guruId) untuk BANYAK kelas pada satu tanggal.
 * Dipakai halaman daftar absensi agar tidak query per kelas.
 */
export type PetaWaliKelasTanggal = Map<string, string>;

export async function petaWaliKelasPadaTanggal(
  kelasIds: string[],
  tanggal: Date,
  opts?: { semesterId?: string | null }
): Promise<PetaWaliKelasTanggal> {
  if (kelasIds.length === 0) return new Map();
  const riwayat = await prisma.waliKelasRiwayat.findMany({
    where: { kelasId: { in: kelasIds } },
    select: { id: true, kelasId: true, guruId: true, semesterId: true, mulai: true, selesai: true },
  });
  const peta = new Map<string, string>();
  const perKelas = new Map<string, RiwayatWaliRingkas[]>();
  for (const r of riwayat) {
    const list = perKelas.get(r.kelasId) ?? [];
    list.push(r);
    perKelas.set(r.kelasId, list);
  }
  for (const kita of kelasIds) {
    const guru = pilihWaliKelasPadaTanggal(perKelas.get(kita) ?? [], tanggal, opts?.semesterId);
    if (guru) peta.set(kita, guru);
  }
  return peta;
}

/**
 * Daftar kelas yang pernah / sedang diwalikan seorang guru pada sebuah
 * semester — untuk rekap haK wali kelas historis.
 *
 * - Riwayat yang `semesterId`-nya sama persis → selalu disertakan.
 * - Riwayat tanpa semesterId tapi rentangnya tumpang tindih dengan rentang
 *   semester terpilih → disertakan (kompatibilitas data lama).
 */
export async function cariKelasWaliGuruPadaSemester(
  guruId: string,
  semester: { id: string; mulai: Date | null; selesai: Date | null } | null
): Promise<string[]> {
  const semuaRiwayat = await prisma.waliKelasRiwayat.findMany({
    where: { guruId },
    select: { kelasId: true, semesterId: true, mulai: true, selesai: true },
  });

  const hasil = new Set<string>();
  for (const r of semuaRiwayat) {
    if (semester && r.semesterId === semester.id) {
      hasil.add(r.kelasId);
      continue;
    }
    // Data lama tanpa semesterId: pakai tumpang tindih rentang bila tersedia.
    if (r.semesterId === null && semester?.mulai && semester.selesai) {
      const sMulai = mulaiHari(semester.mulai).getTime();
      const sSelesai = mulaiHari(semester.selesai).getTime();
      const rMulai = mulaiHari(r.mulai).getTime();
      const rSelesai = r.selesai ? mulaiHari(r.selesai).getTime() : Number.MAX_SAFE_INTEGER;
      const tumpangTindih = rMulai <= sSelesai && rSelesai >= sMulai;
      if (tumpangTindih) hasil.add(r.kelasId);
    }
  }

  // Fallback terbatas: kelas yang hari ini diwalikan guru tsb namun belum punya
  // riwayat sama sekali (data lama sebelum fitur riwayat). Tidak menaikkan hak
  // guru yang riwayatnya sudah tercatat di periode lain.
  if (semester) {
    const tanpaRiwayat = await prisma.kelas.findMany({
      where: { waliKelasId: guruId, waliRiwayat: { none: {} } },
      select: { id: true },
    });
    for (const k of tanpaRiwayat) hasil.add(k.id);
  } else {
    const sekarang = await prisma.kelas.findMany({ where: { waliKelasId: guruId }, select: { id: true } });
    for (const k of sekarang) hasil.add(k.id);
  }
  return [...hasil];
}

/**
 * Catat pergantian wali kelas pada riwayat.
 * - Riwayat lama yang masih aktif (`selesai = null`) ditutup.
 * - Bila ada guru baru, riwayat baru dibuka dengan semester terkait (opsional).
 *
 * Sekaligus sinkronkan `jenisGuru` guru:
 * - Guru yang baru ditunjuk → WALI_KELAS (kecuali jenis manual PIKET/BK yang lebih spesifik).
 * - Guru yang dicabut dan tidak lagi menjadi wali kelas mana pun → kembali BIASA.
 */
export async function catatRiwayatWaliKelas(
  kelasId: string,
  guruIdBaru: string | null,
  semesterId?: string | null,
  guruIdLama?: string | null
) {
  await prisma.waliKelasRiwayat.updateMany({
    where: { kelasId, selesai: null },
    data: { selesai: new Date() },
  });
  if (guruIdBaru) {
    await prisma.waliKelasRiwayat.create({
      data: { kelasId, guruId: guruIdBaru, semesterId: semesterId ?? null },
    });
  }

  // Sinkron jenisGuru: guru yang baru jadi wali kelas.
  if (guruIdBaru) {
    await prisma.guru.updateMany({
      where: { id: guruIdBaru, jenisGuru: "BIASA" },
      data: { jenisGuru: "WALI_KELAS" },
    });
  }

  // Guru lama yang dicabut: jika tidak lagi menjadi wali kelas kelas mana pun → BIASA.
  const guruLama = guruIdLama && guruIdLama !== guruIdBaru ? guruIdLama : null;
  if (guruLama) {
    const masihWali = await prisma.kelas.count({ where: { waliKelasId: guruLama } });
    if (masihWali === 0) {
      await prisma.guru.updateMany({
        where: { id: guruLama, jenisGuru: "WALI_KELAS" },
        data: { jenisGuru: "BIASA" },
      });
    }
  }
}
