import { prisma } from "./prisma";
import { mulaiHari } from "./utils";
import { hariDariTanggal } from "./absensi-harian";
import type { Hari, Prisma } from "@prisma/client";

// Format tanggal sebagai YYYY-MM-DD. Kolom `tanggal` bertipe DATE MySQL, dan semua
// nilai tanggal dinormalisasi ke tengah malam UTC, sehingga pemformatan memakai
// komponen UTC agar cocok dengan string yang ditulis Prisma ke database.
function tanggalSQL(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const t = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${t}`;
}

export type RencanaPertemuanOtomatis = {
  /** Total slot jadwal×tanggal yang "seharusnya ada" dalam rentang. */
  slotTotal: number;
  /** Slot yang sudah punya pertemuan otomatis. */
  sudahAda: number;
  /** Slot tanpa pertemuan otomatis; inilah yang akan dibuat. */
  belumAda: number;
  /** Tanggal yang dilewati karena KalenderAkademik LIBUR. */
  libur: string[];
  /** Jumlah tanggal yang dilewati karena Minggu. */
  minggu: number;
  /** Pertemuan otomatis yang terlanjur ada di tanggal libur (dilaporkan, tidak dihapus). */
  anomaliLibur: { jadwalId: string | null; tanggal: string }[];
  /** Rencana baris yang akan dibuat (jadwalId, tanggal, pertemuanKe). */
  buat: { jadwalId: string; tanggal: Date; pertemuanKe: number }[];
  /** jadwal yang perlu dinormalkan ulang nomor pertemuan otomatisnya. */
  perluNormalisasi: string[];
};

type BahanRencana = {
  semesters: { id: string; tahunAjaranId: string; mulai: Date | null; selesai: Date | null }[];
  jadwals: { id: string; semesterId: string; hari: Hari }[];
  libur: { tanggal: Date; tahunAjaranId: string | null }[];
  existing: { id: string; jadwalId: string | null; tanggal: Date; pertemuanKe: number; sumber: string }[];
  sampai: Date;
  namaHari: (d: Date) => Hari | null;
};

/**
 * Rencana pertemuan otomatis — MURNI (tanpa I/O), mudah diuji.
 *
 * Aturan:
 * - hanya tanggal pada hari jadwal (Senin–Sabtu sesuai Jadwal.hari),
 * - dalam rentang [semester.mulai, semester.selesai] dan tidak melewati `sampai`,
 * - bukan Minggu,
 * - bukan KalenderAkademik LIBUR (tahunAjaranId cocok atau null = umum),
 * - satu jadwal×tanggal maksimal satu pertemuan (unique di DB).
 *
 * `pertemuanKe` dihitung posisi kronologis per jadwal (hanya pertemuan OTOMATIS;
 * pertemuan manual memakai pertemuanKe 0 dan tidak ikut dinomori ulang).
 */
export function rencanaPertemuanOtomatis(b: BahanRencana): RencanaPertemuanOtomatis {
  // Kalender umum (tanpa tahunAjaranId) berlaku untuk semua semester.
  const liburSet = new Set(b.libur.filter((x) => !x.tahunAjaranId).map((x) => tanggalSQL(x.tanggal)));
  // Key "tahunAjaranId|tanggal" untuk kalender yang spesifik tahun ajaran:
  const liburSpesifik = new Set(
    b.libur.filter((x) => x.tahunAjaranId).map((x) => `${x.tahunAjaranId}|${tanggalSQL(x.tanggal)}`)
  );

  const existingByJadwal = new Map<string, { id: string; tanggal: Date; pertemuanKe: number }[]>();
  const existingKey = new Set<string>();
  for (const e of b.existing) {
    if (!e.jadwalId) continue;
    if (e.sumber !== "OTOMATIS") continue;
    existingKey.add(`${e.jadwalId}|${tanggalSQL(e.tanggal)}`);
    const list = existingByJadwal.get(e.jadwalId) ?? [];
    list.push({ id: e.id, tanggal: e.tanggal, pertemuanKe: e.pertemuanKe });
    existingByJadwal.set(e.jadwalId, list);
  }

  const jadwalBySemester = new Map<string, typeof b.jadwals>();
  for (const j of b.jadwals) {
    const list = jadwalBySemester.get(j.semesterId) ?? [];
    list.push(j);
    jadwalBySemester.set(j.semesterId, list);
  }

  const hasil: RencanaPertemuanOtomatis = {
    slotTotal: 0,
    sudahAda: 0,
    belumAda: 0,
    libur: [],
    minggu: 0,
    anomaliLibur: [],
    buat: [],
    perluNormalisasi: [],
  };

  for (const smt of b.semesters) {
    const jadwalsSemester = jadwalBySemester.get(smt.id) ?? [];
    if (jadwalsSemester.length === 0) continue;

    // Rentang efektif: dibatasi semester (bila ada) dan tidak melewati `sampai`.
    if (smt.mulai && smt.mulai.getTime() > b.sampai.getTime()) continue; // semester belum mulai / semua tanggal masih di masa depan
    if (smt.mulai && smt.selesai && smt.selesai.getTime() < smt.mulai.getTime()) continue; // rentang invalid
    const mulaiDate = smt.mulai && smt.mulai.getTime() <= b.sampai.getTime() ? smt.mulai : b.sampai;
    const selesaiDate = smt.selesai && smt.selesai.getTime() < b.sampai.getTime() ? smt.selesai : b.sampai;
    if (mulaiDate.getTime() > selesaiDate.getTime()) continue;

    // Tanggal-tanggal berlalu, urut menaik (per hari).
    const tanggal = new Date(mulaiDate);
    while (tanggal.getTime() <= selesaiDate.getTime()) {
      const tSQL = tanggalSQL(tanggal);
      const hari = b.namaHari(new Date(tanggal));
      if (!hari) {
        hasil.minggu++;
        tanggal.setUTCDate(tanggal.getUTCDate() + 1);
        continue;
      }

      // Kalender libur: tahunAjaranId null = berlaku umum; id sama = khusus tahun ajaran itu.
      const liburUmum = liburSet.has(tSQL);
      const liburSmt = liburSpesifik.has(`${smt.tahunAjaranId}|${tSQL}`);
      if (liburUmum || liburSmt) {
        hasil.libur.push(tSQL);
        // Pertemuan otomatis pada tanggal libur = anomali (jangan dihapus otomatis).
        for (const j of jadwalsSemester) {
          if (existingKey.has(`${j.id}|${tSQL}`)) {
            hasil.anomaliLibur.push({ jadwalId: j.id, tanggal: tSQL });
          }
        }
        tanggal.setUTCDate(tanggal.getUTCDate() + 1);
        continue;
      }

      for (const j of jadwalsSemester) {
        if (j.hari !== hari) continue;
        hasil.slotTotal++;
        const sudah = existingKey.has(`${j.id}|${tSQL}`);
        if (sudah) {
          hasil.sudahAda++;
          continue;
        }
        // Nomor = posisi kronologis otomatis pada jadwal (hitung per tanggal berjalan).
        const posisi =
          (existingByJadwal.get(j.id) ?? []).filter((e) => e.tanggal.getTime() < tanggal.getTime()).length +
          1 +
          hasil.buat.filter((x) => x.jadwalId === j.id && x.tanggal.getTime() < tanggal.getTime()).length;
        hasil.buat.push({ jadwalId: j.id, tanggal: new Date(tanggal), pertemuanKe: posisi });
      }

      tanggal.setUTCDate(tanggal.getUTCDate() + 1);
    }
  }
  hasil.belumAda = hasil.buat.length;

  // Deteksi jadwal yang nomor pertemuannya melompat (perlu normalisasi aman).
  const byJadwal = new Map<string, typeof hasil.buat>();
  for (const x of hasil.buat) {
    const list = byJadwal.get(x.jadwalId) ?? [];
    list.push(x);
    byJadwal.set(x.jadwalId, list);
  }
  // Pertemuan otomatis yang sudah ada juga diperiksa urutannya. Jadwal yang
  // punya rencana pembuatan baru ADA kemungkinan nomornya bergeser, sehingga
  // ikut ditandai untuk normalisasi (idempotent: hanya ditulis bila berubah).
  for (const [jadwalId, list] of existingByJadwal) {
    list.sort((a, b) => a.tanggal.getTime() - b.tanggal.getTime());
    const urut = list.map((e) => e.tanggal.getTime());
    const adaGap = urut.some((t, i) => i + 1 !== urut.length && urut[i + 1] - t >= 2 * 86400000);
    const tertulis = list.some((e, i) => e.pertemuanKe !== i + 1);
    if (adaGap || tertulis || byJadwal.has(jadwalId)) {
      hasil.perluNormalisasi.push(jadwalId);
    }
  }

  return hasil;
}

export type HasilSinkronPertemuan = RencanaPertemuanOtomatis & {
  dryRun: boolean;
  dibuat: number;
  dinormalkan: number;
};

/**
 * Sinkronisasi terpusat pembuatan pertemuan otomatis dari jadwal.
 *
 * - `sampai`: batas tanggal maksimal (default = hari ini WIB). Tanggal masa
 *   depan tidak pernah dibuat.
 * - `jadwalId` / `guruId`: batasi subset jadwal (opsional, untuk beranda/
 *   detail jadwal). Tanpa filter = seluruh jadwal di semua semester (cron/backfill).
 * - `dryRun`: hanya audit, tidak menulis apa pun.
 *
 * Idempoten: memakai `createMany(skipDuplicates)` + unique `[jadwalId, tanggal]`,
 * jadi eksekusi berulang/paralel tidak membuat duplikat. Pertemuan yang sudah
 * ada (jurnal, absensi, kejadian, status, pembuat) tidak ditimpa.
 */
export async function sinkronkanPertemuan(opts?: {
  sampai?: Date;
  jadwalId?: string;
  guruId?: string;
  dryRun?: boolean;
}): Promise<HasilSinkronPertemuan> {
  const sampai = opts?.sampai ? mulaiHari(opts.sampai) : mulaiHari();

  // Hanya jadwal yang relevan (atau semuanya bila tanpa filter).
  const jadwalFilter = {
    ...(opts?.jadwalId ? { id: opts.jadwalId } : {}),
    ...(opts?.guruId ? { guruId: opts.guruId } : {}),
  };
  const jadwals = await prisma.jadwal.findMany({
    where: jadwalFilter,
    select: { id: true, semesterId: true, hari: true },
  });
  if (jadwals.length === 0) {
    return {
      dryRun: !!opts?.dryRun,
      slotTotal: 0,
      sudahAda: 0,
      belumAda: 0,
      libur: [],
      minggu: 0,
      anomaliLibur: [],
      buat: [],
      perluNormalisasi: [],
      dibuat: 0,
      dinormalkan: 0,
    };
  }

  const semesterIds = [...new Set(jadwals.map((j) => j.semesterId))];
  const [semesters, libur, existing] = await Promise.all([
    prisma.semester.findMany({
      where: { id: { in: semesterIds }, deletedAt: null },
      select: { id: true, tahunAjaranId: true, mulai: true, selesai: true },
    }),
    prisma.kalenderAkademik.findMany({
      where: { tipe: "LIBUR" },
      select: { tanggal: true, tahunAjaranId: true },
    }),
    prisma.pertemuan.findMany({
      where: { jadwalId: { in: jadwals.map((j) => j.id) } },
      select: { id: true, jadwalId: true, tanggal: true, pertemuanKe: true, sumber: true },
    }),
  ]);

  const rencana = rencanaPertemuanOtomatis({
    semesters,
    jadwals,
    libur,
    existing,
    sampai,
    namaHari: (d) => hariDariTanggal(d),
  });

  const hasil: HasilSinkronPertemuan = { ...rencana, dryRun: !!opts?.dryRun, dibuat: 0, dinormalkan: 0 };
  if (opts?.dryRun) return hasil;

  // ---- Tulis baris yang belum ada ----
  if (rencana.buat.length > 0) {
    const dibuat = await prisma.pertemuan.createMany({
      data: rencana.buat.map((x) => ({
        jadwalId: x.jadwalId,
        tanggal: x.tanggal,
        pertemuanKe: x.pertemuanKe,
        status: "BELUM_DIMULAI",
        sumber: "OTOMATIS",
      })),
      skipDuplicates: true,
    });
    hasil.dibuat = dibuat.count;
  }

  // ---- Normalisasi nomor pertemuan otomatis (aman: hanya ubah pertemuanKe) ----
  const jadwalPerlu = [...new Set([...rencana.perluNormalisasi])];
  let dinormalkan = 0;
  if (jadwalPerlu.length > 0) {
    for (const jadwalId of jadwalPerlu) {
      const rows = await prisma.pertemuan.findMany({
        where: { jadwalId, sumber: "OTOMATIS" },
        select: { id: true, tanggal: true, pertemuanKe: true },
        orderBy: { tanggal: "asc" },
      });
      let counter = 0;
      const updates: Prisma.PrismaPromise<unknown>[] = [];
      for (const r of rows) {
        counter += 1;
        if (r.pertemuanKe !== counter) {
          updates.push(
            prisma.pertemuan.update({
              where: { id: r.id },
              data: { pertemuanKe: counter },
            })
          );
        }
      }
      if (updates.length > 0) {
        await prisma.$transaction(updates);
        dinormalkan += updates.length;
      }
    }
  }
  hasil.dinormalkan = dinormalkan;

  return hasil;
}