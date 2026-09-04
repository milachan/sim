"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { wajibKelola } from "./guard";
import { bolehKelolaJadwal, bolehKelolaKegiatanNilai } from "@/lib/otorisasi";
import type { JenisKegiatan, StatusKumpul } from "@prisma/client";

export async function buatKegiatan(input: {
  jadwalId: string;
  jenis: JenisKegiatan;
  judul: string;
  tanggal: string;
  nilaiMaksimal: number;
}) {
  const user = await wajibKelola();
  if (!input.judul?.trim()) throw new Error("Judul kegiatan wajib diisi.");

  const jadwal = await prisma.jadwal.findUnique({
    where: { id: input.jadwalId },
    include: { kelas: { include: { siswa: { where: { status: "AKTIF", deletedAt: null } } } } },
  });
  if (!jadwal) throw new Error("Jadwal tidak ditemukan.");
  if (!bolehKelolaJadwal(user, jadwal.guruId))
    throw new Error("Anda tidak berhak menambah kegiatan pada jadwal ini.");

  const kegiatan = await prisma.penilaianKegiatan.create({
    data: {
      jadwalId: input.jadwalId,
      jenis: input.jenis,
      judul: input.judul.trim(),
      tanggal: new Date(input.tanggal),
      nilaiMaksimal: Math.min(Math.max(Number(input.nilaiMaksimal) || 100, 1), 1000),
    },
  });

  // Buat baris nilai kosong untuk semua siswa aktif di kelas tersebut
  await prisma.nilaiSiswa.createMany({
    data: jadwal.kelas.siswa.map((s) => ({
      kegiatanId: kegiatan.id,
      siswaId: s.id,
      statusKumpul: "BELUM",
    })),
    skipDuplicates: true,
  });

  revalidatePath("/nilai");
  redirect(`/nilai/${kegiatan.id}?sukses=${encodeURIComponent("Kegiatan penilaian berhasil dibuat.")}`);
}

export type RowNilai = {
  siswaId: string;
  nilai: number | null;
  catatan: string | null;
  statusKumpul: StatusKumpul;
};

export async function simpanNilai(kegiatanId: string, rows: RowNilai[]) {
  const user = await wajibKelola();
  const kegiatan = await prisma.penilaianKegiatan.findUnique({
    where: { id: kegiatanId },
    include: { jadwal: true },
  });
  if (!kegiatan) throw new Error("Kegiatan tidak ditemukan.");
  if (!bolehKelolaKegiatanNilai(user, kegiatan.jadwal.guruId))
    throw new Error("Anda tidak berhak mengubah nilai ini.");

  await prisma.$transaction(
    rows.map((r) =>
      prisma.nilaiSiswa.upsert({
        where: { kegiatanId_siswaId: { kegiatanId, siswaId: r.siswaId } },
        create: {
          kegiatanId,
          siswaId: r.siswaId,
          nilai: r.nilai,
          catatan: r.catatan?.trim() || null,
          statusKumpul: r.statusKumpul,
        },
        update: {
          nilai: r.nilai,
          catatan: r.catatan?.trim() || null,
          statusKumpul: r.statusKumpul,
        },
      })
    )
  );

  revalidatePath(`/nilai/${kegiatanId}`);
  revalidatePath("/nilai");
  redirect(`/nilai/${kegiatanId}?sukses=${encodeURIComponent("Nilai berhasil disimpan.")}`);
}

export async function hapusKegiatan(kegiatanId: string) {
  const user = await wajibKelola();
  const kegiatan = await prisma.penilaianKegiatan.findUnique({
    where: { id: kegiatanId },
    include: { jadwal: { select: { guruId: true } } },
  });
  if (!kegiatan) throw new Error("Kegiatan tidak ditemukan.");
  if (!bolehKelolaKegiatanNilai(user, kegiatan.jadwal.guruId))
    throw new Error("Akses ditolak.");
  await prisma.penilaianKegiatan.delete({ where: { id: kegiatanId } });
  revalidatePath("/nilai");
  redirect("/nilai?sukses=" + encodeURIComponent("Kegiatan penilaian dihapus."));
}
