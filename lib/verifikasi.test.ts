import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import {
  buatPembatasLaju,
  normalisasiKodeVerifikasi,
  validasiFormatKode,
  ALFABET_KODE,
} from "./verifikasi/service";

// Unit test murni layanan verifikasi kode Dokumen Final.

const baca = (rel: string) => readFileSync(path.resolve(rel), "utf8");

test("normalisasi: uppercase + buang spasi/tanda hubung/karakter asing", () => {
  assert.equal(normalisasiKodeVerifikasi("abcd-efgh jklm npqr"), "ABCDEFGHJKLMNPQR");
  assert.equal(normalisasiKodeVerifikasi("  ABCD-EFGH-IJKL-MNOP  "), "ABCDEFGHIJKLMNOP");
  assert.equal(normalisasiKodeVerifikasi("abcd.efgh@abcd.efgh"), "ABCDEFGHABCDEFGH");
  assert.equal(normalisasiKodeVerifikasi(""), "");
});

test("format: 16 char alfabet kode diterima", () => {
  assert.equal(validasiFormatKode("ABCDEFGHJKLMNPQR"), null);
  assert.equal(validasiFormatKode("Z9Z9Z9Z9Z9Z9Z9Z9"), null);
});

test("format: panjang salah ditolak sebelum query", () => {
  assert.match(validasiFormatKode("ABC") ?? "", /16 karakter/);
  assert.match(validasiFormatKode("A".repeat(15)) ?? "", /16 karakter/);
  assert.match(validasiFormatKode("A".repeat(17)) ?? "", /16 karakter/);
  assert.match(validasiFormatKode("") ?? "", /16 karakter/);
});

test("format: karakter I/O/0/1 ditolak (di luar alfabet generator)", () => {
  for (const c of ["I", "O", "0", "1"]) {
    const kode = "A".repeat(15) + c;
    assert.match(validasiFormatKode(kode) ?? "", /I, O, 0, dan 1/);
    assert.ok(!ALFABET_KODE.includes(c));
  }
});

test("rate limiter in-memory: maks tercapai → ditolak, reset jendela → bebas", () => {
  const laju = buatPembatasLaju({ maks: 2, jendelaMs: 1000 });
  const t0 = 1_000_000;
  assert.equal(laju.habiskan("ip-a", t0), true);
  assert.equal(laju.habiskan("ip-a", t0 + 1), true);
  assert.equal(laju.habiskan("ip-a", t0 + 2), false); // ke-3 ditolak
  // IP berbeda tidak terpengaruh.
  assert.equal(laju.habiskan("ip-b", t0 + 3), true);
  // Jendela lewat → reset.
  assert.equal(laju.habiskan("ip-a", t0 + 1001), true);
});

test("middleware: route verifikasi publik + rate limit, administrasi tetap terlindungi", () => {
  const mw = baca("middleware.ts");
  assert.match(mw, /verifikasi-dokumen/);
  assert.match(mw, /pathname === "\/verifikasi-dokumen"/);
  assert.match(mw, /status: 429/);
  // authorized mengizinkan tanpa token HANYA untuk path verifikasi.
  assert.match(mw, /pathname === "\/verifikasi-dokumen"\) return true/);
  assert.match(mw, /return !!token/);
  // Matcher tidak mengecualikan verifikasi (middleware tetap dieksekusi).
  assert.ok(!mw.includes("!login|verifikasi-dokumen"));
  // Tidak membuka route administrasi lain.
  assert.ok(!mw.includes("administrasi"));
});

test("halaman verifikasi: robots noindex, disclaimer TTE, tanpa shell administrasi", () => {
  const layout = baca("app/verifikasi-dokumen/layout.tsx");
  assert.match(layout, /index: false/);
  assert.match(layout, /follow: false/);
  const page = baca("app/verifikasi-dokumen/page.tsx");
  assert.match(page, /bukan Tanda Tangan Elektronik tersertifikasi/);
  assert.match(page, /Kode Verifikasi/);
  assert.match(page, /method="get"/); // GET agar URL dapat dibagikan
  // Tidak memakai shell administrasi.
  assert.ok(!page.includes("administrasi-shell"));
  assert.ok(!page.includes("components/administrasi/page-header"));
});

test("service: hasil tidak membocorkan judul/nama/storage key", () => {
  const src = baca("lib/verifikasi/service.ts");
  // Info publik hanya field aman.
  assert.match(src, /kodeTerformat/);
  assert.match(src, /namaInstansi/);
  // Tidak mengembalikan judul dokumen, nama pengaju, atau storage key.
  assert.ok(!/judul:|pengaju|namaAsli:|kunciPenyimpanan:/.test(src.split("InfoPublikVerifikasi = {")[1]?.split("};")[0] ?? ""));
});

test("PanelDokumenFinal: link verifikasi memakai kode, bukan dokumenId/storage key", () => {
  const panel = baca("components/administrasi/panel-dokumen-final.tsx");
  assert.match(panel, /\/verifikasi-dokumen\?kode=/);
  assert.match(panel, /encodeURIComponent\(final\.kodeVerifikasi\)/);
  assert.ok(!panel.includes("/verifikasi-dokumen?dokumenId"));
  assert.ok(!panel.includes("Verifikasi Kode Dokumen QR"));
});
