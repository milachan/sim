"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";

/**
 * Mendaftarkan service worker (dipasang sekali di root layout).
 * Tidak merender apa pun — murni efek samping.
 */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Never let a service worker serve development RSC/webpack chunks.
    // A stale module graph is a common source of `factory.call` errors after HMR.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
      if ("caches" in window) {
        caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("sag-")).map((key) => caches.delete(key))));
      }
      return;
    }

    const daftarkan = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .catch(() => {
          /* dev mode / browser tak mendukung — abaikan */
        });
    };
    window.addEventListener("load", daftarkan);
    // Juga coba daftarkan bila load sudah lewat (mis. navigasi SPA)
    if (document.readyState === "complete") daftarkan();
    return () => {
      window.removeEventListener("load", daftarkan);
    };
  }, []);
  return null;
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Hook bersama: mendeteksi ketersediaan instalasi PWA.
 * Mengembalikan { canInstall, pasang }.
 */
function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [terpasang, setTerpasang] = useState(isStandalone);

  useEffect(() => {
    if (isStandalone()) {
      setTerpasang(true);
      return;
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setTerpasang(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const pasang = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
    } catch {
      /* dialog ditutup pengguna */
    }
  };

  return { canInstall: !terpasang && !!deferred, pasang };
}

/**
 * Tombol "Pasang Aplikasi" — muncul otomatis saat browser
 * mengizinkan instalasi (beforeinstallprompt, Chromium/Android).
 */
export function PwaInstallButton({ compact = false }: { compact?: boolean }) {
  const { canInstall, pasang } = usePwaInstall();
  if (!canInstall) return null;

  if (compact) {
    return (
      <button
        onClick={pasang}
        title="Pasang aplikasi di perangkat"
        aria-label="Pasang aplikasi di perangkat"
        className="rounded-lg p-2 text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700"
      >
        <Download className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button onClick={pasang} className="btn-secondary btn-sm">
      <Download className="h-4 w-4" />
      <span>Pasang Aplikasi</span>
    </button>
  );
}

/**
 * Banner sekali tampil saat aplikasi bisa dipasang (mobile).
 * Untuk digunakan di halaman login.
 */
export function PwaInstallBanner() {
  const { canInstall, pasang } = usePwaInstall();
  if (!canInstall) return null;

  return (
    <button
      onClick={pasang}
      className="flex w-full items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left transition hover:border-emerald-300 hover:bg-emerald-100"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
        <Smartphone className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-emerald-900">Pasang Aplikasi</span>
        <span className="block text-xs text-emerald-700">
          Akses lebih cepat dari layar utama — seperti aplikasi native.
        </span>
      </span>
      <Download className="h-5 w-5 shrink-0 text-emerald-600" />
    </button>
  );
}
