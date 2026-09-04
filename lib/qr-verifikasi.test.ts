import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { baseUrlVerifikasi, payloadQrVerifikasi, urlVerifikasiKode } from "./verifikasi/qr-url";

// Test konfigurasi URL verifikasi & kontrak QR/lembar cetak.

const baca = (rel: string) => readFileSync(path.resolve(rel), "utf8");
// Normalisasi whitespace (teks JSX boleh terpecah baris oleh format).
const bacaFlat = (rel: string) => baca(rel).replace(/\s+/g, " ");

function env(opsi: Partial<NodeJS.ProcessEnv>): NodeJS.ProcessEnv {
  return { ...opsi } as NodeJS.ProcessEnv;
}

test("base URL berasal dari NEXTAUTH_URL (config), bukan request Host", () => {
  const base = baseUrlVerifikasi(env({ NEXTAUTH_URL: "https://demo.example.sch.id" }));
  assert.equal(base, "https://demo.example.sch.id");
  // Helper tidak menerima objek request/headers apa pun.
  const src = baca("lib/verifikasi/qr-url.ts");
  assert.ok(!/headers\.get\("host"|headers\.get\("x-forwarded-host"/.test(src));
  assert.match(src, /NEXTAUTH_URL/);
});

test("trailing slash ganda dinormalisasi", () => {
  assert.equal(baseUrlVerifikasi(env({ NEXTAUTH_URL: "https://a.sch.id//" })), "https://a.sch.id");
  assert.equal(baseUrlVerifikasi(env({ NEXTAUTH_URL: "https://a.sch.id/" })), "https://a.sch.id");
});

test("host publik non-HTTPS ditolak di semua mode; host lokal diizinkan HTTP", () => {
  assert.throws(() => baseUrlVerifikasi(env({ NEXTAUTH_URL: "http://demo.example.sch.id" })), /HTTPS/);
  assert.throws(() => baseUrlVerifikasi(env({ NEXTAUTH_URL: "http://demo.example.sch.id", NODE_ENV: "production" })), /HTTPS/);
  assert.throws(() => baseUrlVerifikasi(env({ NEXTAUTH_URL: "http://8.8.8.8", NODE_ENV: "production" })), /HTTPS/);
  // Host lokal (localhost, IP privat, nama mesin, .lan/.local) boleh HTTP di mana pun.
  for (const h of ["http://localhost:3210", "http://192.168.1.10:3000", "http://10.0.0.5", "http://server-lan:3000", "http://madrasah.lan:3000", "http://kantor.local"]) {
    assert.doesNotThrow(() => baseUrlVerifikasi(env({ NEXTAUTH_URL: h, NODE_ENV: "production" })), `${h} harus diizinkan`);
  }
  // Production HTTPS publik asli diterima.
  assert.doesNotThrow(() => baseUrlVerifikasi(env({ NEXTAUTH_URL: "https://demo.example.sch.id", NODE_ENV: "production" })));
});

test("development boleh HTTP localhost/LAN", () => {
  assert.doesNotThrow(() => baseUrlVerifikasi(env({ NEXTAUTH_URL: "http://localhost:3210", NODE_ENV: "development" })));
  assert.doesNotThrow(() => baseUrlVerifikasi(env({ NEXTAUTH_URL: "http://192.168.1.10:3000", NODE_ENV: "development" })));
  // Development tetap menolak host publik non-HTTPS.
  assert.throws(() => baseUrlVerifikasi(env({ NEXTAUTH_URL: "http://demo.example.sch.id", NODE_ENV: "development" })), /HTTPS/);
});

test("URL hanya mengandung parameter kode — tanpa field sensitif", () => {
  process.env.NEXTAUTH_URL = "https://demo.example.sch.id";
  const url = urlVerifikasiKode("KAHC-GC63-ED5M-GDFJ");
  const u = new URL(url);
  assert.equal(u.pathname, "/verifikasi-dokumen");
  assert.deepEqual([...u.searchParams.keys()], ["kode"]);
  assert.equal(u.searchParams.get("kode"), "KAHC-GC63-ED5M-GDFJ");
  for (const terlarang of ["dokumenId", "userId", "judul", "sha256", "kunci", "path"]) {
    assert.ok(!url.includes(terlarang), `URL tidak boleh memuat ${terlarang}`);
  }
});

test("payload QR sama persis dengan URL verifikasi; kode berbeda → payload berbeda", () => {
  process.env.NEXTAUTH_URL = "https://demo.example.sch.id";
  assert.equal(payloadQrVerifikasi("AAAAAAAAAAAAAAAA"), urlVerifikasiKode("AAAAAAAAAAAAAAAA"));
  assert.notEqual(payloadQrVerifikasi("AAAAAAAAAAAAAAAA"), payloadQrVerifikasi("BBBBBBBBBBBBBBBB"));
});

test("QR komponen: role img, aria-label, fallback URL, tanpa dangerouslySetInnerHTML", () => {
  const src = baca("components/administrasi/qr-verifikasi.tsx");
  assert.match(src, /role="img"/);
  assert.match(src, /aria-label=/);
  assert.match(src, /Pindai untuk memeriksa pencatatan dan integritas dokumen/);
  assert.ok(!src.includes("dangerouslySetInnerHTML"));
  assert.match(src, /TombolSalin/);
  assert.match(src, /payloadQrVerifikasi/);
  // Disclaimer wajib.
  assert.match(bacaFlat("components/administrasi/qr-verifikasi.tsx"), /bukan Tanda Tangan Elektronik tersertifikasi dan bukan cap digital resmi/);
  // QR hitam di atas putih + error correction Q + quiet zone.
  assert.match(src, /errorCorrectionLevel: EC_LEVEL/);
  assert.match(src, /dark: "#000000", light: "#ffffff"/);
  assert.match(src, /margin: 1/);
  // Tidak ada logo di tengah.
  assert.ok(!src.includes("image href") && !src.includes("<image"));
});

test("PanelDokumenFinal: QR hanya untuk final + tombol lembar + buka halaman", () => {
  const panel = baca("components/administrasi/panel-dokumen-final.tsx");
  assert.match(panel, /QrVerifikasi/);
  assert.match(panel, /Buka Halaman Verifikasi/);
  assert.match(panel, /Cetak Lembar Verifikasi/);
  assert.match(panel, /\/lembar-verifikasi/);
  // Kedua halaman detail hanya merender panel pada DIFINALKAN.
  assert.match(baca("app/(administrasi)/administrasi/[id]/page.tsx"), /d\.status === "DIFINALKAN" && d\.dokumenFinal/);
  assert.match(baca("app/(administrasi)/administrasi/kotak-masuk/[id]/page.tsx"), /d\.status === "DIFINALKAN" && d\.dokumenFinal/);
});

test("lembar cetak: otorisasi bolehBacaDokumen + notFound, tanpa storage key/userId/path", () => {
  const lembar = baca("app/(administrasi)/administrasi/[id]/lembar-verifikasi/page.tsx");
  assert.match(lembar, /bolehBacaDokumen\(user/);
  assert.match(lembar, /notFound\(\)/);
  assert.match(lembar, /redirect\("\/login"\)/);
  assert.ok(!lembar.includes("kunciPenyimpanan"));
  assert.ok(!lembar.includes("userId"));
  assert.ok(!lembar.includes("storage/dokumen"));
  // Status nonfinal ditolak.
  assert.match(lembar, /d\.status !== "DIFINALKAN" && d\.status !== "DIARSIPKAN"/);
});

test("print CSS: A4, tombol cetak no-print, QR 38mm, disclaimer", () => {
  const lembar = baca("app/(administrasi)/administrasi/[id]/lembar-verifikasi/page.tsx");
  assert.match(lembar, /@page \{ size: A4/);
  assert.match(lembar, /\.no-print/);
  assert.match(lembar, /38mm/);
  assert.match(lembar, /page-break-inside: avoid/);
  assert.match(bacaFlat("app/(administrasi)/administrasi/[id]/lembar-verifikasi/page.tsx"), /bukan Tanda Tangan Elektronik tersertifikasi dan bukan cap digital resmi/);
  // Tombol cetak client tanpa auto-print.
  const tombol = baca("components/administrasi/tombol-cetak.tsx");
  assert.match(tombol, /window\.print\(\)/);
  assert.ok(!tombol.includes("useEffect") && !tombol.includes("autoPrint"));
});

test("dependency QR: tepat satu (qrcode) dan didokumentasikan", () => {
  const pkg = JSON.parse(baca("package.json"));
  assert.ok(pkg.dependencies.qrcode, "qrcode harus ada di dependencies");
  assert.ok(!pkg.dependencies["qr-image"] && !pkg.dependencies["qr-code"], "jangan lebih dari satu library QR");
  const komponen = baca("components/administrasi/qr-verifikasi.tsx");
  assert.match(komponen, /satu-satunya dependency QR|terawat/);
});

test("env.example mendokumentasikan NEXTAUTH_URL sebagai base verifikasi", () => {
  const envExample = baca(".env.example");
  assert.match(envExample, /base URL absolut halaman verifikasi/i);
  assert.match(envExample, /tidak pernah dibangun dari header Host/i);
});
