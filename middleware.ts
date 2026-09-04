import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/*
 * Rate limiter in-memory khusus route verifikasi publik (/verifikasi-dokumen).
 * CATATAN: batas berlaku PER INSTANCE dan hilang saat restart — tidak ada
 * klaim perlindungan multi-instance. Tidak menyimpan kode verifikasi atau
 * IP mentah dalam log aplikasi.
 */
const JENDELA_MS = 5 * 60 * 1000;
const MAKS_PERCobaan = 20;
const percobaan = new Map<string, { jumlah: number; resetAt: number }>();

function kunciPeminta(req: { headers: { get(name: string): string | null } }): string {
  // Hanya memakai x-forwarded-for bila ada (deploy di belakang proxy);
  // fallback "lokal" untuk akses langsung.
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "lokal";
}

function cekLaju(kunci: string, sekarang: number): boolean {
  const entri = percobaan.get(kunci);
  if (!entri || sekarang > entri.resetAt) {
    percobaan.set(kunci, { jumlah: 1, resetAt: sekarang + JENDELA_MS });
    return true;
  }
  entri.jumlah += 1;
  return entri.jumlah <= MAKS_PERCobaan;
}

export default withAuth(
  function middleware(req) {
    const pathname = req.nextUrl.pathname;

    // Rate limit hanya untuk percobaan verifikasi (ada param kode).
    if (pathname === "/verifikasi-dokumen" && req.nextUrl.searchParams.has("kode")) {
      const sekarang = Date.now();
      if (!cekLaju(kunciPeminta(req), sekarang)) {
        return new NextResponse(
          "Terlalu banyak percobaan verifikasi. Silakan tunggu beberapa menit lalu coba lagi.",
          { status: 429, headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "300" } }
        );
      }
    }

    const token = (req as unknown as { nextauth?: { token?: { sub?: string; wajibGantiPassword?: boolean } } }).nextauth?.token;
    // Bila pengguna wajib mengganti password awal, arahkan ke halaman khusus.
    // Validasi final tetap di server; ini hanya lapisan awal agar tidak membuka fitur lain.
    const isPageGanti = req.nextUrl.pathname === "/ganti-password-awal" || req.nextUrl.pathname === "/profil";
    if (token?.wajibGantiPassword && !isPageGanti) {
      const url = req.nextUrl.clone();
      url.pathname = "/ganti-password-awal";
      return NextResponse.redirect(url);
    }
    // Middleware hanya memastikan ada token sesi. Otorisasi role final selalu
    // dihitung ulang dari database di server (layout, halaman, server action,
    // dan API route) agar perubahan peran/status akun berlaku segera.
    // Role di dalam JWT memang hanya sebagai penunjuk sesi, bukan sumber otoritas.
    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
    callbacks: {
      authorized: ({ token, req }) => {
        // Pengecualian publik HANYA untuk halaman verifikasi kode Dokumen Final.
        if (req.nextUrl.pathname === "/verifikasi-dokumen") return true;
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * Lindungi semua halaman kecuali:
     * - /login
     * - /api/* (setiap route handler punya cek autentikasi sendiri,
     *   termasuk cron reminder yang pakai Bearer secret)
     * - aset statis (images, fonts, icons)
     * - file PWA: /manifest.json, /sw.js, /icons
     * /verifikasi-dokumen TETAP melewati middleware: authorized mengizinkan
     * tanpa token khusus untuk path itu (publik terbatas) + rate limit aktif.
     */
    "/((?!login|api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|json|woff2?)$).*)",
  ],
};
