import { formatAngka } from "@/lib/utils";

// Tabel hasil siswa READ-ONLY untuk /analisis-nilai.
// Sengaja tanpa input, checkbox, tombol, atau aksi massal — hanya menampilkan data.

export type BarisHasilSiswa = {
  siswaId: string;
  nama: string;
  nis: string | null;
  nilai: number | null;
  persen: number | null;
  statusKumpul: "DIKUMPULKAN" | "BELUM" | "TERLAMBAT";
  catatan: string | null;
};

const STATUS_CHIP: Record<BarisHasilSiswa["statusKumpul"], { label: string; kelas: string }> = {
  DIKUMPULKAN: { label: "Dikumpulkan", kelas: "bg-emerald-100 text-emerald-700" },
  TERLAMBAT: { label: "Terlambat", kelas: "bg-amber-100 text-amber-700" },
  BELUM: { label: "Belum", kelas: "bg-rose-100 text-rose-600" },
};

export default function TabelHasilSiswa({ rows }: { rows: BarisHasilSiswa[] }) {
  return (
    <div>
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="th text-left">Nama Siswa</th>
              <th className="th text-left">NIS</th>
              <th className="th text-right">Nilai</th>
              <th className="th text-right">Persentase</th>
              <th className="th text-left">Status Pengumpulan</th>
              <th className="th text-left">Catatan Guru</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const status = STATUS_CHIP[r.statusKumpul];
              return (
                <tr key={r.siswaId} className="border-t border-slate-100">
                  <td className="td break-words font-bold text-slate-800">{r.nama}</td>
                  <td className="td whitespace-nowrap font-semibold text-slate-500">{r.nis ?? "-"}</td>
                  <td className="td whitespace-nowrap text-right font-extrabold text-slate-900">
                    {r.nilai !== null ? formatAngka(r.nilai, 1) : "-"}
                  </td>
                  <td className="td whitespace-nowrap text-right font-semibold text-slate-600">
                    {r.persen !== null ? `${formatAngka(r.persen, 1)}%` : "-"}
                  </td>
                  <td className="td whitespace-nowrap">
                    <span className={`chip ${status.kelas}`}>{status.label}</span>
                  </td>
                  <td className="td max-w-[220px] break-words text-slate-500">{r.catatan || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] font-semibold text-slate-400 sm:hidden">
        Geser tabel untuk melihat kolom lainnya →
      </p>
      <p className="mt-1 text-[11px] font-medium text-slate-400">
        Persentase = nilai ÷ nilai maksimal × 100. Tanda “-” berarti nilai belum terisi.
      </p>
    </div>
  );
}
