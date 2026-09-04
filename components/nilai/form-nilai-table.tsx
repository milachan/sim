"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, HelpCircle, Loader2, Save, Trash2, Wand2 } from "lucide-react";
import { hapusKegiatan, simpanNilai, type RowNilai } from "@/lib/actions/nilai";
import { STATUS_KUMPUL_LABEL } from "@/lib/constants";
import type { StatusKumpul } from "@prisma/client";
import { cn, statusNilai } from "@/lib/utils";

type Row = {
  siswaId: string;
  nama: string;
  nis: string | null;
  nilai: number | null;
  catatan: string;
  statusKumpul: StatusKumpul;
};

const STATUS_BADGE: Record<StatusKumpul, string> = {
  DIKUMPULKAN: "bg-emerald-100 text-emerald-700",
  BELUM: "bg-slate-200 text-slate-600",
  TERLAMBAT: "bg-orange-100 text-orange-700",
};

function highlightClass(status: ReturnType<typeof statusNilai>): string {
  if (status === "REMIDI") return "border-l-4 border-l-rose-500 bg-rose-50/40";
  if (status === "KOSONG") return "border-l-4 border-l-slate-300 bg-slate-50/40";
  return "border-l-4 border-l-emerald-500 bg-emerald-50/30";
}

function StatusLambang({ status }: { status: ReturnType<typeof statusNilai> }) {
  if (status === "REMIDI") {
    return (
      <span className="chip bg-rose-100 text-rose-700" title="Nilai di bawah KKM, perlu remidi">
        <AlertCircle className="h-3 w-3" /> Remidi
      </span>
    );
  }
  if (status === "KOSONG") {
    return (
      <span className="chip bg-slate-200 text-slate-600" title="Belum ada nilai">
        Kosong
      </span>
    );
  }
  return (
    <span className="chip bg-emerald-100 text-emerald-700" title="Nilai tuntas (≥ KKM)">
      <CheckCircle2 className="h-3 w-3" /> Tuntas
    </span>
  );
}

