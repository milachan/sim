import { prisma } from "@/lib/prisma";
import { mulaiHari } from "@/lib/utils";

/** Data minimal semester yang cukup untuk resolusi tanggal (murni, tanpa DB). */
export type SemesterRingkas = {
  id: string;
  aktif: boolean;
  mulai: Date | null;
  selesai: Date | null;
  tahunAjaranId: string;
};

export type HasilResolusiSemester = {
  /** Semester terpilih secara deterministik, atau null bila tak ada yang cocok. */
  semester: SemesterRingkas | null;
  /** Semua semester yang rentangnya mencakup tanggal (untuk deteksi ambigu). */
  kandidat: SemesterRingkas[];
  /** true bila lebih dari satu semester cocok untuk tanggal yang sama. */
  ambigu: boolean;
  /** Semester tanpa rentang mulai/selesai — tidak bisa di-resolve ke tanggal. */
  tanpaRentang: SemesterRingkas[];
};

/**
 * Resolusi semester untuk sebuah tanggal — MURNI (tanpa I/O) sehingga mudah
 * diuji. Tidak memakai flag `aktif`, tidak mengubah apa pun.
 *
 * Aturan deterministik bila tumpang tindih:
 * 1. pilih semester dengan `mulai` paling akhir (paling relevan ke tanggal),
 * 2. lalu yang `selesai` paling awal (rentang paling sempit),
 * 3. lalu urutan id untuk memastikan hasil selalu sama.
 */
export function resolusiSemesterUntukTanggal(
  tanggal: Date,
  semesters: SemesterRingkas[]
): HasilResolusiSemester {
  const t = mulaiHari(tanggal);
  const tanpaRentang = semesters.filter((s) => !s.mulai || !s.selesai);
  const kandidat = semesters
    .filter((s) => s.mulai && s.selesai && s.mulai.getTime() <= t.getTime() && s.selesai.getTime() >= t.getTime())
    .sort(
      (a, b) =>
        b.mulai!.getTime() - a.mulai!.getTime() ||
        a.selesai!.getTime() - b.selesai!.getTime() ||
        (a.id < b.id ? -1 : 1)
    );
  return {
    semester: kandidat[0] ?? null,
    kandidat,
    ambigu: kandidat.length > 1,
    tanpaRentang,
  };
}

/**
 * Cari semester yang berlaku pada sebuah tanggal — READ-ONLY.
 * - Tidak melihat/bergantung pada flag `aktif` (semester yang diarsipkan pun
 *   tetap ditemukan bila rentang tanggalnya cocok).
 * - Tidak mengubah flag `aktif` (tidak seperti `cariSemesterAktif`).
 */
export async function cariSemesterUntukTanggal(tanggal: Date): Promise<HasilResolusiSemester> {
  const semesters = await prisma.semester.findMany({
    where: { deletedAt: null },
    select: { id: true, aktif: true, mulai: true, selesai: true, tahunAjaranId: true },
  });
  return resolusiSemesterUntukTanggal(tanggal, semesters);
}

/**
 * Cari semester yang sedang berlaku (untuk pergantian jadwal berkala).
 * Prioritas:
 *   1. Periode yang sedang aktif (flag `aktif`) — dihormati selama tanggal
 *      berlakunya belum lewat (`selesai` belum terlewati). Dengan begitu
 *      pilihan manual lewat tombol "Aktifkan" / "Langsung aktifkan" tidak
 *      langsung dibatalkan oleh pergantian otomatis berdasarkan tanggal.
 *   2. Bila periode aktif sudah berakhir (atau tidak ada yang aktif): cari
 *      periode ber-tanggal yang mencakup hari ini — diutamakan yang tahun
 *      ajarannya aktif, lalu yang tanggal mulainya paling baru.
 *   3. Fallback: periode yang aktif (walau tanggalnya sudah lewat), atau null.
 * Bila pilihan dari tanggal berbeda dengan flag saat ini, flag disinkronkan
 * agar query lain yang memakai `semester: { aktif: true }` ikut benar.
 */
export async function cariSemesterAktif() {
  const semua = await prisma.semester.findMany({ where: { deletedAt: null }, include: { tahunAjaran: true } });
  if (!semua.length) return null;
  const hariIni = mulaiHari();
  const aktif = semua.find((s) => s.aktif);

  // 1. Periode aktif masih berlaku → hormati pilihan manual saat ini.
  if (aktif && (aktif.selesai ? aktif.selesai >= hariIni : true)) {
    return aktif;
  }

  // 2. Periode aktif berakhir / belum ada → cari pengganti berdasarkan tanggal.
  const berlaku = semua
    .filter((s) => (s.mulai ? s.mulai <= hariIni : true) && (s.selesai ? s.selesai >= hariIni : true))
    .sort((a, b) => (a.mulai?.getTime() ?? 0) - (b.mulai?.getTime() ?? 0));

  const kandidatTA = berlaku.filter((s) => s.tahunAjaran.aktif);
  const pool = kandidatTA.length > 0 ? kandidatTA : berlaku;
  const pilihan = pool[pool.length - 1] ?? null;
  if (!pilihan) return aktif ?? null;

  // Sinkronkan flag aktif bila semester terpilih dari tanggal belum ditandai aktif
  if (!pilihan.aktif) {
    await prisma.$transaction([
      prisma.semester.updateMany({ where: { deletedAt: null }, data: { aktif: false } }),
      prisma.semester.update({ where: { id: pilihan.id }, data: { aktif: true } }),
    ]);
    pilihan.aktif = true;
  }
  return pilihan;
}
