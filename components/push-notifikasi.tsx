"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, CheckCircle2, Loader2, MonitorSmartphone, XCircle } from "lucide-react";

/** VAPID public key dikirim base64url — ubah ke Uint8Array untuk subscribe. */
function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

const headerJson = { "Content-Type": "application/json" };

/**
 * Kartu "Notifikasi Pengingat Jurnal" — dipakai di halaman Profil.
 * Meminta izin notifikasi, mendaftarkan langganan push ke server,
 * dan menyediakan tombol aktif/nonaktif.
 */
export function PushNotifikasiCard() {
  const [didukung, setDidukung] = useState<boolean | null>(null);
  const [izin, setIzin] = useState<NotificationPermission | "unknown">("unknown");
  const [terdaftar, setTerdaftar] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<{ teks: string; ok: boolean } | null>(null);

  useEffect(() => {
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setDidukung(ok);
    if (!ok) return;
    setIzin(Notification.permission);
    navigator.serviceWorker
      .ready.then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setTerdaftar(!!sub))
      .catch(() => {});
  }, []);

  const aktifkan = async () => {
    setSibuk(true);
    setPesan(null);
    try {
      const izinBaru = await Notification.requestPermission();
      setIzin(izinBaru);
      if (izinBaru !== "granted") {
        setPesan({ teks: "Izin notifikasi ditolak. Buka pengaturan browser lalu izinkan notifikasi untuk situs ini.", ok: false });
        return;
      }
      const res = await fetch("/api/push/keys");
      const { publicKey } = await res.json();
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: headerJson,
        body: JSON.stringify(sub.toJSON()),
      });
      setTerdaftar(true);
      setPesan({ teks: "Notifikasi aktif! Anda akan diingatkan melengkapi jurnal setelah jam sekolah.", ok: true });
    } catch {
      setPesan({ teks: "Gagal mengaktifkan notifikasi. Pastikan koneksi internet stabil lalu coba lagi.", ok: false });
    } finally {
      setSibuk(false);
    }
  };

  const nonaktifkan = async () => {
    setSibuk(true);
    setPesan(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: headerJson,
          body: JSON.stringify(sub.toJSON()),
        });
        await sub.unsubscribe();
      }
      setTerdaftar(false);
      setPesan({ teks: "Notifikasi dimatikan. Anda tidak akan menerima pengingat lagi.", ok: true });
    } catch {
      setPesan({ teks: "Gagal mematikan notifikasi. Coba lagi.", ok: false });
    } finally {
      setSibuk(false);
    }
  };

  const statusChip = terdaftar
    ? "bg-emerald-100 text-emerald-700"
    : izin === "denied"
      ? "bg-rose-100 text-rose-700"
      : "bg-slate-100 text-slate-500";
  const statusLabel = terdaftar
    ? "Aktif"
    : izin === "denied"
      ? "Diblokir browser"
      : "Belum aktif";

  return (
    <div className="card card-pad">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
          <Bell className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-extrabold text-slate-900">Notifikasi Pengingat Jurnal</h3>
            <span className={`chip ${statusChip}`}>{statusLabel}</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Dapatkan pengingat otomatis setelah jam sekolah jika masih ada jurnal yang belum dilengkapi.
          </p>
        </div>
      </div>

      {didukung === false && (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
          <XCircle className="h-4 w-4 shrink-0" />
          Browser/perangkat ini belum mendukung notifikasi push. Gunakan Chrome di HP/komputer.
        </p>
      )}

      {didukung === true && (
        <div className="mt-4">
          {terdaftar ? (
            <button onClick={nonaktifkan} disabled={sibuk} className="btn-secondary w-full sm:w-auto">
              {sibuk ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}
              Nonaktifkan Notifikasi
            </button>
          ) : (
            <button onClick={aktifkan} disabled={sibuk} className="btn-primary w-full sm:w-auto">
              {sibuk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
              Aktifkan Notifikasi
            </button>
          )}

          {pesan && (
            <p
              className={`mt-3 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${
                pesan.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              {pesan.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
              {pesan.teks}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Panel admin (halaman Pengaturan Sistem): statistik perangkat terdaftar,
 * tombol kirim pengingat sekarang, dan tombol notifikasi uji coba.
 */
export function PushAdminPanel() {
  const [guruTerdaftar, setGuruTerdaftar] = useState<number | null>(null);
  const [perangkat, setPerangkat] = useState<number | null>(null);
  const [sibuk, setSibuk] = useState<"reminder" | "test" | null>(null);
  const [hasil, setHasil] = useState<{ teks: string; ok: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/push/reminder?stats=1")
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) {
          setGuruTerdaftar(d.guruTerdaftar);
          setPerangkat(d.perangkatTerdaftar);
        }
      })
      .catch(() => {});
  }, []);

  const jalankan = async (mode: "reminder" | "test") => {
    setSibuk(mode);
    setHasil(null);
    try {
      const r = await fetch(`/api/push/reminder?${mode === "test" ? "test=1" : "force=1"}`, { method: "POST" });
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
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">
          <MonitorSmartphone className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-extrabold text-slate-900">Notifikasi Web Push</h3>
          <p className="mt-1 text-sm text-slate-500">
            Guru mengaktifkan lewat halaman Profil. Pengingat jurnal dikirim otomatis setelah jam sekolah selesai.
            Untuk penjadwalan otomatis di server, panggil <code className="rounded bg-slate-100 px-1 text-xs">GET /api/push/reminder</code> dengan{" "}
            <code className="rounded bg-slate-100 px-1 text-xs">Authorization: Bearer &lt;PUSH_CRON_SECRET&gt;</code> (cron harian).
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="chip bg-emerald-100 text-emerald-700">{guruTerdaftar ?? "…"} guru terdaftar</span>
            <span className="chip bg-sky-100 text-sky-700">{perangkat ?? "…"} perangkat</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => jalankan("reminder")} disabled={!!sibuk} className="btn-primary btn-sm">
          {sibuk === "reminder" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
          Kirim Pengingat Sekarang
        </button>
        <button onClick={() => jalankan("test")} disabled={!!sibuk} className="btn-secondary btn-sm">
          {sibuk === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}
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
