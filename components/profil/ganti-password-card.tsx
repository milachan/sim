"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { formAjukanGantiPassword } from "@/lib/actions/admin-forms";

export function GantiPasswordCard({ adaPending }: { adaPending: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [showLama, setShowLama] = useState(false);
  const [showBaru, setShowBaru] = useState(false);
  const [showKonfirmasi, setShowKonfirmasi] = useState(false);
  const [baru, setBaru] = useState("");
  const [konfirmasi, setKonfirmasi] = useState("");
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState<{ oke: boolean; teks: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    if (baru !== konfirmasi) {
      setPesan({ oke: false, teks: "Konfirmasi password baru tidak cocok." });
      return;
    }
    const formData = new FormData(e.currentTarget);
    setLoading(true);
    setPesan(null);
    try {
      await formAjukanGantiPassword(formData);
      setPesan({ oke: true, teks: "Permintaan ganti password telah dikirim. Menunggu persetujuan admin." });
      ref.current?.reset();
      setBaru("");
      setKonfirmasi("");
      router.refresh();
    } catch (err) {
      setPesan({ oke: false, teks: err instanceof Error ? err.message : "Gagal mengajukan permintaan." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form ref={ref} onSubmit={onSubmit} className="space-y-3">
      {adaPending && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Anda sudah memiliki permintaan ganti password yang belum diproses. Hubungi admin untuk menunggu konfirmasi.
          </span>
        </div>
      )}
      <div>
        <label className="label">Password Lama *</label>
        <div className="relative">
          <input
            type={showLama ? "text" : "password"}
            name="passwordLama"
            className="input pr-10"
            required
            minLength={6}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowLama((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
            aria-label={showLama ? "Sembunyikan password" : "Tampilkan password"}
          >
            {showLama ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div>
        <label className="label">Password Baru *</label>
        <div className="relative">
          <input
            type={showBaru ? "text" : "password"}
            name="passwordBaru"
            className="input pr-10"
            required
            minLength={6}
            value={baru}
            onChange={(e) => setBaru(e.target.value)}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowBaru((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
            aria-label={showBaru ? "Sembunyikan password" : "Tampilkan password"}
          >
            {showBaru ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">Minimal 6 karakter. Akan dikirim ke admin untuk dikonfirmasi.</p>
      </div>
      <div>
        <label className="label">Konfirmasi Password Baru *</label>
        <div className="relative">
          <input
            type={showKonfirmasi ? "text" : "password"}
            className="input pr-10"
            required
            minLength={6}
            value={konfirmasi}
            onChange={(e) => setKonfirmasi(e.target.value)}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowKonfirmasi((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
            aria-label={showKonfirmasi ? "Sembunyikan password" : "Tampilkan password"}
          >
            {showKonfirmasi ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {pesan && (
        <p
          className={`text-xs font-semibold ${pesan.oke ? "text-emerald-700" : "text-rose-700"}`}
          role={pesan.oke ? "status" : "alert"}
        >
          {pesan.teks}
        </p>
      )}
      <div className="flex items-center gap-2 pt-1">
        <button type="submit" className="btn-primary" disabled={adaPending || loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          Ajukan Ganti Password
        </button>
      </div>
      <p className="text-[11px] text-slate-500">
        Perubahan tidak langsung berlaku. Admin harus menyetujui permintaan terlebih dahulu.
      </p>
    </form>
  );
}
