"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hitungStatusPertemuan } from "@/lib/status";
import { wajibKelola } from "./guard";
import { cekWajibAbsenSebelumJurnal } from "@/lib/absensi-harian";
import { cariSemesterUntukTanggal } from "@/lib/semester";
import { bolehKelolaPertemuan, bolehKelolaJadwal } from "@/lib/otorisasi";
import { bersihkanJurnal, snapshotJurnal, diffJurnal } from "@/lib/audit-jurnal";
import type { StatusJurnal, Prisma } from "@prisma/client";

export type DataJurnal = {
  materi: string;
  tujuan: string;
  kegiatan: string;
  metode: string;
  media: string;
  hasil: string;
  kendala: string;
  tindakLanjut: string;
  catatan: string;
  dokumentasiUrl: string;
};

export { bersihkanJurnal as bersihkan };

export async function simpanJurnal(pertemuanId: string, data: DataJurnal, status: StatusJurnal) {
  const user = await wajibKelola();
  const pertemuan = await prisma.pertemuan.findUnique({
    where: { id: pertemuanId },
    include: { jadwal: true, jurnal: true },
  });
  if (!pertemuan) throw new Error("Pertemuan tidak ditemukan.");
  if (!bolehKelolaPertemuan(user, { jadwalGuruId: pertemuan.jadwal?.guruId, dibuatOlehId: pertemuan.dibuatOlehId }))
    throw new Error("Anda tidak berhak mengubah jurnal ini.");
  if (status === "TERKIRIM") {
    const blokir = await cekWajibAbsenSebelumJurnal(user, pertemuan.kelasId, pertemuan.tanggal, {
      semesterId: pertemuan.jadwal?.semesterId,
    });
    if (blokir) throw new Error(blokir);
  }
  const bersih = bersihkanJurnal(data);
  const absensiCount = await prisma.absensiItem.count({ where: { pertemuanId } });
  const sesudahSnap = snapshotJurnal({ ...bersih, status });
  const sekarang = new Date();
  if (pertemuan.jurnal) {
    const sebelumSnap = snapshotJurnal(pertemuan.jurnal);
    const diffy = diffJurnal(sebelumSnap, sesudahSnap);
    const tx: Prisma.PrismaPromise<unknown>[] = [
      prisma.jurnal.update({ where: { id: pertemuan.jurnal.id }, data: { ...bersih, status, diubahPada: sekarang } }),
      prisma.pertemuan.update({
        where: { id: pertemuanId },
        data: { status: hitungStatusPertemuan({ absensiCount, jurnalStatus: status }) },
      }),
    ];
    if (diffy.berubah) {
      tx.push(
        prisma.riwayatPerubahan.create({
          data: {
            entitas: "Jurnal",
            entitasId: pertemuan.jurnal.id,
            userId: user.id,
            perubahan: { aksi: "perbarui", pertemuanId, fieldBerubah: diffy.fieldBerubah, sebelum: diffy.sebelum, sesudah: diffy.sesudah },
          },
        })
      );
    }
    await prisma.$transaction(tx);
  } else {
    const buat = await prisma.$transaction(async (txClient) => {
      const jurnal = await txClient.jurnal.create({ data: { pertemuanId, ...bersih, status } });
      await txClient.riwayatPerubahan.create({
        data: {
          entitas: "Jurnal",
          entitasId: jurnal.id,
          userId: user.id,
          perubahan: { aksi: "buat", pertemuanId, sesudah: sesudahSnap as unknown as Prisma.InputJsonValue },
        },
      });
      await txClient.pertemuan.update({
        where: { id: pertemuanId },
        data: { status: hitungStatusPertemuan({ absensiCount, jurnalStatus: status }) },
      });
      return jurnal;
    });
    void buat;
  }
  revalidatePath(`/pertemuan/${pertemuanId}`);
  revalidatePath("/");
  revalidatePath("/jurnal");
  return { ok: true as const };
}

