import { prisma } from "@/lib/prisma";
import { HARI, jamPembukaHari } from "@/lib/constants";
import { mulaiHari } from "@/lib/utils";
import { cariSemesterUntukTanggal } from "@/lib/semester";
import { cariWaliKelasPadaTanggal } from "@/lib/wali-kelas";
import type { Hari, PeranPengisiAbsensi } from "@prisma/client";

const STATUS_VALID: ReadonlySet<string> = new Set(["HADIR", "SAKIT", "IZIN", "ALPA", "TERLAMBAT", "DISPENSASI"]);

export function hariDariTanggal(tanggal: Date): Hari | null {
  const wib = new Date(tanggal.getTime() + 7 * 60 * 60 * 1000);
  const index = (wib.getUTCDay() + 6) % 7;
  return HARI[index] ?? null;
}

export function perluBuatPertemuanHariIni(hari: Hari | null, jadwalIds: string[], sudahAdaIds: string[]): string[] {
  if (!hari) return [];
  return jadwalIds.filter((id) => !sudahAdaIds.includes(id));
}

/**
 * Guru pemegang jadwal pada JAM PEMBUKA hari untuk kelas & tanggal tertentu
 * (jam ke-1; Senin jam ke-2 karena jam ke-1 dipakai upacara).
 * Kelas yang hari itu tidak punya jadwal di jam pembuka (mulai jam ke-3 dst.)
 * mengembalikan null — kelas tersebut tidak memiliki guru jam pertama.
 */
export async function cariGuruJamPertama(
  kelasId: string,
  tanggal: Date,
  opts?: { semesterId?: string | null }
): Promise<{ guruId: string; guru: { nama: string }; mapel: { nama: string }; kelas: { nama: string } } | null> {
  const hari = hariDariTanggal(tanggal);
  if (!hari) return null;
  let semesterId = opts?.semesterId ?? null;
  let masalah: string | null = null;
  if (!semesterId) {
    const resolusi = await cariSemesterUntukTanggal(tanggal);
    if (resolusi.ambigu) {
      masalah = "Beberapa periode (semester) memiliki rentang tanggal yang sama untuk tanggal ini. Periksa konfigurasi tahun ajaran & periode.";
    } else if (!resolusi.semester) {
      if (resolusi.tanpaRentang.length > 0) {
        masalah = "Rentang tanggal periode (semester) belum dilengkapi admin untuk tanggal ini.";
      } else {
        masalah = "Tidak ada periode (semester) yang berlaku pada tanggal ini.";
      }
    } else {
      semesterId = resolusi.semester.id;
    }
  }
  if (masalah) return null;
  return prisma.jadwal.findFirst({
    where: { kelasId, hari, jamKeMulai: jamPembukaHari(hari), semesterId: semesterId! },
    orderBy: [{ id: "asc" }],
    include: { guru: true, mapel: true, kelas: true },
  });
}

export { cariSemesterUntukTanggal };

export async function daftarGuruPiketIds(): Promise<Set<string>> {
  const gurus = await prisma.guru.findMany({
    where: { jenisGuru: "PIKET", status: true, deletedAt: null },
    select: { id: true },
  });
  return new Set(gurus.map((g) => g.id));
}

export type FaktaPeranPengisi = {
  guruJamPertamaId: string | null;
  waliKelasGuruId: string | null;
  piketIds: ReadonlySet<string>;
};

/**
 * Keputusan peran pengisi Absensi Harian (MURNI — mudah dites tanpa DB).
 *
 * Prinsip akses gabungan:
 * - Hak ditentukan kecocokan user.guruId, BUKAN role WAKA itu sendiri —
 *   WAKA tidak memperoleh hak atas kelas Guru lain hanya karena role-nya.
 * - GURU atau WAKA terhubung boleh mengisi bila: guru jam pertama, wali kelas
 *   pada periode tersebut, atau guru piket.
 * - WAKA/GURU tanpa guruId ditolak (pemantauan saja).
 * - KEPALA read-only dan TIDAK pernah boleh mengisi.
 * - ADMIN/SUPERADMIN mengikuti aturan saat ini: backup seperti guru piket.
 */
