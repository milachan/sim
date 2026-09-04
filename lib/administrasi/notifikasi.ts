// Service notifikasi dokumen Administrasi — server-only.
// Pembuatan notifikasi selalu dipanggil di dalam transaksi perubahan status
// dokumen (atomik). Query baca/sampah menerima userId dari session server,
// tidak pernah dari client. Isi hanya teks ringkas dari template tetap +
// judul dokumen: tanpa storage key, path, checksum, atau catatan revisi.

import type { JenisNotifikasiAdministrasi, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BATAS_JUDUL_DOKUMEN } from "@/lib/dokumen-validasi";

type DbKlien = Prisma.TransactionClient | PrismaClient;

const JUDUL_NOTIF: Record<JenisNotifikasiAdministrasi, string> = {
  DOKUMEN_DIKIRIM: "Dokumen baru menunggu pemeriksaan",
  REVISI_DIKIRIM: "Revisi dokumen menunggu pemeriksaan",
  PERLU_REVISI: "Revisi diminta untuk dokumen Anda",
  DISETUJUI: "Dokumen Anda disetujui",
  DIFINALKAN: "Dokumen Anda telah difinalisasi",
};

const POLA_ISI: Record<JenisNotifikasiAdministrasi, string> = {
  DOKUMEN_DIKIRIM: "Menunggu pemeriksaan Kepala Madrasah: {judul}",
  REVISI_DIKIRIM: "Revisi dikirim ulang untuk diperiksa: {judul}",
  PERLU_REVISI: "Perlu perbaikan sebelum dapat disetujui: {judul}",
  DISETUJUI: "Telah disetujui dan menunggu finalisasi: {judul}",
  DIFINALKAN: "Telah difinalisasi dan tersimpan sebagai arsip resmi: {judul}",
};

export function susunTeksNotifikasi(
  jenis: JenisNotifikasiAdministrasi,
  judulDokumen: string
): { judul: string; isi: string } {
  const judulPotong = judulDokumen.slice(0, BATAS_JUDUL_DOKUMEN);
  return { judul: JUDUL_NOTIF[jenis], isi: POLA_ISI[jenis].replace("{judul}", judulPotong) };
}

export function kunciEvent(aksiRiwayat: string, riwayatId: string): string {
  return `${aksiRiwayat}:${riwayatId}`;
}

export function tautanNotifikasi(notif: { dokumenId: string }): string {
  return `/administrasi/${notif.dokumenId}`;
}

/** Penerima event kirim/revisi: seluruh User ber-role KEPALA yang aktif. */
export async function ambilPenerimaKamadAktif(db: DbKlien = prisma) {
  return db.user.findMany({
    where: { role: "KEPALA", aktif: true },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
}

async function ambilJudulDokumen(tx: Prisma.TransactionClient, dokumenId: string): Promise<string> {
  const d = await tx.dokumen.findUnique({ where: { id: dokumenId }, select: { judul: true } });
  if (!d) throw new Error("Dokumen tidak ditemukan.");
  return d.judul;
}

async function buatSatuNotifikasi(
  tx: Prisma.TransactionClient,
  input: { penerimaUserId: string; dokumenId: string; jenis: JenisNotifikasiAdministrasi; eventKey: string }
) {
  const judulDokumen = await ambilJudulDokumen(tx, input.dokumenId);
  const teks = susunTeksNotifikasi(input.jenis, judulDokumen);
  await tx.notifikasiAdministrasi.upsert({
    where: { penerimaUserId_eventKey: { penerimaUserId: input.penerimaUserId, eventKey: input.eventKey } },
    create: {
      penerimaUserId: input.penerimaUserId,
      dokumenId: input.dokumenId,
      jenis: input.jenis,
      eventKey: input.eventKey,
      judul: teks.judul,
      isi: teks.isi,
    },
    update: {},
  });
}

/** Notifikasi untuk semua Kepala Madrasah aktif (event kirim / kirim revisi). */
export async function buatNotifikasiKamad(
  tx: Prisma.TransactionClient,
  input: { dokumenId: string; jenis: JenisNotifikasiAdministrasi; eventKey: string }
): Promise<number> {
  const penerima = await ambilPenerimaKamadAktif(tx);
  for (const p of penerima) {
    await buatSatuNotifikasi(tx, { ...input, penerimaUserId: p.id });
  }
  return penerima.length;
}

/** Notifikasi untuk pemilik dokumen (event minta revisi / setujui / finalisasi). */
export async function buatNotifikasiPemilik(
  tx: Prisma.TransactionClient,
  input: { dokumenId: string; penerimaUserId: string; jenis: JenisNotifikasiAdministrasi; eventKey: string }
) {
  await buatSatuNotifikasi(tx, input);
}

export async function jumlahNotifikasiBelumDibaca(userId: string): Promise<number> {
  return prisma.notifikasiAdministrasi.count({ where: { penerimaUserId: userId, dibacaPada: null } });
}

export async function daftarNotifikasiUser(
  userId: string,
  opsi?: { batas?: number; status?: "belum" | "sudah" }
) {
  const rows = await prisma.notifikasiAdministrasi.findMany({
    where: {
      penerimaUserId: userId,
      ...(opsi?.status === "belum" ? { dibacaPada: null } : {}),
      ...(opsi?.status === "sudah" ? { dibacaPada: { not: null } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(opsi?.batas ?? 50, 1), 100),
    select: { id: true, jenis: true, judul: true, isi: true, dokumenId: true, dibacaPada: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, tautan: tautanNotifikasi(r) }));
}

/** Menandai satu notifikasi milik user aktif. Mengembalikan false jika id bukan miliknya. */
export async function tandaiNotifikasiDibaca(userId: string, notifikasiId: string): Promise<boolean> {
  const r = await prisma.notifikasiAdministrasi.updateMany({
    where: { id: notifikasiId, penerimaUserId: userId, dibacaPada: null },
    data: { dibacaPada: new Date() },
  });
  return r.count > 0;
}

export async function tandaiSemuaNotifikasiDibaca(userId: string): Promise<number> {
  const r = await prisma.notifikasiAdministrasi.updateMany({
    where: { penerimaUserId: userId, dibacaPada: null },
    data: { dibacaPada: new Date() },
  });
  return r.count;
}
