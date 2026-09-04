import { ArrowRight, Check } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getWorkspaces } from "@/lib/workspace-config";

// Katalog semua rumah yang boleh diakses pengguna (dari lib/workspace-config).
// Rumah pertama adalah rumah utama/default sesuai role (Jurnal untuk guru).
export default async function RuangKerjaPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const isAkunPiket = user.role === "GURU" && user.guru?.jenisGuru === "PIKET" && user.guru?.kode === "PIKET";
  const workspaces = getWorkspaces({ role: user.role, isAkunPiket });

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-xl font-extrabold text-slate-900 sm:text-2xl">Semua Aplikasi</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pilih rumah kerja tempat Anda ingin bekerja. Perpindahan tidak memerlukan login ulang.
        </p>
      </section>

      <section aria-label="Daftar aplikasi" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {workspaces.map((w, i) => (
          <a
            key={w.id}
            href={w.href}
            className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="absolute right-3 top-3 inline-flex items-center gap-1">
              {i === 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">
                  <Check className="h-3 w-3" />
                  Rumah utama
                </span>
              )}
            </span>
            <span
              className="flex h-11 w-11 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${w.warnaAksen}1A`, color: w.warnaAksen }}
            >
              <w.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className="mt-3 text-base font-extrabold text-slate-900">{w.label}</h2>
            <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-500">{w.deskripsi}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: w.warnaAksen }}>
              Masuk ke {w.label}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </a>
        ))}
      </section>
    </div>
  );
}
