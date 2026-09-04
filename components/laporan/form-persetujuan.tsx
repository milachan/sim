"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, RotateCcw, ThumbsUp } from "lucide-react";
import { kembalikanLaporan, setujuiLaporan } from "@/lib/actions/laporan-bulanan";

export default function FormPersetujuan({
  bulan,
  status,
  catatanAwal,
}: {
  bulan: string;
  status: "DRAFT" | "DIPERIKSA" | "DISETUJUI";
  catatanAwal?: string | null;
}) {
  const [catatan, setCatatan] = useState(catatanAwal ?? "");
  const [sibuk, setSibuk] = useState<"setuju" | "kembali" | null>(null);
  const [pesan, setPesan] = useState<{ teks: string; ok: boolean } | null>(null);

  const jalankan = async (mode: "setuju" | "kembali") => {
    setSibuk(mode);
    setPesan(null);
    try {
      if (mode === "setuju") {
        await setujuiLaporan({ bulan, catatanKamad: catatan });
      } else {
        await kembalikanLaporan(bulan);
      }
    } catch (e) {
      setPesan({ teks: e instanceof Error ? e.message : "Gagal.", ok: false });
    } finally {
      setSibuk(null);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="chip bg-emerald-100 text-emerald-700">
          {status === "DISETUJUI" ? "✓ Sudah disetujui" : "Menunggu persetujuan"}
        </span>
        <span className="text-slate-500">
          {status === "DISETUJUI"
            ? "Laporan ini sudah disetujui Kepala Madrasah."
            : status === "DRAFT"
              ? "Laporan masih konsep — Waka belum melakukan sampling verifikasi."
              : "Laporan sudah diperiksa Waka, siap disetujui."}
        </span>
      </div>

      {status !== "DISETUJUI" && (
        <>
          <label className="label">Catatan Persetujuan</label>
          <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={3} className="input min-h-24" placeholder="Catatan Kepala Madrasah (opsional)" />
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button onClick={() => jalankan("setuju")} disabled={sibuk === "setuju" || status === "DRAFT"} className="btn-primary min-h-11 w-full sm:w-auto">
              {sibuk === "setuju" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
              Setujui Laporan
            </button>
            {status === "DIPERIKSA" && (
              <button onClick={() => jalankan("kembali")} disabled={!!sibuk} className="btn-secondary min-h-11 w-full sm:w-auto">
                {sibuk === "kembali" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Kembalikan ke Waka
              </button>
            )}
          </div>
        </>
      )}

      {status === "DISETUJUI" && (
        <button onClick={() => jalankan("kembali")} disabled={!!sibuk} className="btn-secondary min-h-11 w-full sm:w-auto">
          {sibuk === "kembali" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          Batal Setujui (kembalikan)
        </button>
      )}

      {pesan && (
        <p className={`mt-3 flex items-center gap-1.5 text-sm font-semibold ${pesan.ok ? "text-emerald-700" : "text-rose-600"}`}>
          {pesan.ok ? <CheckCircle2 className="h-4 w-4" /> : null}
          {pesan.teks}
        </p>
      )}
    </div>
  );
}
