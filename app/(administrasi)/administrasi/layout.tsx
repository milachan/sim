import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { alamatRumahJurnal } from "@/lib/workspace-config";
import { adalahAkunPiket } from "@/lib/otorisasi";
import { jumlahNotifikasiBelumDibaca } from "@/lib/administrasi/notifikasi";
import AdministrasiShell from "@/components/administrasi/administrasi-shell";

// Guard Rumah Administrasi: memakai sesi login yang sudah ada (next-auth),
// tanpa login ulang. Akun PIKET khusus absensi sehingga tidak berhak masuk.
// Deteksi PIKET memakai helper terpusat di lib/otorisasi.ts (satu sumber
// aturan); konsistensi dengan server action & endpoint upload versi.
export default async function AdministrasiLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (adalahAkunPiket(user)) redirect(alamatRumahJurnal(user.role, true));

  // Jumlah unread dihitung server-side; shell hanya menerima angka.
  const jumlahNotifikasiBelum = await jumlahNotifikasiBelumDibaca(user.id);

  return (
    <AdministrasiShell user={{ nama: user.nama, username: user.username, role: user.role }} jumlahNotifikasiBelum={jumlahNotifikasiBelum}>
      {children}
    </AdministrasiShell>
  );
}