export function putuskanPeranPengisi(
  user: { role: string; guruId: string | null },
  fakta: FaktaPeranPengisi
): PeranPengisiAbsensi | null {
  if (user.role === "ADMIN" || user.role === "SUPERADMIN") return "GURU_PIKET";
  if (user.role !== "GURU" && user.role !== "WAKA") return null;
  if (!user.guruId) return null;
  if (fakta.guruJamPertamaId && fakta.guruJamPertamaId === user.guruId) return "GURU_JAM_PERTAMA";
  if (fakta.waliKelasGuruId && fakta.waliKelasGuruId === user.guruId) return "WALI_KELAS";
  if (fakta.piketIds.has(user.guruId)) return "GURU_PIKET";
  return null;
}

/** Versi DB: kumpulkan fakta kelas/tanggal lalu putuskan via putuskanPeranPengisi. */
export async function tentukanPeranPengisi(
  user: { id: string; role: string; guruId: string | null },
  kelasId: string,
  tanggal: Date,
  opts?: { semesterId?: string | null }
): Promise<PeranPengisiAbsensi | null> {
  if (user.role === "ADMIN" || user.role === "SUPERADMIN") return "GURU_PIKET";
  if ((user.role !== "GURU" && user.role !== "WAKA") || !user.guruId) return null;
  const guruJP = await cariGuruJamPertama(kelasId, tanggal, opts);
  const wali = await cariWaliKelasPadaTanggal(kelasId, tanggal, opts);
  const piketIds = await daftarGuruPiketIds();
  return putuskanPeranPengisi(user, {
    guruJamPertamaId: guruJP?.guruId ?? null,
    waliKelasGuruId: wali,
    piketIds,
  });
}

export type HasilValidasiKelengkapan = {
  ok: boolean;
  total: number;
  ditandai: number;
  belum: number;
  belumIds: string[];
  duplikatIds: string[];
  siswaLainIds: string[];
  statusTidakValid: string[];
  pesan: string | null;
};

export function validasiKelengkapanAbsensiHarian(
  entries: { siswaId: string; status: string }[],
  siswaAktifIds: string[]
): HasilValidasiKelengkapan {
  const aktifSet = new Set(siswaAktifIds);
  const seen = new Set<string>();
  const duplikatIds: string[] = [];
  const siswaLainIds: string[] = [];
  const statusTidakValid: string[] = [];
  for (const e of entries) {
    if (!STATUS_VALID.has(e.status)) statusTidakValid.push(e.siswaId);
    if (seen.has(e.siswaId)) duplikatIds.push(e.siswaId);
    else seen.add(e.siswaId);
    if (!aktifSet.has(e.siswaId)) siswaLainIds.push(e.siswaId);
  }
  const belumIds = siswaAktifIds.filter((id) => !seen.has(id));
  const total = siswaAktifIds.length;
  const ditandai = seen.size;
  const belum = belumIds.length;
  let pesan: string | null = null;
  let ok = true;
  if (statusTidakValid.length > 0) {
    ok = false;
    pesan = "Terdapat status kehadiran yang tidak valid.";
  } else if (duplikatIds.length > 0) {
    ok = false;
    pesan = `Terdapat ID siswa duplikat: ${[...new Set(duplikatIds)].join(", ")}.`;
  } else if (siswaLainIds.length > 0) {
    ok = false;
    pesan = "Terdapat siswa yang tidak terdaftar di kelas ini.";
  } else if (belum > 0) {
    ok = false;
    pesan = `Absensi Harian belum lengkap. Masih ada ${belum} siswa yang belum diberi status.`;
  }
  if (ok) pesan = null;
  return { ok, total, ditandai, belum, belumIds, duplikatIds: [...new Set(duplikatIds)], siswaLainIds: [...new Set(siswaLainIds)], statusTidakValid: [...new Set(statusTidakValid)], pesan };
}

export async function apakahGuruJamPertama(
  user: { id: string; role: string; guruId: string | null },
  kelasId: string,
  tanggal: Date,
  opts?: { semesterId?: string | null }
): Promise<boolean> {
  if ((user.role !== "GURU" && user.role !== "WAKA") || !user.guruId) return false;
  const guruJP = await cariGuruJamPertama(kelasId, tanggal, opts);
  return !!guruJP && guruJP.guruId === user.guruId;
}

