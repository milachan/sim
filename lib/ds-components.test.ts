import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";

// Kontrak migrasi komponen halaman ke design system tiga rumah.

const baca = (rel: string) => readFileSync(path.resolve(rel), "utf8");
const ds = (n: string) => baca(`components/ds/${n}`);

test("komponen inti ds lengkap", () => {
  for (const f of ["page-header", "card", "stat-card", "empty-state", "filter-tabs", "alert", "section-header", "skeleton"]) {
    assert.ok(
      (() => { try { return baca(`components/ds/${f}.tsx`).length > 0; } catch { return false; } })(),
      `components/ds/${f}.tsx harus ada`
    );
  }
});

test("PageHeader responsif: actions turun ke baris berikutnya di mobile", () => {
  const src = ds("page-header.tsx");
  assert.match(src, /flex-col gap-4 sm:flex-row/);
  assert.match(src, /flex-wrap/);
  // breadcrumb terakhir aria-current
  assert.match(src, /aria-current=\{last \? "page" : undefined\}/);
});

test("PageHeader memakai workspace accent untuk identitas, bukan status", () => {
  const src = ds("page-header.tsx");
  assert.match(src, /bg-accent-soft/);
  assert.match(src, /text-accent-foreground/);
  assert.ok(!/emerald|rose/.test(src));
});

test("Card interactive wajib href — tidak ada kartu interaktif mati", () => {
  const src = ds("card.tsx");
  assert.match(src, /variant === "interactive"/);
  assert.match(src, /memerlukan href/);
  assert.match(src, /min-h-\[44px\]/);
});