export default function FormNilaiTable({
  kegiatanId,
  nilaiMaksimal,
  kkm,
  bolehKelola,
  rows: initial,
}: {
  kegiatanId: string;
  nilaiMaksimal: number;
  kkm: number;
  bolehKelola: boolean;
  rows: Row[];
}) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ringkasan = useMemo(() => {
    let tuntas = 0;
    let remidi = 0;
    let kosong = 0;
    for (const r of rows) {
      const s = statusNilai(r.nilai, r.statusKumpul, kkm);
      if (s === "TUNTAS") tuntas++;
      else if (s === "REMIDI") remidi++;
      else kosong++;
    }
    return { tuntas, remidi, kosong };
  }, [rows, kkm]);

  function ubah(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.siswaId === id ? { ...r, ...patch } : r)));
  }

  // Mengetik nilai otomatis mengubah status menjadi Dikumpulkan (bila masih
  // BELUM) — mencegah guru lupa mengganti status lalu nilainya dianggap kosong.
  function isiNilai(id: string, raw: string) {
    const nilai = raw === "" ? null : Math.min(Number(raw), nilaiMaksimal);
    setRows((prev) =>
      prev.map((r) =>
        r.siswaId === id
          ? {
              ...r,
              nilai,
              ...(nilai !== null && r.statusKumpul === "BELUM" ? { statusKumpul: "DIKUMPULKAN" as const } : {}),
            }
          : r
      )
    );
  }

  function isiSemuaSama() {
    setRows((prev) => prev.map((r) => ({ ...r, statusKumpul: "DIKUMPULKAN" })));
  }

  async function simpan() {
    setLoading(true);
    setError(null);
    const data: RowNilai[] = rows.map((r) => ({
      siswaId: r.siswaId,
      nilai: r.nilai,
      catatan: r.catatan || null,
      statusKumpul: r.statusKumpul,
    }));
    try {
      await simpanNilai(kegiatanId, data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan nilai.");
      setLoading(false);
    }
  }

  async function hapus() {
    if (!confirm("Hapus kegiatan penilaian ini beserta semua nilainya?")) return;
    try {
      await hapusKegiatan(kegiatanId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus.");
    }
  }

  if (!bolehKelola) {
    return (
      <div className="space-y-3">
        <RingkasanStrip ringkasan={ringkasan} kkm={kkm} />
        <DaftarSiswaReadonly rows={rows} kkm={kkm} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card card-pad flex flex-wrap items-center gap-2">
        <button onClick={isiSemuaSama} className="btn-secondary btn-sm">
          <Wand2 className="h-4 w-4 text-violet-600" /> Tandai Semua Dikumpulkan
        </button>
        <button onClick={hapus} className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50">
          <Trash2 className="h-4 w-4" /> Hapus Kegiatan
        </button>
        <p className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 sm:text-sm">
          <span>Nilai maksimal {nilaiMaksimal}</span>
          <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
            KKM {kkm}
            <span
              title="Kriteria Ketuntasan Minimal. Nilai di bawah KKM berstatus remidi."
              className="cursor-help text-slate-400"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </span>
          </span>
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" /> {error}
        </div>
      )}

      <RingkasanStrip ringkasan={ringkasan} kkm={kkm} />

      <div className="card overflow-hidden">
        <div className="hidden md:block">
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="th">Siswa</th>
                  <th className="th w-32">Status</th>
                  <th className="th w-24">Nilai</th>
                  <th className="th">Status Ketuntasan</th>
                  <th className="th">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const status = statusNilai(r.nilai, r.statusKumpul, kkm);
                  return (
                    <tr key={r.siswaId} className={cn("border-t border-slate-100 transition", highlightClass(status))}>
                      <td className="td">
                        <p className="font-bold text-slate-900">{r.nama}</p>
                        <p className="text-xs text-slate-400">{r.nis ?? "—"}</p>
                      </td>
                      <td className="td">
                        <select
                          className="input !min-h-9 !py-1.5 text-xs"
                          value={r.statusKumpul}
                          onChange={(e) => ubah(r.siswaId, { statusKumpul: e.target.value as StatusKumpul })}
                        >
                          {(["DIKUMPULKAN", "BELUM", "TERLAMBAT"] as StatusKumpul[]).map((s) => (
                            <option key={s} value={s}>{STATUS_KUMPUL_LABEL[s]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="td">
                        <input
                          type="number"
                          min={0}
                          max={nilaiMaksimal}
                          step="0.01"
                          className="input !min-h-9 !py-1.5 text-center font-bold"
                          value={r.nilai ?? ""}
                          placeholder="-"
                          onChange={(e) => isiNilai(r.siswaId, e.target.value)}
                        />
                      </td>
                      <td className="td">
                        <StatusLambang status={status} />
                      </td>
                      <td className="td">
                        <input
                          className="input !min-h-9 !py-1.5 text-xs"
                          placeholder="Catatan (opsional)"
                          value={r.catatan}
                          onChange={(e) => ubah(r.siswaId, { catatan: e.target.value })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <ul className="divide-y divide-slate-100 md:hidden">
          {rows.map((r) => {
            const status = statusNilai(r.nilai, r.statusKumpul, kkm);
            return (
              <li key={r.siswaId} className={cn("p-3.5", highlightClass(status))}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-bold text-slate-900">{r.nama}</p>
                    <p className="text-xs text-slate-400">{r.nis ?? "—"}</p>
                  </div>
                  <StatusLambang status={status} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Nilai</label>
                    <input
                      type="number"
                      min={0}
                      max={nilaiMaksimal}
                      step="0.01"
                      className="input !min-h-10 text-center font-extrabold"
                      value={r.nilai ?? ""}
                      placeholder="-"
                      onChange={(e) => isiNilai(r.siswaId, e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Status Kumpul</label>
                    <select
                      className="input !min-h-10 text-xs"
                      value={r.statusKumpul}
                      onChange={(e) => ubah(r.siswaId, { statusKumpul: e.target.value as StatusKumpul })}
                    >
                      {(["DIKUMPULKAN", "BELUM", "TERLAMBAT"] as StatusKumpul[]).map((s) => (
                        <option key={s} value={s}>{STATUS_KUMPUL_LABEL[s]}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-2">
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Catatan</label>
                  <input
                    className="input !min-h-10 text-xs"
                    placeholder="Catatan (opsional)"
                    value={r.catatan}
                    onChange={(e) => ubah(r.siswaId, { catatan: e.target.value })}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="card card-pad flex justify-end">
        <button onClick={simpan} disabled={loading} className="btn-primary btn-lg min-h-11 w-full sm:w-auto">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          Simpan Semua Nilai
        </button>
      </div>
    </div>
  );
}

function RingkasanStrip({
  ringkasan,
  kkm,
}: {
  ringkasan: { tuntas: number; remidi: number; kosong: number };
  kkm: number;
}) {
  return (
    <div className="card card-pad">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Ringkasan Ketuntasan (KKM {kkm})
      </p>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-emerald-50 px-2 py-2.5">
          <p className="text-lg font-extrabold leading-tight text-emerald-700">{ringkasan.tuntas}</p>
          <p className="mt-0.5 text-[10px] font-bold uppercase text-emerald-700/80">Tuntas</p>
        </div>
        <div className="rounded-xl bg-rose-50 px-2 py-2.5">
          <p className="text-lg font-extrabold leading-tight text-rose-700">{ringkasan.remidi}</p>
          <p className="mt-0.5 text-[10px] font-bold uppercase text-rose-700/80">Remidi</p>
        </div>
        <div className="rounded-xl bg-slate-100 px-2 py-2.5">
          <p className="text-lg font-extrabold leading-tight text-slate-700">{ringkasan.kosong}</p>
          <p className="mt-0.5 text-[10px] font-bold uppercase text-slate-600">Kosong</p>
        </div>
      </div>
    </div>
  );
}

function DaftarSiswaReadonly({ rows, kkm }: { rows: Row[]; kkm: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="hidden md:block">
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="th">Siswa</th>
                <th className="th w-32">Status Kumpul</th>
                <th className="th w-24">Nilai</th>
                <th className="th">Status Ketuntasan</th>
                <th className="th">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const status = statusNilai(r.nilai, r.statusKumpul, kkm);
                return (
                  <tr key={r.siswaId} className={cn("border-t border-slate-100", highlightClass(status))}>
                    <td className="td font-bold">{r.nama}</td>
                    <td className="td">
                      <span className={cn("chip", STATUS_BADGE[r.statusKumpul])}>{STATUS_KUMPUL_LABEL[r.statusKumpul]}</span>
                    </td>
                    <td className="td font-bold">{r.nilai ?? "-"}</td>
                    <td className="td">
                      <StatusLambang status={status} />
                    </td>
                    <td className="td text-slate-500">{r.catatan || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ul className="divide-y divide-slate-100 md:hidden">
        {rows.map((r) => {
          const status = statusNilai(r.nilai, r.statusKumpul, kkm);
          return (
            <li key={r.siswaId} className={cn("p-3.5", highlightClass(status))}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="break-words font-bold text-slate-900">{r.nama}</p>
                  <p className="text-xs text-slate-400">{r.nis ?? "—"}</p>
                </div>
                <StatusLambang status={status} />
              </div>
              <div className="mt-2.5 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-slate-50 py-1.5">
                  <p className="text-[9px] font-bold uppercase text-slate-500">Nilai</p>
                  <p className="font-extrabold text-slate-900">{r.nilai ?? "-"}</p>
                </div>
                <div className="rounded-lg bg-slate-50 py-1.5">
                  <p className="text-[9px] font-bold uppercase text-slate-500">Kumpul</p>
                  <p className="font-bold text-slate-700">{STATUS_KUMPUL_LABEL[r.statusKumpul]}</p>
                </div>
                <div className="rounded-lg bg-slate-50 py-1.5">
                  <p className="text-[9px] font-bold uppercase text-slate-500">Catatan</p>
                  <p className="truncate font-bold text-slate-700">{r.catatan || "-"}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
