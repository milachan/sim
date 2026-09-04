"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { wajibLogin } from "./guard";

/**
 * Ganti password awal yang diwajibkan (field wajibGantiPassword = true).
 * Tidak memerlukan persetujuan admin; setelah berhasil flag direset ke false.
 * Alur ini terpisah dari permintaan ganti password sukarela (PasswordChangeRequest).
 */
export async function gantiPasswordAwal(input: { passwordBaru: string }) {
  const user = await wajibLogin();
  if (!input.passwordBaru || input.passwordBaru.length < 6)
    throw new Error("Password baru minimal 6 karakter.");
  const full = await prisma.user.findUnique({ where: { id: user.id }, select: { wajibGantiPassword: true } });
  if (!full) throw new Error("Akun tidak ditemukan.");
  if (!full.wajibGantiPassword)
    throw new Error("Akun ini tidak sedang diwajibkan mengganti password awal.");

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(input.passwordBaru, 10), wajibGantiPassword: false },
    }),
  ]);
  revalidatePath("/");
  return { ok: true as const };
}
