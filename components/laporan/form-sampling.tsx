"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardCheck, Loader2, ShieldCheck } from "lucide-react";
import { simpanSampling, type ItemSampling } from "@/lib/actions/laporan-bulanan";

export default function FormSampling({ bulan, items, catatanAwal }: { bulan: string; items: ItemSampling[]; catatanAwal?: string | null }) {
  const [rows, setRows] = useState<ItemSampling[]>(items);
  const [catatan, setCatatan] = useState(catatanAwal ?? "");
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<{ teks: string; ok: boolean } | null>(null);

  const toggle = (guruId: string) => {
    setRows((r) => r.map((x) => (x.guruId === guruId ? { ...x, terverifikasi: !x.terverifikasi } : x)));
  };
  const setCatatanGuru = (guruId: string, teks: string) => {
    setRows((r) => r.map((x) => (x.guruId === guruId ? { ...x, catatan: teks } : x)));
  };
  const tandaiSemua = (v: boolean) => setRows((r) => r.map((x) => ({ ...x, terverifikasi: v })));

  const jumlahTerverifikasi = rows.filter((x) => x.terverifikasi).length;

  const submit = async () => {
    setSibuk(true);
    setPesan(null);
    try {
      await simpanSampling({ bulan, catatanWaka: catatan, items: rows });
      // redirect dilakukan server action; jika sampai sini berarti gagal redirect
    } catch (e) {
      setPesan({ teks: e instanceof Error ? e.message : "Gagal menyimpan sampling.", ok: false });
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500">
          Centang guru yang di-sampling untuk verifikasi ({jumlahTerverifikasi} dari {rows.length} guru). Simpan untuk
          menandai laporan <span className="font-bold">Sudah Diperiksa</span>.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => tandaiSemua(true)} className="btn-ghost btn-sm text-emerald-700">Semua</button>
          <button type="button" onClick={() => tandaiSemua(false)} className="btn-ghost btn-sm">Bersihkan</button>
        </div>
      </div>

      <div className="max-h-[50vh] space-y-2 overflow-y-auto overscroll-contain pr-1 sm:max-h-[420px]">
        {rows.map((x) => (
          <label
            key={x.guruId}
            className={`flex cursor-pointer flex-col gap-2 rounded-xl border p-3 transition sm:flex-row sm:items-center sm:gap-3 ${
              x.terverifikasi ? "border-emerald-400 bg-emerald-50/60" : "border-slate-200 bg-white hover:border-emerald-200"
            }`}
          >
            <input type="checkbox" checked={x.terverifikasi} onChange={() => toggle(x.guruId)} className="h-5 w-5 shrink-0 accent-emerald-600 sm:h-4 sm:w-4" />
            <div className="min-w-0 flex-1">
              <p className="break-words font-bold text-slate-800">{x.nama}</p>
              <p className="text-xs text-slate-500">
                {x.lengkap}/{x.total} pertemuan lengkap · {x.persen}%
              </p>
            </div>
            {x.terverifikasi && (
              <input
                type="text"
                value={x.catatan ?? ""}
                onChange={(e) => setCatatanGuru(x.guruId, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Catatan verifikasi (opsional)"
                className="input !py-2.5 text-sm sm:!py-1.5 sm:!text-xs sm:w-56 w-full"
              />
            )}
          </label>
        ))}
      </div>

      <div className="mt-4">
        <label className="label">Catatan Waka Kurikulum</label>
        <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={3} className="input min-h-24" placeholder="Ringkasan hasil verifikasi bulan ini (opsional)" />
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button onClick={submit} disabled={sibuk} className="btn-primary min-h-11 w-full sm:w-auto">
          {sibuk ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
          {sibuk ? "Menyimpan…" : "Simpan Sampling & Tandai Sudah Diperiksa"}
        </button>
        {pesan && (
          <span className={`flex items-center gap-1.5 text-sm font-semibold ${pesan.ok ? "text-emerald-700" : "text-rose-600"}`}>
            {pesan.ok ? <CheckCircle2 className="h-4 w-4" /> : null}
            {pesan.teks}
          </span>
        )}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
        <ShieldCheck className="h-3.5 w-3.5" /> Sampling tersimpan sebagai audit — setiap perubahan tercatat dengan waktu & user.
      </p>
    </div>
  );
}
