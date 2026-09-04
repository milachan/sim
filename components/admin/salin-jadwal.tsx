"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { salinJadwalDariSemester } from "@/lib/actions/admin";

export type OpsiSemester = {
  id: string;
  nama: string;
  tahunAjaran: string;
  aktif: boolean;
  jumlahJadwal: number;
};

export function SalinJadwal({ semesterList }: { semesterList: OpsiSemester[] }) {
  const router = useRouter();
  const [sumberId, setSumberId] = useState("");
  const [targetId, setTargetId] = useState(semesterList.find((s) => s.aktif)?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState<{ oke: boolean; teks: string } | null>(null);

  const sumber = semesterList.find((s) => s.id === sumberId);
  const target = semesterList.find((s) => s.id === targetId);
  const labelSemester = (s?: OpsiSemester) => (s ? `${s.nama} — ${s.tahunAjaran}` : "-");
  const bisaSalin = !!sumber && !!target && sumber.id !== target.id && sumber.jumlahJadwal > 0;

  async function salin() {
    if (!bisaSalin || !sumber || !target) return;
    if (
      !window.confirm(
        `Salin ${sumber.jumlahJadwal} jadwal dari "${labelSemester(sumber)}" ke "${labelSemester(target)}"? ` +
          "Jadwal yang bentrok dengan slot yang sudah ada di semester target akan dilewati."
      )
    )
      return;
    setLoading(true);
    setPesan(null);
    try {
      const hasil = await salinJadwalDariSemester({ sumberId: sumber.id, targetId: target.id });
      setPesan({
        oke: true,
        teks:
          `${hasil.disalin} jadwal berhasil disalin ke "${labelSemester(target)}".` +
          (hasil.dilewati > 0 ? ` ${hasil.dilewati} dilewati karena bentrok dengan jadwal yang sudah ada.` : ""),
      });
      router.refresh();
    } catch (e) {
      setPesan({ oke: false, teks: e instanceof Error ? e.message : "Gagal menyalin jadwal." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {pesan && (
        <div
          role="status"
          className={
            pesan.oke
              ? "fade-up mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
              : "fade-up mb-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
          }
        >
          {pesan.teks}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Dari periode (sumber)</label>
          <select className="input" value={sumberId} onChange={(e) => setSumberId(e.target.value)}>
            <option value="">— pilih periode —</option>
            {semesterList.map((s) => (
              <option key={s.id} value={s.id} disabled={s.id === targetId}>
                {labelSemester(s)}
                {s.aktif ? " (aktif)" : ""} · {s.jumlahJadwal} jadwal
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Ke periode (target)</label>
          <select className="input" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            {semesterList.map((s) => (
              <option key={s.id} value={s.id} disabled={s.id === sumberId}>
                {labelSemester(s)}
                {s.aktif ? " (aktif)" : ""} · {s.jumlahJadwal} jadwal
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={salin} disabled={loading || !bisaSalin} className="btn-primary">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
          {sumber ? `Salin ${sumber.jumlahJadwal} jadwal` : "Salin Jadwal"}
        </button>
        {sumber && !bisaSalin && (
          <p className="text-sm text-amber-600">
            {sumber.jumlahJadwal === 0
              ? "Semester sumber belum punya jadwal."
              : "Pilih periode target yang berbeda dari sumber."}
          </p>
        )}
      </div>
    </div>
  );
}