export async function detailKelengkapanAbsensiHarian(
  kelasId: string,
  tanggal: Date
): Promise<{ ada: boolean; lengkap: boolean; total: number; terisi: number; belum: number; validasi: HasilValidasiKelengkapan | null; recordId: string | null }> {
  const hariIni = mulaiHari(tanggal);
  const [siswaAktif, record] = await Promise.all([
    prisma.siswa.findMany({ where: { kelasId, status: "AKTIF", deletedAt: null }, select: { id: true } }),
    prisma.absensiHarian.findUnique({ where: { kelasId_tanggal: { kelasId, tanggal: hariIni } }, include: { item: true } }),
  ]);
  const aktifIds = siswaAktif.map((s) => s.id);
  if (!record) {
    const v = validasiKelengkapanAbsensiHarian([], aktifIds);
    return { ada: false, lengkap: false, total: aktifIds.length, terisi: 0, belum: aktifIds.length, validasi: v, recordId: null };
  }
  const entries = record.item.map((it) => ({ siswaId: it.siswaId, status: it.status }));
  const v = validasiKelengkapanAbsensiHarian(entries, aktifIds);
  return { ada: true, lengkap: v.ok, total: v.total, terisi: v.ditandai, belum: v.belum, validasi: v, recordId: record.id };
}

export async function apakahAbsensiHarianLengkap(kelasId: string, tanggal: Date): Promise<boolean> {
  const d = await detailKelengkapanAbsensiHarian(kelasId, tanggal);
  return d.lengkap;
}

export async function apakahAbsensiHarianAda(kelasId: string, tanggal: Date): Promise<boolean> {
  const d = await detailKelengkapanAbsensiHarian(kelasId, tanggal);
  return d.ada;
}

export async function cekWajibAbsenSebelumJurnal(
  user: { id: string; role: string; guruId: string | null },
  kelasId: string | null | undefined,
  tanggal: Date,
  opts?: { semesterId?: string | null }
): Promise<string | null> {
  if ((user.role !== "GURU" && user.role !== "WAKA") || !user.guruId || !kelasId) return null;
  const guruJP = await cariGuruJamPertama(kelasId, tanggal, opts);
  if (!guruJP) return null;
  if (guruJP.guruId !== user.guruId) return null;
  const detail = await detailKelengkapanAbsensiHarian(kelasId, tanggal);
  if (detail.lengkap) return null;
  if (!detail.ada) return "Anda guru jam pertama kelas ini — isi Absensi Harian kelas terlebih dahulu sebelum mengirim jurnal.";
  return detail.validasi?.pesan ?? "Absensi Harian belum lengkap. Lengkapi terlebih dahulu sebelum mengirim jurnal.";
}

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function hitungBadgeIncomplete(kelasJamPertamaGuruIds: string[], validasiByKelas: Map<string, { lengkap: boolean }>): number {
  let count = 0;
  for (const id of kelasJamPertamaGuruIds) {
    const v = validasiByKelas.get(id);
    if (!v || !v.lengkap) count++;
  }
  return count;
}

export async function hitungBadgeAbsensiHarian(guruId: string, tanggal: Date): Promise<number> {
  const hari = hariDariTanggal(tanggal);
  if (!hari) return 0;
  const resolusi = await cariSemesterUntukTanggal(tanggal);
  if (resolusi.ambigu || !resolusi.semester) return 0;
  const semesterId = resolusi.semester.id;
  // Guru jam pertama = pemegang jadwal pada jam pembuka hari itu saja.
  const jadwalHariIni = await prisma.jadwal.findMany({
    where: { hari, semesterId, jamKeMulai: jamPembukaHari(hari) },
    orderBy: [{ kelasId: "asc" }, { id: "asc" }],
    select: { kelasId: true, guruId: true, jamKeMulai: true },
  });
  const jamPertamaByKelas = new Map<string, string>();
  for (const j of jadwalHariIni) {
    if (!jamPertamaByKelas.has(j.kelasId)) jamPertamaByKelas.set(j.kelasId, j.guruId);
  }
  const kelasKewajiban = [...jamPertamaByKelas.entries()].filter(([, g]) => g === guruId).map(([k]) => k);
  if (kelasKewajiban.length === 0) return 0;
  let belum = 0;
  for (const kelasId of kelasKewajiban) {
    const detail = await detailKelengkapanAbsensiHarian(kelasId, tanggal);
    if (!detail.lengkap) belum++;
  }
  return belum;
}
