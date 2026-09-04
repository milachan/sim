"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ds/toast";
import ToastHost from "@/components/ds/toast-host";

/** Wrapper client untuk provider global — dipasang di root layout. */
export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <ToastHost />
    </ToastProvider>
  );
}
