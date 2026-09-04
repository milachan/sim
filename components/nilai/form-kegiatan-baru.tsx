"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Plus } from "lucide-react";
import { buatKegiatan } from "@/lib/actions/nilai";
import { JENIS_KEGIATAN_LABEL, JENIS_KEGIATAN_LIST } from "@/lib/constants";

export default function FormKegiatanBaru({
  jadwalList,
  jadwalAwal,
}: {
  jadwalList: { id: string; label: string }[];
  jadwalAwal: string;
}) {
  const [jadwalId, setJadwalId] = useState(jadwalAwal);
  const [jenis, setJenis] = useState("KUIS");
  const [judul, setJudul] = useState("");
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [nilaiMaksimal, setNilaiMaksimal] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function simpan() {
    if (!jadwalId) {
      setError("Pilih jadwal kelas terlebih dahulu.");
      return;
    }
    if (!judul.trim()) {
      setError("Judul kegiatan wajib diisi.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await buatKegiatan({ jadwalId, jenis: jenis as never, judul, tanggal, nilaiMaksimal });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat kegiatan.");
      setLoading(false);
    }
  }

  return (
    <div className="card card-pad max-w-2xl">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label">Jadwal (kelas & mapel) *</label>
          <select className="input" value={jadwalId} onChange={(e) => setJadwalId(e.target.value)}>
            <option value="">— pilih jadwal —</option>
            {jadwalList.map((j) => (
              <option key={j.id} value={j.id}>{j.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Jenis Penilaian *</label>
          <select className="input" value={jenis} onChange={(e) => setJenis(e.target.value)}>
            {JENIS_KEGIATAN_LIST.map((j) => (
              <option key={j} value={j}>{JENIS_KEGIATAN_LABEL[j]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Tanggal *</label>
          <input type="date" className="input" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Judul Kegiatan *</label>
          <input className="input" value={judul} onChange={(e) => setJudul(e.target.value)} placeholder="mis. Kuis Bab 1 — Berpikir Komputasional" />
        </div>
        <div>
          <label className="label">Nilai Maksimal</label>
          <input
            type="number"
            min={1}
            max={1000}
            className="input"
            value={nilaiMaksimal}
            onChange={(e) => setNilaiMaksimal(Number(e.target.value))}
          />
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" /> {error}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button onClick={simpan} disabled={loading} className="btn-primary btn-lg">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
          Buat & Lanjut Input Nilai
        </button>
      </div>
    </div>
  );
}
