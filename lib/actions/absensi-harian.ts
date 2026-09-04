"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { wajibLogin } from "./guard";
import { mulaiHari } from "@/lib/utils";
import { cariGuruJamPertama, validasiKelengkapanAbsensiHarian, tentukanPeranPengisi } from "@/lib/absensi-harian";
import { cariSemesterUntukTanggal } from "@/lib/semester";
import type { StatusAbsensi } from "@prisma/client";

export type EntryAbsensiHarian = {
  siswaId: string;
  status: StatusAbsensi;
  catatan: string | null;
};

export async function simpanAbsensiHarian(kelasId: string, tanggalStr: string, entries: EntryAbsensiHarian[]) {
  const user = await wajibLogin();
  const tanggal = mulaiHari(tanggalStr);
  if (tanggal > mulaiHari()) {
    throw new Error("Tidak dapat mengisi absensi untuk tanggal yang akan datang.");
  }
  const resolusi = await cariSemesterUntukTanggal(tanggal);
  if (resolusi.ambigu) {
    throw new Error("Konfigurasi periode bermasalah: beberapa semester berlaku pada tanggal yang sama. Periksa rentang tanggal tahun ajaran & semester.");
  }
  if (!resolusi.semester) {
    throw new Error(
      resolusi.tanpaRentang.length > 0
        ? "Rentang tanggal semester belum dilengkapi admin — tidak dapat menentukan jadwal untuk tanggal ini."
        : "Tidak ada semester yang berlaku pada tanggal ini."
    );
  }
  const semesterId = resolusi.semester.id;
  const [kelas, guruJP] = await Promise.all([
    prisma.kelas.findUnique({
      where: { id: kelasId },
      include: { siswa: { where: { status: "AKTIF", deletedAt: null }, select: { id: true } } },
    }),
    cariGuruJamPertama(kelasId, tanggal, { semesterId }),
  ]);
  if (!kelas) throw new Error("Kelas tidak ditemukan.");
  // Sumber otorisasi final: tentukanPeranPengisi (GURU/WAKA terhubung boleh
  // mengisi bila guru jam pertama / wali kelas periode itu / guru piket;
  // WAKA tanpa guruId & KEPALA ditolak; ADMIN/SUPERADMIN backup piket).
  const peran = await tentukanPeranPengisi(user, kelasId, tanggal, { semesterId });
  if (!peran) throw new Error("Anda bukan guru jam pertama, wali kelas periode tersebut, atau guru piket untuk kelas ini.");
  const siswaAktifIds = kelas.siswa.map((s) => s.id);
  if (entries.length === 0) {
    const existing = await prisma.absensiHarian.findUnique({
      where: { kelasId_tanggal: { kelasId, tanggal } },
      include: { item: true },
    });
    if (existing) {
      const pertemuanTerkait = await prisma.pertemuan.findMany({
        where: { kelasId, tanggal, jurnal: { status: "TERKIRIM" } },
        include: { jadwal: { select: { guruId: true } }, jurnal: true },
      });
      const guruJPId = guruJP?.guruId ?? null;
      const adaJurnalGuruPertama = !!guruJPId && pertemuanTerkait.some((p) => p.jadwal?.guruId === guruJPId);
      if (adaJurnalGuruPertama) {
        throw new Error("Tidak dapat menghapus Absensi Harian: sudah ada jurnal TERKIRIM milik guru jam pertama pada tanggal ini. Lengkapi kembali Absensi Harian atau hubungi admin.");
      }
    }
    await prisma.absensiHarian.deleteMany({ where: { kelasId, tanggal } });
    revalidatePath("/absensi-harian");
    revalidatePath(`/absensi-harian/${kelasId}`);
    revalidatePath("/");
    return { ok: true as const };
  }
  const validasi = validasiKelengkapanAbsensiHarian(
    entries.map((e) => ({ siswaId: e.siswaId, status: e.status })),
    siswaAktifIds
  );
  if (!validasi.ok) throw new Error(validasi.pesan!);
  const record = await prisma.absensiHarian.upsert({
    where: { kelasId_tanggal: { kelasId, tanggal } },
    update: { pengisiId: user.id, peranPengisi: peran },
    create: { kelasId, tanggal, pengisiId: user.id, peranPengisi: peran },
  });
  await prisma.$transaction([
    prisma.absensiHarianItem.deleteMany({ where: { absensiHarianId: record.id } }),
    prisma.absensiHarianItem.createMany({
      data: entries.map((e) => ({
        absensiHarianId: record.id,
        siswaId: e.siswaId,
        status: e.status,
        catatan: e.catatan?.trim() || null,
      })),
    }),
  ]);
  revalidatePath("/absensi-harian");
  revalidatePath(`/absensi-harian/${kelasId}`);
  revalidatePath("/");
  return { ok: true as const };
}
