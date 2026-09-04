"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, MessageCircle, Send, XCircle } from "lucide-react";

/**
 * Panel admin WhatsApp (halaman Pengaturan Sistem): kirim pengingat jurnal
 * via gateway Fonnte ke guru yang nomornya terdaftar, plus uji coba ke akun ini.
 */
export function WhatsAppAdminPanel() {
  const [sibuk, setSibuk] = useState<"reminder" | "test" | null>(null);
  const [hasil, setHasil] = useState<{ teks: string; ok: boolean } | null>(null);

  const jalankan = async (mode: "reminder" | "test") => {
    setSibuk(mode);
    setHasil(null);
    try {
      const r = await fetch(`/api/wa/reminder?${mode === "test" ? "test=1" : "force=1"}`, { method: "POST" });
      const d = await r.json();
      setHasil({ teks: d?.pesan ?? "Perintah dijalankan.", ok: !!d?.ok });
    } catch {
      setHasil({ teks: "Gagal terhubung ke server.", ok: false });
    } finally {
      setSibuk(null);
    }
  };

  return (
    <div className="card card-pad">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white ring-1 ring-inset ring-emerald-700/20">
          <MessageCircle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-extrabold text-slate-900">Notifikasi WhatsApp (Fonnte)</h3>
          <p className="mt-1 text-sm text-slate-500">
            Kirim pengingat jurnal via WhatsApp ke guru yang punya nomor terdaftar. Token & status aktif diatur pada
            form di atas. Untuk penjadwalan otomatis di server, panggil{" "}
            <code className="rounded bg-slate-100 px-1 text-xs">GET /api/wa/reminder</code> dengan{" "}
            <code className="rounded bg-slate-100 px-1 text-xs">Authorization: Bearer &lt;PUSH_CRON_SECRET&gt;</code>{" "}
            (cron harian — satu jadwal cukup untuk push & WhatsApp).
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => jalankan("reminder")} disabled={!!sibuk} className="btn-primary btn-sm">
          {sibuk === "reminder" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Kirim Pengingat WhatsApp Sekarang
        </button>
        <button onClick={() => jalankan("test")} disabled={!!sibuk} className="btn-secondary btn-sm">
          {sibuk === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
          Uji Coba ke Akun Ini
        </button>
      </div>

      {hasil && (
        <p
          className={`mt-3 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${
            hasil.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {hasil.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
          {hasil.teks}
        </p>
      )}
    </div>
  );
}
