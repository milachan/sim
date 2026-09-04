"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastJenis = "success" | "error";

export type Toast = {
  id: string;
  jenis: ToastJenis;
  pesan: string;
  /** Milidetik. Default 5000 untuk success, 7000 untuk error. */
  durasi: number;
};

type ToastInput = {
  pesan: string;
  durasi?: number;
};

type ToastContextValue = {
  toasts: Toast[];
  push: (jenis: ToastJenis, input: ToastInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURASI: Record<ToastJenis, number> = {
  success: 5000,
  error: 7000,
};

/** Batas toast yang tampil bersamaan — sisanya masuk antrean. */
const MAX_TAMPIL = 3;

function buatId() {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const antrianRef = useRef<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((curr) => {
      const sisa = curr.filter((t) => t.id !== id);
      // Geser antrian naik bila ada slot kosong.
      if (sisa.length < MAX_TAMPIL && antrianRef.current.length > 0) {
        const berikutnya = antrianRef.current.shift()!;
        return [...sisa, berikutnya];
      }
      return sisa;
    });
  }, []);

  const push = useCallback<ToastContextValue["push"]>((jenis, { pesan, durasi }) => {
    const t: Toast = {
      id: buatId(),
      jenis,
      pesan,
      durasi: durasi ?? DEFAULT_DURASI[jenis],
    };
    setToasts((curr) => {
      if (curr.length < MAX_TAMPIL) return [...curr, t];
      antrianRef.current.push(t);
      return curr;
    });
    return t.id;
  }, []);

  const clear = useCallback(() => {
    antrianRef.current = [];
    setToasts([]);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, push, dismiss, clear }),
    [toasts, push, dismiss, clear]
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast harus dipakai di dalam <ToastProvider>.");
  }
  return ctx;
}

/**
 * Hook pembantu agar komponen SuksesBanner/ErrorBanner bisa mendorong ke
 * store hanya sekali per `message` (menghindari re-push saat re-render).
 */
export function usePushToast(
  ref: React.MutableRefObject<string | null>,
  jenis: ToastJenis,
  message: string | null | undefined
) {
  const { push, dismiss } = useToast();
  useEffect(() => {
    if (!message) {
      ref.current = null;
      return;
    }
    if (ref.current === message) return;
    ref.current = message;
    const id = push(jenis, { pesan: message });
    return () => {
      dismiss(id);
    };
    // Hanya bergantung pada message — push/dismiss stabil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, jenis]);
}
