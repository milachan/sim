"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  MousePointerClick,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

const KEY = "tour-guru-v1";

const LANGKAH = [
  {
    judul: "Buka Jadwal Saya",
    teks: "Klik menu “Jadwal Saya” di samping kiri (di HP ada di bar menu bawah, berlabel “Jadwal”) untuk melihat jadwal mengajar Anda minggu ini.",
    icon: CalendarDays,
  },
  {
    judul: "Pilih Kelas & Jam",
    teks: "Klik salah satu jam pelajaran, lalu tekan “Buka Pertemuan” di halaman detailnya — kelas, mapel, dan jam sudah terisi otomatis. Tombol ini muncul pada hari Anda mengajar.",
    icon: MousePointerClick,
  },
  {
    judul: "Isi Absensi & Jurnal",
    teks: "Isi absensi: tekan “Tandai Semua Hadir”, lalu ubah status siswa yang tidak hadir. Tulis jurnal — kolom Materi wajib, Kegiatan & lainnya opsional — lalu “Simpan Jurnal”.",
    icon: ClipboardCheck,
  },
] as const;

export default function TourPertama({ role }: { role: string }) {
  const [tampil, setTampil] = useState(false);
  const [langkah, setLangkah] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Hanya untuk guru, dan hanya sekali (ingatan di browser)
    if (role !== "GURU") return;
    try {
      if (localStorage.getItem(KEY)) return;
    } catch {
      /* localStorage tidak tersedia — biarkan tour tidak muncul */
    }
    // Tunda sebentar agar halaman terasa selesai dimuat dulu
    const t = setTimeout(() => setTampil(true), 600);
    return () => clearTimeout(t);
  }, [role]);

  function tutup() {
    setTampil(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* abaikan */
    }
  }

  // Fokus ke dialog saat terbuka + tutup dengan tombol Escape + kunci scroll latar
  useEffect(() => {
    if (!tampil) return;
    dialogRef.current?.focus();
    const sebelumnya = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") tutup();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = sebelumnya;
      window.removeEventListener("keydown", onKey);
    };
  }, [tampil]);

  if (!tampil) return null;

  const step = LANGKAH[langkah];

  // Portal ke <body>: kalau dialog dirender di dalam induk beranimasi
  // (.fade-up memakai transform), "position: fixed" ikut membungkus induknya
  // alih-alih viewport — di HP panel bisa menutupi halaman / berada di luar
  // layar dan tidak bisa ditutup. Diportal, posisinya selalu relatif viewport.
  return createPortal(
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/60 p-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-judul"
    >
      <div className="card fade-up flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden !rounded-3xl sm:max-h-[calc(100dvh-4rem)]">
        {/* Header */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-inset ring-white/10">
                <Image src="/logo.png" alt="Logo Sistem Administrasi Guru" width={512} height={512} className="h-9 w-9 object-contain" />
              </div>
              <div>
                <h2 id="tour-judul" className="text-lg font-extrabold leading-tight">
                  Selamat datang, Bapak/Ibu Guru!
                </h2>
                <p className="text-xs text-emerald-100/90">Panduan singkat — 3 langkah saja</p>
              </div>
            </div>
            <button
              onClick={tutup}
              aria-label="Tutup panduan (Escape)"
              className="rounded-lg p-1.5 text-emerald-50 transition hover:bg-white/15"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Indikator langkah */}
          <div className="mt-4 flex gap-1.5">
            {LANGKAH.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors",
                  i <= langkah ? "bg-white" : "bg-white/25"
                )}
              />
            ))}
          </div>
        </div>

        {/* Isi langkah */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100">
              <step.icon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-600">
                Langkah {langkah + 1} dari {LANGKAH.length}
              </p>
              <h3 className="mt-0.5 text-lg font-extrabold text-slate-900">{step.judul}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.teks}</p>
            </div>
          </div>

          {/* Aksi */}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button onClick={tutup} className="btn-ghost btn-sm min-h-11 w-full sm:w-auto">
              Lewati panduan
            </button>
            <div className="flex gap-2">
              {langkah > 0 && (
                <button onClick={() => setLangkah((l) => l - 1)} className="btn-secondary btn-sm min-h-11" aria-label="Langkah sebelumnya">
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              {langkah < LANGKAH.length - 1 ? (
                <button onClick={() => setLangkah((l) => l + 1)} className="btn-primary btn-sm min-h-11 flex-1 sm:flex-none">
                  Lanjut <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <Link href="/jadwal" onClick={tutup} className="btn-primary btn-sm min-h-11 flex-1 sm:flex-none">
                  <BookOpen className="h-4 w-4" /> Buka Jadwal Saya
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Catatan kecil */}
        <div className="flex shrink-0 items-start gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <p className="text-xs leading-relaxed text-slate-500">
            Panduan ini hanya tampil sekali. Setelah selesai, cukup pantau kartu{" "}
            <span className="font-bold text-slate-600">Jadwal Hari Ini</span> dan{" "}
            <span className="font-bold text-slate-600">Perlu Dilengkapi</span> di beranda — jurnal yang belum lengkap
            selalu diingatkan di sana.
          </p>
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
        </div>
      </div>
    </div>,
    document.body
  );
}
