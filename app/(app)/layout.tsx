import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { hitungBadgeAbsensiHarian } from "@/lib/absensi-harian";
import { mulaiHari } from "@/lib/utils";
import AppShell from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isAkunPiket = user.role === "GURU" && user.guru?.jenisGuru === "PIKET" && user.guru?.kode === "PIKET";
  let badge = 0;
  const isPengajar = user.role === "GURU" || (user.role === "WAKA" && !!user.guruId);
  if (isPengajar && !isAkunPiket && user.guruId) {
    try {
      badge = await hitungBadgeAbsensiHarian(user.guruId, mulaiHari(new Date()));
    } catch {
      badge = 0;
    }
  }
  return (
    <AppShell
      user={{ nama: user.nama, username: user.username, role: user.role }}
      jenisGuru={user.guru?.jenisGuru ?? "BIASA"}
      isAkunPiket={isAkunPiket}
      absensiHarianBadge={badge}
      guruId={user.guruId}
    >
      {children}
    </AppShell>
  );
}
