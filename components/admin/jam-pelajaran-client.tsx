"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Plus, Save, Trash2, RotateCcw, AlertCircle } from "lucide-react";
import { HARI_LABEL } from "@/lib/constants";
import { JAM_PELAJARAN_DEFAULT_DURASI_MENIT, JAM_PELAJARAN_DEFAULT_JAM_MULAI } from "@/lib/jam-utils";
import { simpanJamPelajaran, type ItemJamPelajaran } from "@/lib/actions/admin";
import { Card, ErrorBanner, PageHeader, SuksesBanner } from "@/components/ui";
import type { Hari } from "@prisma/client";

const HARI_LIST: Hari[] = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];

type Props = {
  data: ItemJamPelajaran[];
  searchParams: { sukses?: string; error?: string };
};

export function AdminJamPelajaranClient({ data, searchParams }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<ItemJamPelajaran[]>(data);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(searchParams.error ?? "");

  // Kelompokkan per hari
  const grouped: Record<string, ItemJamPelajaran[]> = {};
  for (const h of HARI_LIST) grouped[h] = [];
  for (const item of items) {
    grouped[item.hari]?.push(item);
  }
  // Sort per hari
  for (const h of HARI_LIST) grouped[h]?.sort((a, b) => a.jamKe - b.jamKe);

  function updateItem(hari: string, jamKe: number, field: "mulai" | "selesai", value: string) {
    setItems((prev) =>
      prev.map((item) => (item.hari === hari && item.jamKe === jamKe ? { ...item, [field]: value } : item))
    );
  }

  function tambahJam(hari: string) {
    const existing = grouped[hari] ?? [];
    const nextJamKe = existing.length > 0 ? Math.max(...existing.map((e) => e.jamKe)) + 1 : 1;
    const prev = existing.find((e) => e.jamKe === nextJamKe - 1);
    const mulaiDefault = prev ? prev.selesai : JAM_PELAJARAN_DEFAULT_JAM_MULAI;
    const [hh, mm] = mulaiDefault.split(":").map(Number);
    const selesaiMenit = hh * 60 + mm + JAM_PELAJARAN_DEFAULT_DURASI_MENIT;
    const selesaiDefault = `${String(Math.floor(selesaiMenit / 60)).padStart(2, "0")}:${String(selesaiMenit % 60).padStart(2, "0")}`;
    setItems((prev) => [...prev, { hari: hari as Hari, jamKe: nextJamKe, mulai: mulaiDefault, selesai: selesaiDefault }]);
  }

  function hapusJam(hari: string, jamKe: number) {
    setItems((prev) => prev.filter((item) => !(item.hari === hari && item.jamKe === jamKe)));
  }

  async function simpan() {
    setLoading(true);
    setError("");
    try {
      await simpanJamPelajaran(items);
      router.push("/admin/jam-pelajaran?sukses=Jadwal jam pelajaran berhasil disimpan.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fade-up">
      <PageHeader
        title="Pengaturan Jam Pelajaran"
        subtitle="Atur waktu mulai & selesai tiap jam pelajaran per hari"
        icon={<Clock className="h-6 w-6" />}
      />
      <SuksesBanner message={searchParams.sukses} />
      <ErrorBanner message={error} />

      <Card className="card-pad mb-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button onClick={simpan} className="btn-primary" disabled={loading}>
            <Save className="h-4 w-4" /> {loading ? "Menyimpan..." : "Simpan Semua"}
          </button>
          <button onClick={() => setItems(data)} className="btn-ghost btn-sm" disabled={loading}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
          <p className="text-xs text-slate-400">
            Format waktu: <b>HH:mm</b> (24 jam). Setiap jam pelajaran ≈ {JAM_PELAJARAN_DEFAULT_DURASI_MENIT} menit.
          </p>
        </div>

        <div className="space-y-4">
          {HARI_LIST.map((hari) => (
            <div key={hari} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">{HARI_LABEL[hari]}</h3>
                <span className="text-xs font-semibold text-slate-500">{grouped[hari]?.length ?? 0} jam</span>
              </div>
              {grouped[hari]?.length === 0 ? (
                <p className="text-xs text-slate-400 italic">Belum ada jam pelajaran</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {grouped[hari]?.map((item) => (
                    <div key={item.jamKe} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <span className="w-8 text-center text-sm font-bold text-slate-700">Ke-{item.jamKe}</span>
                      <input
                        type="time"
                        value={item.mulai}
                        onChange={(e) => updateItem(hari, item.jamKe, "mulai", e.target.value)}
                        className="input !min-h-9 !rounded-lg !py-1.5 !text-xs"
                      />
                      <span className="text-xs text-slate-400">–</span>
                      <input
                        type="time"
                        value={item.selesai}
                        onChange={(e) => updateItem(hari, item.jamKe, "selesai", e.target.value)}
                        className="input !min-h-9 !rounded-lg !py-1.5 !text-xs"
                      />
                      <button
                        onClick={() => hapusJam(hari, item.jamKe)}
                        className="ml-auto text-slate-400 hover:text-rose-600"
                        title="Hapus jam ini"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => tambahJam(hari)}
                className="mt-2 flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                <Plus className="h-3.5 w-3.5" /> Tambah Jam
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          <AlertCircle className="mb-1 inline h-4 w-4" />
          Perubahan berlaku untuk seluruh pengguna. Jam yang dihapus dari daftar tidak akan muncul di form jadwal.
        </div>
      </Card>
    </div>
  );
}
