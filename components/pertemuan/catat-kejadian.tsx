"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { catatKejadianBanyak, hapusKejadian } from "@/lib/actions/kejadian";
import type { JenisKejadian } from "@prisma/client";

export type ItemKejadian = {
  id: string;
  siswaId: string;
  siswaNama: string;
  jenis: JenisKejadian;
  keterangan: string | null;
  dibuatOlehId: string | null;
};

const JENIS: { value: JenisKejadian; label: string; warna: string }[] = [
  { value: "TERLAMBAT", label: "Terlambat", warna: "bg-amber-100 text-amber-700" },
  { value: "IZIN_KELUAR", label: "Izin keluar", warna: "bg-sky-100 text-sky-700" },
  { value: "TIDAK_DI_KELAS", label: "Tidak di kelas", warna: "bg-rose-100 text-rose-700" },
  { value: "SAKIT", label: "Sakit", warna: "bg-violet-100 text-violet-700" },
  { value: "PULANG", label: "Pulang lebih awal", warna: "bg-teal-100 text-teal-700" },
  { value: "LAINNYA", label: "Kejadian lain", warna: "bg-slate-200 text-slate-700" },
];

const JENIS_LABEL = Object.fromEntries(JENIS.map((j) => [j.value, j.label])) as Record<JenisKejadian, string>;
const JENIS_WARNA = Object.fromEntries(JENIS.map((j) => [j.value, j.warna])) as Record<JenisKejadian, string>;

/**
 * Catat Kejadian Siswa — pendukung jurnal. Mencatat kejadian selama pelajaran
 * (terlambat, izin keluar, tidak berada di kelas, sakit, pulang, dsb) tanpa
 * mengubah absensi harian resmi siswa.
 *
 * Untuk kelas dengan banyak siswa (mis. 32), guru dapat mencari lalu menandai
 * beberapa siswa sekaligus dan mencatatnya dalam satu kali tambah.
 */
export default function CatatKejadian({
  pertemuanId,
  siswaList,
  kejadian,
  userId,
  bisaHapusSemua = false,
}: {
  pertemuanId: string;
  siswaList: { id: string; nama: string }[];
  kejadian: ItemKejadian[];
  userId: string;
  /** Admin dapat menghapus catatan siapa pun; guru hanya catatan miliknya. */
  bisaHapusSemua?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [terpilih, setTerpilih] = useState<Set<string>>(new Set());
  const [jenis, setJenis] = useState<JenisKejadian>("TERLAMBAT");
  const [keterangan, setKeterangan] = useState("");
  const [loading, setLoading] = useState(false);
  const [hapusId, setHapusId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const terfilter = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return siswaList;
    return siswaList.filter((s) => s.nama.toLowerCase().includes(t));
  }, [siswaList, q]);

  // Siswa yang sudah punya catatan di pertemuan ini (untuk penanda kecil).
  const sudahDicatat = useMemo(() => new Set(kejadian.map((k) => k.siswaId)), [kejadian]);

  function toggle(siswaId: string) {
    setTerpilih((prev) => {
      const next = new Set(prev);
      if (next.has(siswaId)) next.delete(siswaId);
      else next.add(siswaId);
      return next;
    });
  }

  async function tambah() {
    if (terpilih.size === 0) {
      setError("Pilih minimal satu siswa terlebih dahulu.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const hasil = await catatKejadianBanyak({
        pertemuanId,
        siswaIds: [...terpilih],
        jenis,
        keterangan,
      });
      if (hasil.ok) {
        setTerpilih(new Set());
        setKeterangan("");
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mencatat kejadian.");
    } finally {
      setLoading(false);
    }
  }

  async function hapus(id: string) {
    if (!window.confirm("Hapus catatan kejadian ini?")) return;
    setHapusId(id);
    setError(null);
    try {
      await hapusKejadian(id);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus catatan.");
    } finally {
      setHapusId(null);
    }
  }

  return (
    <div className="card card-pad">
      <h3 className="flex flex-wrap items-center gap-2 font-extrabold text-slate-900">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" /> Catat Kejadian Siswa
        <span className="chip bg-slate-100 text-slate-500">pendukung jurnal · opsional</span>
      </h3>
      <p className="mt-0.5 break-words text-xs text-slate-500">
        Catat kejadian selama pelajaran (terlambat, izin keluar, sakit, dll). Catatan ini tidak mengubah absensi harian resmi siswa.
      </p>

      {error && (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700">{error}</p>
      )}

      {/* Cari & pilih siswa */}
      <div className="mt-3 rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input !pl-9"
            placeholder={`Cari siswa… (${siswaList.length} siswa)`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {/* Daftar siswa terfilter — chip yang bisa ditandai */}
        <div className="mt-2 flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
          {terfilter.length === 0 && <p className="p-2 text-sm text-slate-400">Tidak ada siswa ditemukan.</p>}
          {terfilter.map((s) => {
            const aktif = terpilih.has(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                aria-pressed={aktif}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition",
                  aktif
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-100"
                )}
              >
                {aktif && <Check className="h-3 w-3" />}
                {s.nama}
                {sudahDicatat.has(s.id) && !aktif && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="Sudah punya catatan" />}
              </button>
            );
          })}
        </div>

        {terpilih.size > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="chip bg-emerald-100 text-emerald-700">{terpilih.size} siswa dipilih</span>
            <button onClick={() => setTerpilih(new Set())} className="btn-ghost btn-sm !min-h-8 !px-2 text-xs text-rose-500 hover:bg-rose-50">
              <X className="h-3 w-3" /> Kosongkan
            </button>
          </div>
        )}
      </div>

      {/* Jenis & keterangan (berlaku untuk semua siswa terpilih) */}
      <div className="mt-2 flex flex-col gap-2 sm:grid sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <select value={jenis} onChange={(e) => setJenis(e.target.value as JenisKejadian)} className="input w-full sm:w-44" aria-label="Jenis kejadian">
          {JENIS.map((j) => (
            <option key={j.value} value={j.value}>
              {j.label}
            </option>
          ))}
        </select>
        <input
          className="input w-full"
          placeholder="Keterangan (opsional) — mis. ke toilet 10 menit"
          value={keterangan}
          onChange={(e) => setKeterangan(e.target.value)}
        />
        <button onClick={tambah} disabled={loading} className="btn-primary btn-sm !min-h-11 w-full whitespace-nowrap sm:w-auto">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Tambah{terpilih.size > 0 ? ` ${terpilih.size}` : ""}
        </button>
      </div>

      {/* Daftar kejadian */}
      {kejadian.length > 0 && (
        <div className="mt-4 space-y-2">
          {kejadian.map((k) => (
            <div key={k.id} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-100">
              <span className={cn("chip shrink-0", JENIS_WARNA[k.jenis])}>{JENIS_LABEL[k.jenis]}</span>
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-bold text-slate-800">{k.siswaNama}</p>
                {k.keterangan && <p className="mt-0.5 break-words text-xs text-slate-500">{k.keterangan}</p>}
              </div>
              {(k.dibuatOlehId === userId || bisaHapusSemua) && (
                <button
                  onClick={() => hapus(k.id)}
                  disabled={hapusId === k.id}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Hapus catatan kejadian"
                  title="Hapus"
                >
                  {hapusId === k.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {kejadian.length === 0 && (
        <p className="mt-4 text-xs text-slate-400">Belum ada kejadian yang dicatat pada pertemuan ini.</p>
      )}
    </div>
  );
}
