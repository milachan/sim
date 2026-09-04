import { prisma } from "@/lib/prisma";
import { JAM_PELAJARAN, JAM_MAKS } from "@/lib/constants";
import type { Hari } from "@prisma/client";

let cache: { items: { hari: Hari; jamKe: number; mulai: string; selesai: string }[]; ts: number } | null = null;
const CACHE_TTL = 60_000; // 1 menit

async function getJamCache() {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.items;
  const rows = await prisma.jamPelajaran.findMany({ orderBy: [{ hari: "asc" }, { jamKe: "asc" }] });
  cache = { items: rows, ts: Date.now() };
  return cache.items;
}

/** Jumlah jam maksimal per hari dari DB. Fallback ke JAM_MAKS (constants) bila DB kosong. */
export async function jamMaksHariFromDb(hari: Hari): Promise<number> {
  const items = await getJamCache();
  const count = items.filter((j) => j.hari === hari).length;
  return count > 0 ? count : JAM_MAKS[hari];
}

/** Waktu jam dari DB, atau null bila tidak ada. */
export async function waktuJamFromDb(hari: Hari, jam: number): Promise<{ mulai: string; selesai: string } | null> {
  const items = await getJamCache();
  const found = items.find((j) => j.hari === hari && j.jamKe === jam);
  return found ? { mulai: found.mulai, selesai: found.selesai } : null;
}

/** Rentang waktu dari DB. */
export async function rentangJamFromDb(hari: Hari, mulai: number, selesai: number): Promise<string | null> {
  const a = await waktuJamFromDb(hari, mulai);
  const b = await waktuJamFromDb(hari, selesai);
  if (!a || !b) return null;
  return `${a.mulai}–${b.selesai}`;
}

/** List seluruh jam pelajaran dari DB sebagai fallback. Dipakai oleh admin/jam-pelajaran
 *  untuk menentukan default durasi (40 menit) ketika baris baru ditambahkan. */
export const JAM_PELAJARAN_DEFAULT_DURASI_MENIT = 40;
export const JAM_PELAJARAN_DEFAULT_JAM_MULAI = "07:00";

/** Default baris JamPelajaran untuk seeding client/dokumentasi.
 *  Sumber kebenaran tunggal di JAM_PELAJARAN (constants.ts). */
export function defaultJamPelajaran(): { hari: Hari; jamKe: number; mulai: string; selesai: string }[] {
  const out: { hari: Hari; jamKe: number; mulai: string; selesai: string }[] = [];
  for (const hari of Object.keys(JAM_PELAJARAN) as Hari[]) {
    for (const [jamKeStr, waktu] of Object.entries(JAM_PELAJARAN[hari])) {
      out.push({ hari, jamKe: Number(jamKeStr), mulai: waktu.mulai, selesai: waktu.selesai });
    }
  }
  return out;
}

/** Invalidasi cache (dipanggil setelah simpan). */
export function invalidateJamCache() {
  cache = null;
}
