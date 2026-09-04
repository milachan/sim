import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa";
import ClientProviders from "@/components/client-providers";

export const metadata: Metadata = {
  title: {
    default: "Sistem Administrasi Guru — MTsN 2 Kebumen",
    template: "%s | Sistem Administrasi Guru",
  },
  description:
    "Sistem Administrasi Pembelajaran Guru: Jurnal, Absensi, dan Penilaian terintegrasi dengan jadwal mengajar.",
  manifest: "/manifest.json",
  applicationName: "Sistem Administrasi Guru",
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png", sizes: "512x512" },
      { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icons/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Sistem Guru",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#1e40af",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>
        <PwaRegister />
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
