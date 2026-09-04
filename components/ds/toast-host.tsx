"use client";

import { useEffect, useState } from "react";
import { useToast, type Toast } from "./toast";
import { cn } from "@/lib/utils";

/**
 * Host visual untuk semua toast. Dipasang sekali di root layout.
 *
 * Tata letak: tumpuk di pojok kanan-atas (atau full-width terpusat di mobile).
 * Toast masuk dengan animasi `fade-up`, keluar dengan fade-out.
 * Tidak saling menimpa — setiap toast memiliki slot sendiri dalam stack.
 */
export default function ToastHost() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-4 top-4 z-[100] mx-auto flex w-auto max-w-md flex-col gap-2 safe-top sm:right-4 sm:left-auto sm:inset-x-auto sm:w-[calc(100%-2rem)]"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [keluar, setKeluar] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handle = setTimeout(() => setKeluar(true), toast.durasi);
    return () => clearTimeout(handle);
  }, [toast.durasi]);

  useEffect(() => {
    if (!keluar) return;
    const handle = setTimeout(onDismiss, 180);
    return () => clearTimeout(handle);
  }, [keluar, onDismiss]);

  const isError = toast.jenis === "error";
  const ringClass = isError ? "ring-rose-200" : "ring-emerald-200";
  const textClass = isError ? "text-rose-900" : "text-emerald-900";
  const iconClass = isError ? "text-rose-600" : "text-emerald-600";
  const hoverClass = isError ? "hover:bg-rose-50 hover:text-rose-700" : "hover:bg-emerald-50 hover:text-emerald-700";
  const iconIdle = isError ? "text-rose-400" : "text-emerald-400";
  const labelAria = isError ? "Notifikasi kesalahan" : "Notifikasi sukses";

  return (
    <div
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-label={labelAria}
      className={cn(
        "pointer-events-auto flex items-start gap-2.5 rounded-xl bg-white px-4 py-3.5 text-sm font-semibold shadow-xl ring-1 transition-opacity",
        ringClass,
        textClass,
        isError ? "shadow-rose-900/10" : "shadow-emerald-900/10",
        mounted && !keluar ? "fade-up" : "",
        keluar && "opacity-0"
      )}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className={cn("mt-0.5 h-5 w-5 shrink-0", iconClass)} aria-hidden="true">
        {isError ? (
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        ) : (
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
            clipRule="evenodd"
          />
        )}
      </svg>
      <span className="flex-1 leading-5">{toast.pesan}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Tutup notifikasi"
        className={cn("shrink-0 rounded-md p-1 transition", iconIdle, hoverClass)}
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}
