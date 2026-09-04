"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { wajibKelola } from "./guard";
import { bolehHapusCatatanKejadian, bolehKelolaPertemuan } from "@/lib/otorisasi";
import type { JenisKejadian } from "@prisma/client";

/**
 * Catat kejadian siswa selama pelajaran (terlambat, izin keluar, sakit, dsb).
 * Bersifat pendukung jurnal dan TIDAK mengubah absensi harian resmi siswa.
 */
export async function catatKejadian(input: {
  pertemuanId: string;
  siswaId: string;
  jenis: JenisKejadian;
  keterangan?: string;
}) {
  const user = await wajibKelola();
  if (!input.pertemuanId || !input.siswaId || !input.jenis)
    throw new Error("Data kejadian belum lengkap.");

  const pertemuan = await prisma.pertemuan.findUnique({
    where: { id: input.pertemuanId },
    include: { jadwal: true },
  });
  if (!pertemuan) throw new Error("Pertemuan tidak ditemukan.");

  // Guru berhak atas pertemuan jadwal miliknya atau pertemuan manual yang ia buat.
  const guruId = pertemuan.jadwal?.guruId;
  if (!bolehKelolaPertemuan(user, {
    jadwalGuruId: guruId,
    dibuatOlehId: pertemuan.dibuatOlehId,
  })) throw new Error("Anda tidak berhak mencatat kejadian pada pertemuan ini.");

  const siswa = await prisma.siswa.findFirst({
    where: { id: input.siswaId, status: "AKTIF", deletedAt: null },
    select: { id: true },
  });
  if (!siswa) throw new Error("Siswa tidak ditemukan.");

  await prisma.catatanKejadian.create({
    data: {
      pertemuanId: input.pertemuanId,
      siswaId: input.siswaId,
      jenis: input.jenis,
      keterangan: input.keterangan?.trim() || null,
      dibuatOlehId: user.id,
    },
  });

  revalidatePath(`/pertemuan/${input.pertemuanId}`);
  return { ok: true as const };
}

/**
 * Catat kejadian yang sama untuk banyak siswa sekaligus (mis. satu jenis
 * kejadian untuk beberapa siswa). Keterangan & jenis berlaku untuk semua.
 */
export async function catatKejadianBanyak(input: {
  pertemuanId: string;
  siswaIds: string[];
  jenis: JenisKejadian;
  keterangan?: string;
}) {
  const user = await wajibKelola();
  const siswaIds = [...new Set((input.siswaIds ?? []).filter(Boolean))];
  if (!input.pertemuanId || !input.jenis || siswaIds.length === 0)
    throw new Error("Data kejadian belum lengkap.");

  const pertemuan = await prisma.pertemuan.findUnique({
    where: { id: input.pertemuanId },
    include: { jadwal: true },
  });
  if (!pertemuan) throw new Error("Pertemuan tidak ditemukan.");

  const guruId = pertemuan.jadwal?.guruId;
  if (!bolehKelolaPertemuan(user, {
    jadwalGuruId: guruId,
    dibuatOlehId: pertemuan.dibuatOlehId,
  })) throw new Error("Anda tidak berhak mencatat kejadian pada pertemuan ini.");

  // Pastikan semua siswa terpilih valid (aktif & belum dihapus).
  const valid = await prisma.siswa.findMany({
    where: { id: { in: siswaIds }, status: "AKTIF", deletedAt: null },
    select: { id: true },
  });
  if (valid.length === 0) throw new Error("Siswa tidak ditemukan.");

  await prisma.catatanKejadian.createMany({
    data: valid.map((s) => ({
      pertemuanId: input.pertemuanId,
      siswaId: s.id,
      jenis: input.jenis,
      keterangan: input.keterangan?.trim() || null,
      dibuatOlehId: user.id,
    })),
  });

  revalidatePath(`/pertemuan/${input.pertemuanId}`);
  return { ok: true as const, jumlah: valid.length };
}

/** Hapus catatan kejadian — hanya pembuatnya atau admin. */
export async function hapusKejadian(id: string) {
  const user = await wajibKelola();
  const catatan = await prisma.catatanKejadian.findUnique({ where: { id } });
  if (!catatan) return { ok: true as const };

  if (!bolehHapusCatatanKejadian(user, catatan.dibuatOlehId))
    throw new Error("Anda hanya dapat menghapus catatan kejadian yang Anda buat.");

  await prisma.catatanKejadian.delete({ where: { id } });
  revalidatePath(`/pertemuan/${catatan.pertemuanId}`);
  return { ok: true as const };
}
