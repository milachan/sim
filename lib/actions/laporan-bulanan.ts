"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { wajibLogin } from "./guard";
import { statistikBulanan } from "@/lib/laporan";

export type ItemSampling = {
  guruId: string;
  nama: string;
  total: number;
  lengkap: number;
  persen: number;
  terverifikasi: boolean;
  catatan?: string;
};

function sukses(bulan: string, pesan: string) {
  revalidatePath("/laporan-bulanan");
  revalidatePath(`/laporan-bulanan/${bulan}`);
  redirect(`/laporan-bulanan/${bulan}?sukses=${encodeURIComponent(pesan)}`);
}

async function wajibVerifikator() {
  const user = await wajibLogin();
  if (!["WAKA", "ADMIN", "SUPERADMIN"].includes(user.role)) redirect("/");
  return user;
}

export async function buatLaporanBulanan(bulan: string) {
  const user = await wajibVerifikator();
  if (!/^\d{4}-\d{2}$/.test(bulan)) throw new Error("Format bulan tidak valid.");

  const ada = await prisma.laporanBulanan.findUnique({ where: { bulan } });
  if (!ada) {
    await prisma.laporanBulanan.create({ data: { bulan, status: "DRAFT", dibuatOlehId: user.id } });
  }
  redirect(`/laporan-bulanan/${bulan}`);
}

export async function simpanSampling(input: {
  bulan: string;
  catatanWaka: string;
  items: ItemSampling[];
}) {
  const user = await wajibVerifikator();
  if (!/^\d{4}-\d{2}$/.test(input.bulan)) throw new Error("Format bulan tidak valid.");
  const laporan = await prisma.laporanBulanan.findUnique({ where: { bulan: input.bulan } });
  if (!laporan) throw new Error("Laporan belum dibuat.");
  if (laporan.status === "DISETUJUI")
    throw new Error("Laporan sudah disetujui. Kembalikan dulu ke konsep oleh Kamad/Admin sebelum mengubah sampling.");

  if (!Array.isArray(input.items)) throw new Error("Data sampling tidak valid.");
  if (input.items.length > 200) throw new Error("Terlalu banyak data sampling.");

  const stat = await statistikBulanan(input.bulan);
  const validGuru = new Map(stat.perGuru.map((g) => [g.guruId, g]));
  const byGuru = new Map<string, ItemSampling>();
  for (const x of input.items) {
    if (!x || typeof x.guruId !== "string" || typeof x.nama !== "string") continue;
    if (!validGuru.has(x.guruId)) continue;
    if (byGuru.has(x.guruId)) continue;
    const ref = validGuru.get(x.guruId)!;
    byGuru.set(x.guruId, {
      guruId: x.guruId,
      nama: ref.nama,
      total: ref.total,
      lengkap: ref.lengkap,
      persen: ref.persen,
      terverifikasi: !!x.terverifikasi,
      catatan: typeof x.catatan === "string" ? x.catatan.slice(0, 500) : "",
    });
  }
  const bersih = [...byGuru.values()];
  if (bersih.filter((x) => x.terverifikasi).length === 0)
    throw new Error("Minimal satu guru harus dicentang untuk verifikasi sampling.");
  if (typeof input.catatanWaka !== "string") throw new Error("Catatan tidak valid.");

  await prisma.$transaction(async (tx) => {
    await tx.laporanBulanan.update({
      where: { id: laporan.id },
      data: {
        sampling: bersih as unknown as object,
        catatanWaka: (input.catatanWaka ?? "").trim().slice(0, 2000) || null,
        status: "DIPERIKSA",
        diperiksaOlehId: user.id,
        diperiksaPada: new Date(),
      },
    });
  });
  sukses(input.bulan, "Sampling verifikasi disimpan — laporan ditandai Sudah Diperiksa.");
}

export async function setujuiLaporan(input: { bulan: string; catatanKamad: string }) {
  const user = await wajibLogin();
  if (!["KEPALA", "ADMIN", "SUPERADMIN"].includes(user.role)) redirect("/");
  if (!/^\d{4}-\d{2}$/.test(input.bulan)) throw new Error("Format bulan tidak valid.");
  const laporan = await prisma.laporanBulanan.findUnique({ where: { bulan: input.bulan } });
  if (!laporan) throw new Error("Laporan belum dibuat.");
  if (laporan.status === "DRAFT") throw new Error("Laporan harus diperiksa Waka dulu sebelum disetujui.");

  if (typeof input.catatanKamad !== "string") throw new Error("Catatan tidak valid.");

  await prisma.laporanBulanan.update({
    where: { id: laporan.id },
    data: {
      status: "DISETUJUI",
      catatanKamad: (input.catatanKamad ?? "").trim().slice(0, 2000) || null,
      disetujuiOlehId: user.id,
      disetujuiPada: new Date(),
    },
  });
  sukses(input.bulan, "Laporan bulanan disetujui.");
}

export async function kembalikanLaporan(bulan: string) {
  const user = await wajibLogin();
  if (!["KEPALA", "ADMIN", "SUPERADMIN", "WAKA"].includes(user.role)) redirect("/");
  if (!/^\d{4}-\d{2}$/.test(bulan)) throw new Error("Format bulan tidak valid.");
  const laporan = await prisma.laporanBulanan.findUnique({ where: { bulan } });
  if (!laporan) throw new Error("Laporan belum dibuat.");

  await prisma.laporanBulanan.update({
    where: { id: laporan.id },
    data: { status: "DRAFT", diperiksaOlehId: null, diperiksaPada: null },
  });
  sukses(bulan, "Laporan dikembalikan ke status Konsep untuk ditinjau ulang.");
}
