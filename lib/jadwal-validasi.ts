import { HARI, HARI_LABEL } from "./constants";
import { jamMaksHariFromDb } from "./jam-utils";
import type { Hari } from "@prisma/client";

export type InputJadwal = {
  guruId: string;
  kelasId: string;
  mapelId: string;
  hari: Hari;
  jamKeMulai: number;
  jamKeSelesai: number;
  semesterId: string;
};

export type JadwalExisting = {
  id: string;
  guruId: string;
  kelasId: string;
  hari: Hari;
  jamKeMulai: number;
  jamKeSelesai: number;
  semesterId: string;
};

export function intervalsOverlap(aMulai: number, aSelesai: number, bMulai: number, bSelesai: number): boolean {
  return aMulai <= bSelesai && aSelesai >= bMulai;
}

export async function validasiJadwal(
  input: InputJadwal,
  existing: JadwalExisting[],
  opts?: { excludeId?: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const mulai = Number(input.jamKeMulai);
  const selesai = Number(input.jamKeSelesai);
  const hari = input.hari;

  if (!input.guruId || !input.kelasId || !input.mapelId) {
    return { ok: false, error: "Guru, kelas, dan mapel wajib diisi." };
  }
  // Hari adalah enum DB — nilai asing (mis. dari URL/request yang dimanipulasi)
  // tidak boleh lolos ke query database (guard runtime, bukan hanya tipe).
  if (!(HARI as readonly string[]).includes(hari)) {
    return { ok: false, error: "Hari tidak dikenal." };
  }
  if (!Number.isInteger(mulai) || !Number.isInteger(selesai)) {
    return { ok: false, error: "Jam mulai dan jam selesai harus berupa bilangan bulat." };
  }
  if (selesai < mulai) {
    return { ok: false, error: "Jam selesai tidak boleh lebih kecil dari jam mulai." };
  }
  if (selesai - mulai > 3) {
    return { ok: false, error: "Maksimal 3 jam pelajaran berturut-turut." };
  }
  const maksJam = await jamMaksHariFromDb(hari);
  if (mulai < 1 || selesai > maksJam) {
    return { ok: false, error: `Hari ${HARI_LABEL[hari]} maksimal ${maksJam} jam pelajaran (jam ke-1 sampai ke-${maksJam}).` };
  }

  const filtered = existing.filter((j) => j.semesterId === input.semesterId && j.hari === hari && j.id !== opts?.excludeId);

  for (const j of filtered) {
    if (j.kelasId === input.kelasId && intervalsOverlap(mulai, selesai, j.jamKeMulai, j.jamKeSelesai)) {
      return { ok: false, error: `Bentrok kelas: kelas ini sudah memiliki jadwal pada ${HARI_LABEL[hari]} jam ke-${j.jamKeMulai}–${j.jamKeSelesai}.` };
    }
  }
  for (const j of filtered) {
    if (j.guruId === input.guruId && intervalsOverlap(mulai, selesai, j.jamKeMulai, j.jamKeSelesai)) {
      return { ok: false, error: `Bentrok guru: guru ini sudah mengajar di kelas lain pada ${HARI_LABEL[hari]} jam ke-${j.jamKeMulai}–${j.jamKeSelesai}.` };
    }
  }

  return { ok: true };
}
