import type { Metadata } from "next";

// Halaman verifikasi berdiri sendiri (publik terbatas) — tanpa shell rumah.
// Metadata robots: tidak diindeks mesin pencari.

export const metadata: Metadata = {
  title: "Verifikasi Dokumen Final",
  robots: { index: false, follow: false },
};

export default function VerifikasiLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50">{children}</div>;
}
