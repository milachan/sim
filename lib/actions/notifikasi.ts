"use server";

// Wrapper action pusat notifikasi Administrasi. penerimaUserId TIDAK pernah
// diterima dari client — selalu diambil dari session (wajibLogin), lalu
// diteruskan ke service notifikasi yang sudah ada.

import { revalidatePath } from "next/cache";
import { wajibLogin } from "./guard";
import { tandaiNotifikasiDibaca, tandaiSemuaNotifikasiDibaca } from "@/lib/administrasi/notifikasi";

/** Menandai satu notifikasi milik session user. Milik orang lain → ok: false. */
export async function tandaiSatuNotifikasiDibaca(notifikasiId: string) {
  const user = await wajibLogin();
  const ok = await tandaiNotifikasiDibaca(user.id, notifikasiId);
  revalidatePath("/administrasi/notifikasi");
  return { ok };
}

/** Menandai semua notifikasi belum dibaca milik session user saja. */
export async function tandaiSemuaNotifikasiSaya() {
  const user = await wajibLogin();
  const jumlah = await tandaiSemuaNotifikasiDibaca(user.id);
  revalidatePath("/administrasi/notifikasi");
  return { ok: true as const, jumlah };
}
