import { getServerSession } from "next-auth";
import { cache } from "react";
import { authOptions } from "./auth";
import { prisma } from "./prisma";

export async function getSession() {
  return getServerSession(authOptions);
}

export const getCurrentUser = cache(async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      username: true,
      nama: true,
      role: true,
      aktif: true,
      wajibGantiPassword: true,
      guruId: true,
      createdAt: true,
      guru: {
        select: {
          id: true,
          nama: true,
          kode: true,
          nip: true,
          telepon: true,
          status: true,
          jenisGuru: true,
          deletedAt: true,
          waliKelas: { select: { id: true, nama: true } },
          mapelDiampu: { select: { id: true, nama: true } },
        },
      },
    },
  });

  // Sinkronisasi status akun & role dari database (menolak JWT lama):
  // user nonaktif/hapus dianggap tidak sah; GURU wajib punya data guru yang aktif;
  // WAKA dengan guruId yang tersambung wajib gurunya aktif (akses gabungan).
  if (!user || !user.aktif) return null;
  if (user.role === "GURU" && (!user.guruId || !user.guru || user.guru.status !== true || user.guru.deletedAt !== null)) {
    return null;
  }
  if (user.role === "WAKA" && user.guruId && (!user.guru || user.guru.status !== true || user.guru.deletedAt !== null)) {
    return null;
  }
  return user;
});
