import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { tandaiNotifikasiDibaca, tautanNotifikasi } from "@/lib/administrasi/notifikasi";
import { tautanAmanNotifikasi } from "@/lib/administrasi/notifikasi-ui";

// Route pembuka notifikasi: wajib login, hanya menyentuh notifikasi milik
// session user (findFirst dengan penerimaUserId), menandai dibaca, lalu
// redirect ke tautan internal yang tervalidasi. Notifikasi milik orang lain
// atau tautan asing kembali aman ke pusat notifikasi.
export default async function BukaNotifikasiPage({ params }: { params?: { id?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = params?.id ?? "";
  const baris = id
    ? await prisma.notifikasiAdministrasi.findFirst({
        where: { id, penerimaUserId: user.id },
        select: { dokumenId: true, dibacaPada: true },
      })
    : null;

  if (!baris) redirect("/administrasi/notifikasi");

  // Tautan dibentuk dari dokumenId lalu divalidasi wajib diawali /administrasi/.
  const tujuan = tautanAmanNotifikasi(tautanNotifikasi(baris));
  if (!tujuan) redirect("/administrasi/notifikasi");

  if (!baris.dibacaPada) {
    await tandaiNotifikasiDibaca(user.id, id);
  }

  redirect(tujuan);
}
