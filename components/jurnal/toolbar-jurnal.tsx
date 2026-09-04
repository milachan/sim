"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, Download, List, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Toolbar halaman /jurnal — satu panel ringkas agar tidak makan layar di HP:
 *   1. Pencarian (lebar penuh)
 *   2. Bulan · kelas · tombol filter tanggal
 *   3. Baris bawah: toggle Daftar/Kalender + aksi Excel/Reset
 *
 * Semua perubahan disimpan ke query string agar tetap bisa di-bookmark/di-share.
 */
export default function ToolbarJurnal({
  bulan,
  q,
  mode,
  tab,
  guru = "",
  kelas = "",
  tanggal = "",
  semua = false,
  kelasList = [],
}: {
  bulan: string;
  q: string;
  mode: "daftar" | "kalender";
  tab: string;
  guru?: string;
  kelas?: string;
  tanggal?: string;
  semua?: boolean;
  /** Daftar kelas untuk filter (kosong untuk role Guru yang tidak perlu filter kelas). */
  kelasList?: { id: string; nama: string }[];
}) {
  const router = useRouter();
  const [cari, setCari] = useState(q);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Filter tanggal spesifik terbuka otomatis bila ada tanggal terpilih, supaya
  // pengguna bisa melihat & menghapus filter tanggal yang sedang aktif.
  const [bukaLanjutan, setBukaLanjutan] = useState(Boolean(tanggal));

  useEffect(() => setCari(q), [q]);

  function push(ubah: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    sp.set("bulan", ubah.bulan ?? bulan);
    sp.set("q", ubah.q ?? q);
    sp.set("mode", ubah.mode ?? mode);
    sp.set("tab", ubah.tab ?? tab);
    if (ubah.guru !== undefined) sp.set("guru", ubah.guru);
    else if (guru) sp.set("guru", guru);
    if (ubah.kelas !== undefined) sp.set("kelas", ubah.kelas);
    else if (kelas) sp.set("kelas", kelas);
    if (ubah.tanggal !== undefined) sp.set("tanggal", ubah.tanggal);
    else if (tanggal) sp.set("tanggal", tanggal);
    if (ubah.semua !== undefined) sp.set("semua", ubah.semua);
    else if (semua) sp.set("semua", "1");
    // replace: perubahan filter tidak perlu menumpuk riwayat browser
    router.replace(`/jurnal?${sp.toString()}`, { scroll: false });
  }

  function gantiCari(v: string) {
    setCari(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => push({ q: v }), 400);
  }

  // Ada filter yang tidak default? Bulan default = bulan berjalan, jadi tanpa
  // parameter apa pun halaman sudah menampilkan kondisi standar.
  const adaFilterAktif = Boolean(q || kelas || tanggal || tab !== "semua" || guru || semua);

  // Daftar filter aktif sebagai chip — sumber tunggal untuk konsistensi
  // antara baris chip dan tombol Reset.
  const chipFilterAktif: { kunci: string; label: string; hapus: () => void }[] = [];
  if (q) chipFilterAktif.push({ kunci: "q", label: `Cari: "${q}"`, hapus: () => push({ q: "" }) });
  if (kelas) {
    const namaKelas = kelasList.find((k) => k.id === kelas)?.nama ?? kelas;
    chipFilterAktif.push({ kunci: "kelas", label: `Kelas: ${namaKelas}`, hapus: () => push({ kelas: "" }) });
  }
  if (guru) chipFilterAktif.push({ kunci: "guru", label: `Guru: ${guru}`, hapus: () => push({ guru: "" }) });
  if (tanggal) chipFilterAktif.push({ kunci: "tanggal", label: `Tanggal: ${tanggal}`, hapus: () => push({ tanggal: "" }) });
  if (tab !== "semua") chipFilterAktif.push({ kunci: "tab", label: `Status: ${tab}`, hapus: () => push({ tab: "semua" }) });
  if (semua) chipFilterAktif.push({ kunci: "semua", label: "Semua guru", hapus: () => push({ semua: "" }) });

  return (
    <div className="mb-4 space-y-2">
      {/* ===== Panel filter ===== */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 sm:p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={cari}
            onChange={(e) => gantiCari(e.target.value)}
            placeholder="Cari guru, mapel, atau materi…"
            className="input !pl-10"
            aria-label="Cari guru, mapel, atau materi"
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={bulan}
            onChange={(e) => e.target.value && push({ bulan: e.target.value, tanggal: "" })}
            className="input w-auto min-w-0 flex-1 sm:w-40 sm:flex-none"
            aria-label="Filter bulan dan tahun"
          />
          {kelasList.length > 0 && (
            <select
              value={kelas}
              onChange={(e) => push({ kelas: e.target.value })}
              className="input w-auto min-w-0 flex-1 sm:w-44 sm:flex-none"
              aria-label="Filter kelas"
            >
              <option value="">Semua kelas</option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setBukaLanjutan((b) => !b)}
            className={cn(
              "btn-secondary whitespace-nowrap",
              (tanggal || bukaLanjutan) && "border-emerald-400 bg-emerald-50 text-emerald-700"
            )}
            aria-expanded={bukaLanjutan}
            title="Filter tanggal spesifik"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Tanggal</span>
            {tanggal && <span className="ml-0.5 rounded-full bg-emerald-600 px-1.5 text-[10px] font-bold text-white">{tanggal.slice(8)}</span>}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", bukaLanjutan && "rotate-180")} />
          </button>
        </div>

        {/* Filter tanggal spesifik */}
        {bukaLanjutan && (
          <div className="mt-2 flex flex-col gap-2 rounded-lg bg-slate-50 p-2.5 ring-1 ring-inset ring-slate-200 sm:flex-row sm:items-center sm:gap-3">
            <div className="relative w-full sm:w-44">
              <input
                type="date"
                value={tanggal}
                onChange={(e) => push({ tanggal: e.target.value })}
                className="input w-full"
                aria-label="Filter tanggal spesifik"
                title="Saring ke satu tanggal tertentu"
              />
              {tanggal && (
                <button
                  onClick={() => push({ tanggal: "" })}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Hapus filter tanggal"
                  title="Hapus filter tanggal"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <p className="text-xs leading-snug text-slate-500">
              Saring ke satu tanggal — menggantikan rentang bulan; kosongkan untuk kembali ke seluruh bulan.
            </p>
          </div>
        )}

        {/* Chip ringkasan filter aktif — sentris di mobile: user tidak perlu cek URL. */}
        {chipFilterAktif.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Aktif:</span>
            {chipFilterAktif.map((c) => (
              <button
                key={c.kunci}
                type="button"
                onClick={c.hapus}
                className="inline-flex min-h-[28px] items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200 transition hover:bg-emerald-100"
                title={`Hapus filter: ${c.label}`}
              >
                <span className="break-words">{c.label}</span>
                <X className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="sr-only">Hapus filter</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ===== Tampilan (Daftar/Kalender) + aksi Excel/Reset ===== */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-xl bg-slate-100 p-1 ring-1 ring-inset ring-slate-200">
          <button
            onClick={() => push({ mode: "daftar" })}
            className={cn(
              "flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition",
              mode === "daftar" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
            aria-pressed={mode === "daftar"}
          >
            <List className="h-4 w-4" /> Daftar
          </button>
          <button
            onClick={() => push({ mode: "kalender" })}
            className={cn(
              "flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition",
              mode === "kalender" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
            aria-pressed={mode === "kalender"}
          >
            <CalendarDays className="h-4 w-4" /> Kalender
          </button>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`/api/export?t=jurnal&bulan=${bulan}${kelas ? `&kelas=${kelas}` : ""}${tanggal ? `&tanggal=${tanggal}` : ""}`}
            className="btn-secondary btn-sm min-h-11 sm:min-h-9"
            title="Unduh laporan jurnal (Excel) sesuai filter aktif"
          >
            <Download className="h-4 w-4" /> Excel
          </a>
          {adaFilterAktif && (
            <a href="/jurnal" className="btn-ghost btn-sm min-h-11 sm:min-h-9" title="Hapus semua filter (bulan berjalan, semua kelas, tanpa tanggal)">
              <RotateCcw className="h-4 w-4" /> Reset
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
