"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Power, PowerOff } from "lucide-react";
import { aktifkanTemplate, nonaktifkanTemplate } from "@/lib/actions/template";
import KonfirmasiDuaLangkah from "@/components/administrasi/konfirmasi-dua-langkah";

// Aktifkan / nonaktifkan template — konfirmasi dua langkah, anti double-submit.
// Nonaktif TIDAK menghapus data/file; pengguna hanya kehilangan akses unduh.

export function TombolAktifkanTemplate({ id, jumlahVersi }: { id: string; jumlahVersi: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [sukses, setSukses] = useState(false);
  const boleh = jumlahVersi >= 1;

  if (!boleh) {
    return (
      <div className="space-y-1.5">
        <button type="button" disabled aria-disabled="true" className="btn-secondary w-full opacity-50" title="Butuh minimal satu versi file">
          <Power className="h-4 w-4" aria-hidden="true" />
          Aktifkan Template
        </button>
        <p className="text-[11px] leading-relaxed text-slate-500">
          Template belum memiliki versi file. Unggah file resmi terlebih dahulu untuk mengaktifkan.
        </p>
      </div>
    );
  }

  return (
    <div>
      <KonfirmasiDuaLangkah
        labelTombol="Aktifkan Template"
        ikon={Power}
        tonal="emerald"
        judulTinjau="Tinjau Aktivasi"
        deskripsiTinjau="Template aktif akan tampil di katalog guru."
        labelKonfirmasi="Ya, Aktifkan"
        pendingLabel="Mengaktifkan…"
        pending={pending}
        error={err}
        onKonfirmasi={() => {
          setErr(null);
          start(async () => {
            try {
              const r = await aktifkanTemplate(id);
              if (!r.ok) {
                setErr(r.error);
                return;
              }
              setSukses(true);
              router.refresh();
            } catch {
              setErr("Gagal mengaktifkan template.");
            }
          });
        }}
      >
        <p className="mt-3 rounded-xl bg-white px-3 py-2 text-[11px] leading-relaxed text-slate-600 ring-1 ring-inset ring-slate-200">
          Guru akan melihat template ini dan mengunduh <span className="font-bold">versi terbaru</span> setiap kali Anda
          mengunggah versi baru.
        </p>
      </KonfirmasiDuaLangkah>
      <p role="status" aria-live="polite" className={sukses ? "mt-2 text-xs font-semibold text-emerald-700" : "sr-only"}>
        {sukses ? "Template berhasil diaktifkan." : ""}
      </p>
    </div>
  );
}

export function TombolNonaktifkanTemplate({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [sukses, setSukses] = useState(false);

  return (
    <div>
      <KonfirmasiDuaLangkah
        labelTombol="Nonaktifkan Template"
        ikon={PowerOff}
        tonal="amber"
        judulTinjau="Tinjau Penonaktifan"
        deskripsiTinjau="Template disembunyikan dari katalog guru."
        labelKonfirmasi="Ya, Nonaktifkan"
        pendingLabel="Menonaktifkan…"
        pending={pending}
        error={err}
        onKonfirmasi={() => {
          setErr(null);
          start(async () => {
            try {
              const r = await nonaktifkanTemplate(id);
              if (!r.ok) {
                setErr(r.error);
                return;
              }
              setSukses(true);
              router.refresh();
            } catch {
              setErr("Gagal menonaktifkan template.");
            }
          });
        }}
      >
        <p className="mt-3 rounded-xl bg-white px-3 py-2 text-[11px] leading-relaxed text-slate-600 ring-1 ring-inset ring-slate-200">
          File dan riwayat versi <span className="font-bold">tidak dihapus</span> — guru hanya tidak dapat lagi
          melihat atau mengunduh template ini.
        </p>
      </KonfirmasiDuaLangkah>
      <p role="status" aria-live="polite" className={sukses ? "mt-2 text-xs font-semibold text-amber-700" : "sr-only"}>
        {sukses ? "Template dinonaktifkan." : ""}
      </p>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
        <Lock className="h-3 w-3" aria-hidden="true" />
        Tidak ada penghapusan permanen pada template.
      </p>
      {pending && <span className="sr-only">Menonaktifkan template…</span>}
    </div>
  );
}
