"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Send } from "lucide-react";
import { buatJurnalManual } from "@/lib/actions/jurnal";

export default function FormJurnalManual({
  kelasList,
  mapelList,
}: {
  kelasList: { id: string; nama: string }[];
  mapelList: { id: string; nama: string }[];
}) {
  const [kelasId, setKelasId] = useState("");
  const [mapelId, setMapelId] = useState("");
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [alasan, setAlasan] = useState("");
  const [materi, setMateri] = useState("");
  const [tujuan, setTujuan] = useState("");
  const [kegiatan, setKegiatan] = useState("");
  const [metode, setMetode] = useState("");
  const [media, setMedia] = useState("");
  const [hasil, setHasil] = useState("");
  const [kendala, setKendala] = useState("");
  const [tindakLanjut, setTindakLanjut] = useState("");
  const [catatan, setCatatan] = useState("");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function simpan() {
    if (!alasan.trim()) {
      setError("Jurnal manual wajib mencantumkan alasan (mis. guru pengganti, remedial).");
      return;
    }
    if (!kelasId || !mapelId) {
      setError("Kelas dan mata pelajaran wajib diisi.");
      return;
    }
    if (!materi.trim()) {
      setError("Materi wajib diisi.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await buatJurnalManual(
        {
          kelasId,
          mapelId,
          tanggal,
          alasan,
          materi,
          tujuan,
          kegiatan,
          metode,
          media,
          hasil,
          kendala,
          tindakLanjut,
          catatan,
          dokumentasiUrl: "",
        },
        "TERKIRIM"
      );
      setLoading(false);
      if (res.ok) {
        router.push(`/pertemuan/${res.pertemuanId}?sukses=${encodeURIComponent("Jurnal manual berhasil dibuat.")}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat jurnal manual.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card card-pad">
        <h3 className="mb-4 font-extrabold text-slate-900">Informasi Pertemuan</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Kelas *</label>
            <select className="input" value={kelasId} onChange={(e) => setKelasId(e.target.value)}>
              <option value="">— pilih kelas —</option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.id}>{k.nama}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Mata Pelajaran *</label>
            <select className="input" value={mapelId} onChange={(e) => setMapelId(e.target.value)}>
              <option value="">— pilih mapel —</option>
              {mapelList.map((m) => (
                <option key={m.id} value={m.id}>{m.nama}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Tanggal *</label>
            <input type="date" className="input" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Alasan Jurnal Manual *</label>
            <textarea
              className="input min-h-[70px] resize-y"
              placeholder="mis. Menggantikan guru yang berhalangan hadir / remedial tambahan / jadwal mendadak"
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <h3 className="mb-4 font-extrabold text-slate-900">Isi Jurnal</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="label">Materi / Tema *</label>
            <input className="input" value={materi} onChange={(e) => setMateri(e.target.value)} placeholder="mis. Berpikir Komputasional" />
          </div>
          <div>
            <label className="label">Tujuan <span className="font-normal text-slate-400">(opsional)</span></label>
            <input className="input" value={tujuan} onChange={(e) => setTujuan(e.target.value)} placeholder="mis. Siswa mampu memahami…" />
          </div>
          <div>
            <label className="label">Metode <span className="font-normal text-slate-400">(opsional)</span></label>
            <input className="input" value={metode} onChange={(e) => setMetode(e.target.value)} placeholder="mis. Diskusi kelompok" />
          </div>
          <div>
            <label className="label">Media <span className="font-normal text-slate-400">(opsional)</span></label>
            <input className="input" value={media} onChange={(e) => setMedia(e.target.value)} placeholder="mis. Buku paket" />
          </div>
          <div>
            <label className="label">Hasil <span className="font-normal text-slate-400">(opsional)</span></label>
            <input className="input" value={hasil} onChange={(e) => setHasil(e.target.value)} placeholder="Hasil pembelajaran…" />
          </div>
          <div>
            <label className="label">Kegiatan <span className="font-normal text-slate-400">(opsional)</span></label>
            <textarea className="input min-h-[80px]" value={kegiatan} onChange={(e) => setKegiatan(e.target.value)} placeholder="Uraian kegiatan pembelajaran…" />
          </div>
          <div>
            <label className="label">Kendala <span className="font-normal text-slate-400">(opsional)</span></label>
            <textarea className="input min-h-[80px]" value={kendala} onChange={(e) => setKendala(e.target.value)} placeholder="Kendala yang dihadapi" />
          </div>
          <div>
            <label className="label">Tindak Lanjut <span className="font-normal text-slate-400">(opsional)</span></label>
            <textarea className="input min-h-[80px]" value={tindakLanjut} onChange={(e) => setTindakLanjut(e.target.value)} placeholder="Rencana tindak lanjut" />
          </div>
          <div>
            <label className="label">Catatan <span className="font-normal text-slate-400">(opsional)</span></label>
            <textarea className="input min-h-[80px]" value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan tambahan" />
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" /> {error}
        </div>
      )}

      <div className="card card-pad flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <p className="mr-auto text-xs text-slate-400">Waktu pengisian asli tetap tercatat oleh sistem.</p>
        <button onClick={simpan} disabled={loading} className="btn-primary btn-lg">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          Simpan Jurnal
        </button>
      </div>
    </div>
  );
}
