"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep the production UI useful without exposing internal stack traces.
    // The full error remains available in the server log for diagnosis.
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6 py-12">
      <section className="card w-full max-w-md p-6 text-center sm:p-8" role="alert">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
          <AlertTriangle className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-xl font-extrabold tracking-tight text-slate-950">Halaman mengalami kendala</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Data belum dapat ditampilkan. Coba muat ulang halaman atau kembali setelah beberapa saat.
        </p>
        <button type="button" onClick={() => reset()} className="btn-primary mt-6 w-full">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Coba lagi
        </button>
      </section>
    </main>
  );
}
