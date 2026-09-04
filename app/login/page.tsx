import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import LoginForm, { type AkunDemo } from "@/components/login-form";

export const dynamic = "force-dynamic";

// Akun demo (hasil seed) yang ditampilkan di halaman login — urut sesuai daftar ini.
const USERNAME_DEMO = ["guru1", "guru2", "guru3", "piket", "waka", "admin", "kamad", "superadmin"] as const;

// Label chip memakai nama panggilan (bagian nama sebelum gelar, mis. "Budi Santoso")
// yang dibaca langsung dari DB, bukan username ("guru1"). Akun yang tidak ada di
// DB dilewati agar tidak muncul chip yang tidak bisa dipakai.
async function muatAkunDemo(): Promise<AkunDemo[]> {
  const users = await prisma.user.findMany({
    where: { username: { in: [...USERNAME_DEMO] }, aktif: true },
    select: { username: true, nama: true },
  });
  const namaByUsername = new Map(users.map((u) => [u.username, u.nama]));
  return USERNAME_DEMO.flatMap((username) => {
    const nama = namaByUsername.get(username);
    if (!nama) return [];
    return [{ user: username, nama: nama.split(",")[0].trim() }];
  });
}

export default async function LoginPage() {
  const demo = await muatAkunDemo();
  return (
    <Suspense>
      <LoginForm demo={demo} />
    </Suspense>
  );
}
