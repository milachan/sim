import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { alamatRumahJurnal } from "@/lib/workspace-config";
import { ROLE_BADGE, ROLE_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";

// Katalog aplikasi — halaman OPSIONAL, bukan tujuan redirect login.
// Guru tetap masuk langsung ke rumah jurnal setelah login.
export default async function RuangKerjaLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isAkunPiket = user.role === "GURU" && user.guru?.jenisGuru === "PIKET" && user.guru?.kode === "PIKET";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold text-slate-900">Ruang Kerja</p>
            <p className="truncate text-[11px] text-slate-500">
              {user.nama}{" "}
              <span className={cn("ml-1 inline-block rounded-full px-1.5 py-0.5 align-middle text-[10px] font-bold", ROLE_BADGE[user.role])}>
                {ROLE_LABEL[user.role]}
              </span>
            </p>
          </div>
          {!isAkunPiket && (
            <a
              href={alamatRumahJurnal(user.role)}
              className="inline-flex shrink-0 items-center rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              Rumah Utama
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">{children}</main>

      <footer className="border-t border-slate-200 py-4 text-center text-[11px] text-slate-400">
        Semua rumah memakai akun yang sama — tidak perlu login ulang
      </footer>
    </div>
  );
}
