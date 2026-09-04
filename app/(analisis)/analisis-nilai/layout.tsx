import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { alamatRumahJurnal } from "@/lib/workspace-config";
import AnalisisShell from "@/components/analisis-nilai/analisis-shell";

// Guard Rumah Analisis Nilai: memakai sesi login yang sudah ada (next-auth),
// tanpa login ulang. Akun PIKET khusus absensi sehingga tidak berhak masuk.
export default async function AnalisisLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isAkunPiket = user.role === "GURU" && user.guru?.jenisGuru === "PIKET" && user.guru?.kode === "PIKET";
  if (isAkunPiket) redirect(alamatRumahJurnal(user.role, true));

  return (
    <AnalisisShell user={{ nama: user.nama, username: user.username, role: user.role }}>
      {children}
    </AnalisisShell>
  );
}