export async function salinJurnalDari(pertemuanId: string, dariPertemuanId: string) {
  const user = await wajibKelola();
  const target = await prisma.pertemuan.findUnique({ where: { id: pertemuanId }, include: { jadwal: true } });
  if (!target) throw new Error("Pertemuan tidak ditemukan.");
  if (!bolehKelolaPertemuan(user, { jadwalGuruId: target.jadwal?.guruId, dibuatOlehId: target.dibuatOlehId })) throw new Error("Akses ditolak.");
  const sumber = await prisma.pertemuan.findUnique({
    where: { id: dariPertemuanId },
    include: { jadwal: { select: { guruId: true } }, jurnal: true },
  });
  if (!sumber) return null;
  if (!bolehKelolaPertemuan(user, { jadwalGuruId: sumber.jadwal?.guruId, dibuatOlehId: sumber.dibuatOlehId })) throw new Error("Akses ditolak.");
  if (!sumber.jurnal) return null;
  return {
    materi: sumber.jurnal.materi,
    tujuan: sumber.jurnal.tujuan,
    kegiatan: sumber.jurnal.kegiatan,
    metode: sumber.jurnal.metode,
    media: sumber.jurnal.media,
    hasil: sumber.jurnal.hasil,
    kendala: sumber.jurnal.kendala,
    tindakLanjut: sumber.jurnal.tindakLanjut,
    catatan: sumber.jurnal.catatan,
    dokumentasiUrl: sumber.jurnal.dokumentasiUrl,
  };
}

export async function kirimMassal(pertemuanIds: string[]) {
  const user = await wajibKelola();
  const ids = [...new Set(pertemuanIds)];
  if (!ids.length) return { ok: false as const, pesan: "Tidak ada pertemuan yang dipilih." };
  const pertemuanList = await prisma.pertemuan.findMany({
    where: { id: { in: ids } },
    include: { jadwal: true, jurnal: true, _count: { select: { absensi: true } } },
  });
  const sah = pertemuanList.filter((p) => {
    if (!p.jurnal || p.jurnal.status !== "DRAFT") return false;
    return bolehKelolaPertemuan(user, { jadwalGuruId: p.jadwal?.guruId, dibuatOlehId: p.dibuatOlehId });
  });
  const sahFinal: typeof sah = [];
  const terblokir: { pertemuanId: string; alasan: string }[] = [];
  for (const p of sah) {
    const blokir = await cekWajibAbsenSebelumJurnal(user, p.kelasId, p.tanggal, { semesterId: p.jadwal?.semesterId });
    if (blokir) terblokir.push({ pertemuanId: p.id, alasan: blokir });
    else sahFinal.push(p);
  }
  if (!sahFinal.length) {
    if (terblokir.length > 0) return { ok: false as const, pesan: "Semua jurnal terblokir kewajiban Absensi Harian.", terblokir };
    return { ok: false as const, pesan: "Tidak ada konsep yang bisa dikirim." };
  }
  const sekarang = new Date();
  await prisma.$transaction([
    ...sahFinal.map((p) => prisma.jurnal.update({ where: { id: p.jurnal!.id }, data: { status: "TERKIRIM", diubahPada: sekarang } })),
    ...sahFinal.map((p) =>
      prisma.pertemuan.update({ where: { id: p.id }, data: { status: hitungStatusPertemuan({ absensiCount: p._count.absensi, jurnalStatus: "TERKIRIM" }) } })
    ),
    ...sahFinal.map((p) =>
      prisma.riwayatPerubahan.create({
        data: {
          entitas: "Jurnal",
          entitasId: p.jurnal!.id,
          userId: user.id,
          perubahan: { aksi: "kirim-massal", pertemuanId: p.id, fieldBerubah: ["status"], sebelum: { status: "DRAFT" }, sesudah: { status: "TERKIRIM" } },
        },
      })
    ),
  ]);
  revalidatePath("/jurnal");
  revalidatePath("/");
  return { ok: true as const, jumlah: sahFinal.length, terblokir: terblokir.length ? terblokir : undefined };
}

