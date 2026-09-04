import Link from "next/link";
import { HARI, HARI_LABEL, JAM_MULAI, waktuJam } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Hari } from "@prisma/client";

export type BarisMatriksJadwal = {
  id: string;
  hari: Hari;
  jamKeMulai: number;
  jamKeSelesai: number;
  mapel: string;
  kelas: string;
  guru: string;
};

/** Palet warna sel — konsisten per mata pelajaran agar mudah di-scan. */
const WARNA: Record<string, string> = {
  "Al-Qur'an Hadits": "bg-emerald-50/80 ring-emerald-200 hover:bg-emerald-100/80",
  "Akidah Akhlaq": "bg-teal-50/80 ring-teal-200 hover:bg-teal-100/80",
  Fiqih: "bg-sky-50/80 ring-sky-200 hover:bg-sky-100/80",
  SKI: "bg-indigo-50/80 ring-indigo-200 hover:bg-indigo-100/80",
  "Bahasa Arab": "bg-violet-50/80 ring-violet-200 hover:bg-violet-100/80",
  "Bahasa Indonesia": "bg-rose-50/80 ring-rose-200 hover:bg-rose-100/80",
  Matematika: "bg-amber-50/80 ring-amber-200 hover:bg-amber-100/80",
  "Bahasa Inggris": "bg-orange-50/80 ring-orange-200 hover:bg-orange-100/80",
  IPA: "bg-lime-50/80 ring-lime-200 hover:bg-lime-100/80",
  IPS: "bg-yellow-50/80 ring-yellow-200 hover:bg-yellow-100/80",
  "Pendidikan Pancasila": "bg-red-50/80 ring-red-200 hover:bg-red-100/80",
  "Bahasa Jawa": "bg-fuchsia-50/80 ring-fuchsia-200 hover:bg-fuchsia-100/80",
  PJOK: "bg-cyan-50/80 ring-cyan-200 hover:bg-cyan-100/80",
  Informatika: "bg-blue-50/80 ring-blue-200 hover:bg-blue-100/80",
  "Seni Budaya": "bg-pink-50/80 ring-pink-200 hover:bg-pink-100/80",
  Prakarya: "bg-stone-50/80 ring-stone-200 hover:bg-stone-100/80",
  Tahfidz: "bg-green-50/80 ring-green-200 hover:bg-green-100/80",
};

function warnaMapel(nama: string): string {
  return WARNA[nama] ?? "bg-slate-50/80 ring-slate-200 hover:bg-slate-100/80";
}

/**
 * Matriks jadwal mingguan: baris = hari (Senin–Sabtu), kolom = jam ke-1..9.
 * Satu jadwal yang menempati beberapa jam digabung via colSpan.
 * Setiap sel menautkan ke halaman detail jadwal.
 */
export function MatriksJadwal({
  items,
  mode,
  linkQuery = "",
}: {
  items: BarisMatriksJadwal[];
  /** "guru" = menampilkan kelas di tiap sel; "kelas" = menampilkan guru di tiap sel. */
  mode: "guru" | "kelas";
  /** Query string tambahan yang diteruskan ke halaman detail (mis. filter aktif), agar tombol kembali bisa mengembalikan filter. */
  linkQuery?: string;
}) {
  const kolomJam = JAM_MULAI;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[780px] border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-20 rounded-xl bg-white p-2 text-left text-xs font-extrabold uppercase tracking-wide text-slate-500 ring-1 ring-inset ring-slate-200">
              Hari
            </th>
            {kolomJam.map((j) => {
              const w = waktuJam("SENIN", j);
              return (
                <th key={j} className="rounded-xl bg-slate-50 p-1.5 text-center align-bottom ring-1 ring-inset ring-slate-200">
                  <span className="block text-xs font-extrabold text-slate-700">Ke-{j}</span>
                  <span className="block text-[10px] font-semibold text-slate-400">{w ? w.mulai : ""}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {HARI.map((h) => {
            const byMulai = new Map<number, BarisMatriksJadwal>();
            for (const it of items) {
              if (it.hari === h) byMulai.set(it.jamKeMulai, it);
            }
            const sel: React.ReactNode[] = [];
            for (let j = 1; j <= JAM_MULAI.length; ) {
              const it = byMulai.get(j);
              if (it) {
                const span = Math.max(1, Math.min(it.jamKeSelesai, JAM_MULAI.length) - it.jamKeMulai + 1);
                sel.push(
                  <td key={j} colSpan={span} className="p-0.5 align-top">
                    <Link
                      href={`/jadwal/${it.id}${linkQuery ? `?${linkQuery}` : ""}`}
                      className={cn("block min-h-12 rounded-lg p-1.5 ring-1 ring-inset transition", warnaMapel(it.mapel))}
                    >
                      <span className="block text-[13px] font-bold leading-tight text-slate-900">{it.mapel}</span>
                      <span className="block truncate text-[11px] font-semibold text-slate-500">
                        {mode === "guru" ? it.kelas : it.guru}
                      </span>
                      {span > 1 && (
                        <span className="block text-[10px] font-semibold text-slate-400">
                          jam {it.jamKeMulai}–{it.jamKeSelesai}
                        </span>
                      )}
                    </Link>
                  </td>
                );
                j += span;
              } else {
                sel.push(<td key={j} className="rounded-lg bg-slate-50/60 p-0.5" />);
                j += 1;
              }
            }
            return (
              <tr key={h}>
                <th className="sticky left-0 z-10 rounded-xl bg-white p-2 text-left text-sm font-extrabold text-slate-700 ring-1 ring-inset ring-slate-200">
                  {HARI_LABEL[h]}
                </th>
                {sel}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
