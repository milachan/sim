"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { bolehBacaTemplate, bolehKelolaTemplate } from "@/lib/otorisasi";
import { validasiMetadataTemplate } from "@/lib/administrasi/template-validasi";
import { catatRiwayatTemplate } from "@/lib/administrasi/template-service";

// Server action backend Template Dokumen — metadata, aktif/nonaktif, daftar.
// Upload versi & download memakai endpoint API terpisah (multipart/stream).

type Res = { ok: true } | { ok: false; error: string };

async function wajibPengelola() {
  const user = await getCurrentUser();
  if (!bolehKelolaTemplate(user)) return null;
  return user!;
}

export async function buatTemplate(input: {
  jenis: string;
  nama: string;
  deskripsi?: string | null;
}): Promise<Res & { id?: string }> {
  const user = await wajibPengelola();
  if (!user) return { ok: false, error: "Anda tidak berhak mengelola template." };
  const err = validasiMetadataTemplate(input);
  if (err) return { ok: false, error: err };
  const t = await prisma.templateDokumen.create({
    data: {
      jenis: input.jenis as never,
      nama: input.nama.trim(),
      deskripsi: input.deskripsi?.trim() || null,
      aktif: false,
      dibuatOlehId: user.id,
    },
    select: { id: true },
  });
  await catatRiwayatTemplate(t.id, "dibuat", user.id, { jenis: input.jenis, nama: input.nama.trim() });
  revalidatePath("/administrasi/template");
  return { ok: true, id: t.id };
}

export async function ubahTemplate(
  id: string,
  input: { nama: string; deskripsi?: string | null }
): Promise<Res> {
  const user = await wajibPengelola();
  if (!user) return { ok: false, error: "Anda tidak berhak mengelola template." };
  const err = validasiMetadataTemplate({ ...input, jenis: "PROPOSAL" });
  if (err) return { ok: false, error: err };
  const ada = await prisma.templateDokumen.findUnique({ where: { id }, select: { id: true } });
  if (!ada) return { ok: false, error: "Template tidak ditemukan." };
  await prisma.templateDokumen.update({
    where: { id },
    data: {
      nama: input.nama.trim(),
      deskripsi: input.deskripsi?.trim() || null,
      diperbaruiOlehId: user.id,
    },
  });
  await catatRiwayatTemplate(id, "metadata_diubah", user.id, { nama: input.nama.trim() });
  revalidatePath("/administrasi/template");
  return { ok: true };
}

export async function aktifkanTemplate(id: string): Promise<Res> {
  const user = await wajibPengelola();
  if (!user) return { ok: false, error: "Anda tidak berhak mengelola template." };
  const t = await prisma.templateDokumen.findUnique({
    where: { id },
    select: { id: true, aktif: true, _count: { select: { versi: true } } },
  });
  if (!t) return { ok: false, error: "Template tidak ditemukan." };
  if (t.aktif) return { ok: true };
  if (t._count.versi < 1) return { ok: false, error: "Template belum memiliki versi file — unggah versi terlebih dahulu." };
  await prisma.templateDokumen.update({ where: { id }, data: { aktif: true, diperbaruiOlehId: user.id } });
  await catatRiwayatTemplate(id, "diaktifkan", user.id);
  revalidatePath("/administrasi/template");
  return { ok: true };
}

export async function nonaktifkanTemplate(id: string): Promise<Res> {
  const user = await wajibPengelola();
  if (!user) return { ok: false, error: "Anda tidak berhak mengelola template." };
  const t = await prisma.templateDokumen.findUnique({ where: { id }, select: { id: true, aktif: true } });
  if (!t) return { ok: false, error: "Template tidak ditemukan." };
  if (!t.aktif) return { ok: true };
  // Nonaktif = soft off. Data dan file versi tetap tersimpan (tanpa hard delete).
  await prisma.templateDokumen.update({ where: { id }, data: { aktif: false, diperbaruiOlehId: user.id } });
  await catatRiwayatTemplate(id, "dinonaktifkan", user.id);
  revalidatePath("/administrasi/template");
  return { ok: true };
}

export type DaftarTemplateItem = {
  id: string;
  jenis: string;
  nama: string;
  deskripsi: string | null;
  aktif: boolean;
  jumlahVersi: number;
  versiTerbaru: { id: string; nomor: number; namaAsli: string; ukuran: number; sha256: string; createdAt: Date } | null;
};

/**
 * Daftar template untuk UI:
 * - Admin melihat semua template.
 * - Pengguna lain hanya template AKTIF.
 * - Versi yang disertakan hanya yang TERBARU (nomor tertinggi).
 * - Storage key TIDAK pernah disertakan pada respons.
 */
export async function daftarTemplate(): Promise<DaftarTemplateItem[]> {
  const user = await getCurrentUser();
  if (!bolehBacaTemplate(user)) return [];
  const kelola = bolehKelolaTemplate(user);
  const rows = await prisma.templateDokumen.findMany({
    where: kelola ? {} : { aktif: true },
    orderBy: [{ aktif: "desc" }, { nama: "asc" }],
    select: {
      id: true,
      jenis: true,
      nama: true,
      deskripsi: true,
      aktif: true,
      _count: { select: { versi: true } },
      versi: {
        orderBy: { nomor: "desc" },
        take: 1,
        select: { id: true, nomor: true, namaAsli: true, ukuran: true, sha256: true, createdAt: true },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    jenis: r.jenis,
    nama: r.nama,
    deskripsi: r.deskripsi,
    aktif: r.aktif,
    jumlahVersi: r._count.versi,
    versiTerbaru: r.versi[0]
      ? {
          id: r.versi[0].id,
          nomor: r.versi[0].nomor,
          namaAsli: r.versi[0].namaAsli,
          ukuran: r.versi[0].ukuran,
          sha256: r.versi[0].sha256,
          createdAt: r.versi[0].createdAt,
        }
      : null,
  }));
}