export async function buatJurnalManual(
  input: { kelasId: string; mapelId: string; tanggal: string; alasan: string; jadwalId?: string } & DataJurnal,
  status: StatusJurnal
) {
  const user = await wajibKelola();
  if (!input.alasan?.trim()) throw new Error("Jurnal manual wajib mencantumkan alasan.");
  if (!input.kelasId || !input.mapelId) throw new Error("Kelas dan mata pelajaran wajib diisi.");
  let semesterId: string | null | undefined;
  if (input.jadwalId) {
    const jadwal = await prisma.jadwal.findUnique({ where: { id: input.jadwalId }, select: { guruId: true, semesterId: true } });
    if (!jadwal) throw new Error("Jadwal tidak ditemukan.");
    if (!bolehKelolaJadwal(user, jadwal.guruId)) throw new Error("Akses ditolak.");
    semesterId = jadwal.semesterId;
  }
  if (input.jadwalId) {
    const sudahAda = await prisma.pertemuan.findFirst({ where: { jadwalId: input.jadwalId, tanggal: new Date(input.tanggal) }, select: { id: true } });
    if (sudahAda) throw new Error("Jadwal ini sudah memiliki jurnal pada tanggal tersebut. Buka jurnal yang sudah ada untuk mengisinya.");
  } else {
    const sudahAda = await prisma.pertemuan.findFirst({
      where: { sumber: "MANUAL", jadwalId: null, kelasId: input.kelasId, mapelId: input.mapelId, tanggal: new Date(input.tanggal), dibuatOlehId: user.id },
      select: { id: true },
    });
    if (sudahAda) throw new Error("Jurnal manual untuk kelas, mata pelajaran, dan tanggal ini sudah dibuat. Klik jurnal yang sudah ada untuk mengeditnya.");
  }
  const absensiCount = 0;
  if (!semesterId) {
    const resolusi = await cariSemesterUntukTanggal(new Date(input.tanggal));
    if (resolusi.ambigu) throw new Error("Konfigurasi periode bermasalah: beberapa semester berlaku pada tanggal yang sama.");
    semesterId = resolusi.semester?.id;
  }
  if (status === "TERKIRIM") {
    const blokir = await cekWajibAbsenSebelumJurnal(user, input.kelasId, new Date(input.tanggal), { semesterId });
    if (blokir) throw new Error(blokir);
  }
  const dibuat = await prisma.$transaction(async (txClient) => {
    const pertemuan = await txClient.pertemuan.create({
      data: {
        jadwalId: input.jadwalId || null,
        kelasId: input.kelasId,
        mapelId: input.mapelId,
        tanggal: new Date(input.tanggal),
        pertemuanKe: 0,
        status: hitungStatusPertemuan({ absensiCount, jurnalStatus: status }),
        sumber: "MANUAL",
        alasanManual: input.alasan.trim(),
        dibuatOlehId: user.id,
      },
    });
    const jurnal = await txClient.jurnal.create({ data: { pertemuanId: pertemuan.id, ...bersihkanJurnal(input), status } });
    await txClient.riwayatPerubahan.create({
      data: {
        entitas: "Jurnal",
        entitasId: jurnal.id,
        userId: user.id,
        perubahan: {
          aksi: "buat",
          pertemuanId: pertemuan.id,
          sumber: "MANUAL",
          alasan: input.alasan.trim(),
          sesudah: snapshotJurnal({ ...bersihkanJurnal(input), status }) as unknown as Prisma.InputJsonValue,
        },
      },
    });
    return pertemuan.id;
  });
  revalidatePath("/jurnal");
  revalidatePath("/");
  return { ok: true as const, pertemuanId: dibuat };
}
