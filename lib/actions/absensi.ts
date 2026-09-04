"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hitungStatusPertemuan } from "@/lib/status";
import { wajibKelola } from "./guard";
import { bolehKelolaPertemuan } from "@/lib/otorisasi";
import type { StatusAbsensi } from "@prisma/client";

export type EntryAbsensi = { siswaId: string; status: StatusAbsensi; catatan: string | null };

export async function simpanAbsensi(pertemuanId: string, entries: EntryAbsensi[], tidakTerlaksana: boolean) {
  const user = await wajibKelola();
  const pertemuan = await prisma.pertemuan.findUnique({ where: { id: pertemuanId }, include: { jadwal: true, jurnal: true } });
  if (!pertemuan) throw new Error("Pertemuan tidak ditemukan.");
  const guruId = pertemuan.jadwal?.guruId;
  if (!bolehKelolaPertemuan(user, { jadwalGuruId: guruId, dibuatOlehId: pertemuan.dibuatOlehId })) throw new Error("Anda tidak berhak mengubah pertemuan ini.");
  await prisma.$transaction([
    prisma.absensiItem.deleteMany({ where: { pertemuanId } }),
    prisma.absensiItem.createMany({
      data: entries.map((e) => ({ pertemuanId, siswaId: e.siswaId, status: e.status, catatan: e.catatan?.trim() || null })),
    }),
  ]);
  const status = hitungStatusPertemuan({ absensiCount: entries.length, jurnalStatus: pertemuan.jurnal?.status ?? null, tidakTerlaksana });
  await prisma.pertemuan.update({ where: { id: pertemuanId }, data: { status } });
  revalidatePath(`/pertemuan/${pertemuanId}`);
  revalidatePath("/");
  revalidatePath("/jadwal");
  return { ok: true as const };
}