test("EmptyState tanpa action tidak merender tombol/link kosong", () => {
  const src = ds("empty-state.tsx");
  assert.match(src, /\{action && /);
  // Tidak ada render button/link tanpa syarat di dalam komponen.
  assert.ok(!/<button(?![^>]*\{)/.test(src));
  assert.ok(!/<Link(?![^>]*\{)/.test(src));
});

test("FilterTabs memakai aria-current dan overflow aman", () => {
  const src = ds("filter-tabs.tsx");
  assert.match(src, /aria-current=\{tabAktif \? "true" : undefined\}/);
  assert.match(src, /overflow-x-auto/);
  assert.match(src, /min-h-\[44px\]/);
  // Active state bukan warna saja: ada indikator titik + font-bold + aria.
  assert.match(src, /rounded-full/, "indikator titik");
  assert.match(src, /font-bold/);
});

test("Alert: destructive memakai role alert; warna status semantic tetap", () => {
  const src = ds("alert.tsx");
  assert.match(src, /role=\{variant === "destructive" \? "alert" : "status"\}/);
  for (const w of ["blue-50", "emerald-50", "amber-50", "rose-50"]) {
    assert.ok(src.includes(w), `variant ${w} harus ada`);
  }
  // Tidak memakai aksen workspace.
  assert.ok(!src.includes("accent"));
});

test("StatCard tone semantic — tidak memakai workspace accent", () => {
  const src = ds("stat-card.tsx");
  assert.ok(!src.includes("accent"));
  for (const t of ["slate", "blue", "emerald", "amber", "violet", "rose"]) {
    assert.ok(src.includes(`${t}:`), `tone ${t} harus tersedia`);
  }
  assert.match(src, /min-h-\[44px\]/);
});

test("Skeleton reduced-motion friendly", () => {
  const src = ds("skeleton.tsx");
  assert.match(src, /motion-safe:animate-pulse/);
  assert.match(src, /role="status"/);
});

test("komponen ds memakai token, tanpa raw hex", () => {
  for (const f of ["page-header", "card", "stat-card", "empty-state", "filter-tabs", "alert", "section-header", "skeleton"]) {
    const src = ds(`${f}.tsx`);
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(src), `${f} tidak boleh memakai raw hex`);
  }
});

test("API lama administrasi dimigrasikan ke ds (facade lama dihapus)", () => {
  assert.ok(!(() => { try { return baca("components/administrasi/page-header.tsx").length > 0; } catch { return false; } })());
  assert.ok(!(() => { try { return baca("components/administrasi/stat-card.tsx").length > 0; } catch { return false; } })());
  assert.ok(!(() => { try { return baca("components/administrasi/empty-state.tsx").length > 0; } catch { return false; } })());
  // Halaman administrasi memakai ds.
  for (const rel of [
    "app/(administrasi)/administrasi/page.tsx",
    "app/(administrasi)/administrasi/dokumen-saya/page.tsx",
    "app/(administrasi)/administrasi/baru/page.tsx",
    "app/(administrasi)/administrasi/kotak-masuk/page.tsx",
    "app/(administrasi)/administrasi/kotak-masuk/[id]/page.tsx",
    "app/(administrasi)/administrasi/arsip/page.tsx",
    "app/(administrasi)/administrasi/template/page.tsx",
    "app/(administrasi)/administrasi/[id]/page.tsx",
  ]) {
    assert.match(baca(rel), /components\/ds\//, `${rel} harus memakai komponen ds`);
  }
});

test("Analisis Nilai memakai komponen ds dan tetap jujur", () => {
  const src = baca("app/(analisis)/analisis-nilai/page.tsx");
  assert.match(src, /components\/ds\/page-header/);
  assert.match(src, /components\/ds\/card/);
  assert.match(src, /components\/ds\/alert/);
  // Jujur tentang sumber data: penilaian manual, CBT belum aktif.
  assert.match(src, /penilaian manual/i);
  assert.match(src, /Integrasi CBT belum aktif/);
  // Keadaan kosong memakai EmptyState ds, bukan angka palsu.
  assert.match(src, /components\/ds\/empty-state/);
});

test("Analisis Nilai memiliki loading/error memakai ds", () => {
  assert.match(baca("app/(analisis)/analisis-nilai/loading.tsx"), /components\/ds\/skeleton/);
  const err = baca("app/(analisis)/analisis-nilai/error.tsx");
  assert.match(err, /reset\(\)/);
  assert.match(err, /role="alert"/);
  assert.ok(!/error\.(message|stack|digest)/.test(err));
});

test("Rumah Jurnal tidak dimigrasikan — ui.tsx dan shell tetap", () => {
  const ui = baca("components/ui.tsx");
  // Kompatibilitas Rumah Jurnal: API lama harus tetap tersedia untuk diimpor
  // dari "components/ui" (compatibility layer). Bentuk deklarasi boleh:
  //   - `export function <Name> { ... }`     (named function declaration)
  //   - `export { X as <Name> } from "..."`  (re-export alias)
  //   - `export const <Name> = ...`          (named binding)
  // Kontrak yang dijaga: SETIAP nama berikut dapat diimpor dari "components/ui".
  const polaEkspor: Record<string, RegExp> = {
    PageHeader: /export\s+(?:function|const|let|var)\s+PageHeader\b|export\s*\{[^}]*\bas\s+PageHeader\b/,
    Card: /export\s+(?:function|const|let|var)\s+Card\b|export\s*\{[^}]*\bas\s+Card\b/,
    StatCard: /export\s+(?:function|const|let|var)\s+StatCard\b|export\s*\{[^}]*\bas\s+StatCard\b/,
    EmptyState: /export\s+(?:function|const|let|var)\s+EmptyState\b|export\s*\{[^}]*\bas\s+EmptyState\b/,
    Breadcrumb: /export\s+(?:function|const|let|var)\s+Breadcrumb\b|export\s*\{[^}]*\bas\s+Breadcrumb\b/,
    SuksesBanner: /export\s+(?:function|const|let|var)\s+SuksesBanner\b|export\s*\{[^}]*\bas\s+SuksesBanner\b/,
    ErrorBanner: /export\s+(?:function|const|let|var)\s+ErrorBanner\b|export\s*\{[^}]*\bas\s+ErrorBanner\b/,
  };
  for (const [nama, pola] of Object.entries(polaEkspor)) {
    assert.match(ui, pola, `${nama} harus tetap di-export dari ui.tsx`);
  }
  // Shell Rumah Jurnal tidak boleh dirombak menjadi dependensi baru
  // di luar helper yang sudah dipakai. Cukup verifikasi file ini masih
  // memakai AppShell default yang menjadi entry shell Rumah Jurnal.
  const shell = baca("components/app-shell.tsx");
  assert.match(shell, /export\s+default\s+function\s+AppShell\b/);
});

test("status badge tidak mengikuti workspace accent", () => {
  const badge = baca("lib/dokumen-validasi.ts");
  assert.match(badge, /DIFINALKAN: "bg-violet-100 text-violet-700"/);
  assert.match(badge, /DISETUJUI: "bg-emerald-100 text-emerald-700"/);
  assert.match(badge, /PERLU_REVISI: "bg-amber-100 text-amber-700"/);
  assert.match(badge, /DIKIRIM: "bg-blue-100 text-blue-700"/);
  assert.match(badge, /DRAF: "bg-slate-100 text-slate-600"/);
  assert.ok(!badge.includes("accent"));
});

test("loading administrasi memakai skeleton ds", () => {
  assert.match(baca("app/(administrasi)/administrasi/loading.tsx"), /components\/ds\/skeleton/);
});

test("form loading/disabled mempertahankan semantik (aria-busy/disabled/role alert)", () => {
  const form = baca("components/administrasi/dokumen-forms.tsx");
  assert.match(form, /disabled=\{pending\}/);
  assert.match(form, /role="alert"/);
  assert.match(form, /Menyimpan…/);
});
