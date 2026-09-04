import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";

// Kontrak fondasi design system tiga rumah.
// Membaca sumber secara statis — mencegah regresi token & shell.

const baca = (rel: string) => readFileSync(path.resolve(rel), "utf8");
const css = baca("app/globals.css");

function blokBlok(sumber: string): { selector: string; isi: string }[] {
  const hasil: { selector: string; isi: string }[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source_bersih(sumber)))) {
    hasil.push({ selector: m[1].trim(), isi: m[2] });
  }
  return hasil;
}

// Buang komentar CSS agar tidak mengganggu parsing blok.
function source_bersih(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, "");
}

test("tiga shell memiliki data-workspace yang benar", () => {
  assert.match(baca("components/app-shell.tsx"), /data-workspace="jurnal"/);
  assert.match(baca("components/administrasi/administrasi-shell.tsx"), /data-workspace="administrasi"/);
  assert.match(baca("components/analisis-nilai/analisis-shell.tsx"), /data-workspace="analisis-nilai"/);
});

test("token workspace tersedia untuk tiga rumah", () => {
  assert.match(css, /\[data-workspace="administrasi"\]\s*\{/);
  assert.match(css, /\[data-workspace="analisis-nilai"\]\s*\{/);
  // Default :root = jurnal (biru).
  assert.match(css, /--workspace-accent-rgb:\s*var\(--p-blue-700\)/);
  // Aksen administrasi amber, analisis violet.
  const adm = css.slice(css.indexOf('[data-workspace="administrasi"]'));
  assert.match(adm, /--workspace-accent-rgb:\s*var\(--p-amber-600\)/);
  const ana = css.slice(css.indexOf('[data-workspace="analisis-nilai"]'));
  assert.match(ana, /--workspace-accent-rgb:\s*var\(--p-violet-600\)/);
  // Kelima token workspace terdefinisi.
  for (const t of ["--workspace-accent-rgb", "--workspace-accent-hover-rgb", "--workspace-accent-soft-rgb", "--workspace-accent-foreground-rgb", "--workspace-accent-border-rgb"]) {
    assert.ok(css.includes(t), `${t} harus ada`);
  }
});

test("token status tidak berada dalam override workspace", () => {
  const statusToken = ["--success", "--warning", "--destructive", "--info", "--primary:", "--focus-ring"];
  for (const b of blokBlok(css)) {
    if (!b.selector.includes("data-workspace")) continue;
    for (const t of statusToken) {
      assert.ok(!b.isi.includes(t), `${t} tidak boleh di-override di ${b.selector}`);
    }
  }
});

test("compatibility alias token lama tetap tersedia", () => {
  for (const t of ["--background", "--foreground", "--primary", "--primary-soft", "--surface", "--surface-muted", "--border", "--muted"]) {
    assert.ok(css.includes(t + ":"), `${t} harus tetap ada sebagai alias`);
  }
  // Nilai lama tidak berubah.
  assert.match(css, /--primary:\s*221 83% 37%/);
  assert.match(css, /--border:\s*214 24% 88%/);
});

test("token tiga lapis lengkap di globals.css", () => {
  assert.match(css, /1\. PRIMITIVE/);
  assert.match(css, /2\. SEMANTIC/);
  assert.match(css, /3\. COMPONENT/);
  // Component token kunci.
  for (const t of ["--card-bg", "--card-border", "--card-shadow", "--card-radius", "--control-radius", "--input-border", "--shell-sidebar-w", "--shell-header-h", "--nav-active-bg", "--nav-hover-bg"]) {
    assert.ok(css.includes(t), `${t} harus ada`);
  }
});

test("kelas dasar memakai token component (bukan nilai hardcoded)", () => {
  assert.match(css, /\.card\s*\{[^}]*var\(--card-radius\)/);
  assert.match(css, /\.card\s*\{[^}]*var\(--card-shadow\)/);
  assert.match(css, /\.input\s*\{[^}]*var\(--control-radius\)/);
  assert.match(css, /\.btn\s*\{[^}]*var\(--control-radius\)/);
});

test("shell memakai token lebar sidebar & tinggi header", () => {
  const jurnal = baca("components/app-shell.tsx");
  assert.match(jurnal, /w-\[var\(--shell-sidebar-w\)\]/);
  assert.match(jurnal, /lg:pl-\[var\(--shell-sidebar-w\)\]/);
  assert.match(jurnal, /min-h-\[var\(--shell-header-h\)\]/);
  const adm = baca("components/administrasi/administrasi-shell.tsx");
  assert.match(adm, /w-\[var\(--shell-sidebar-w\)\]/);
  assert.match(adm, /lg:pl-\[var\(--shell-sidebar-w\)\]/);
  assert.match(adm, /min-h-\[var\(--shell-header-h\)\]/);
  const ana = baca("components/analisis-nilai/analisis-shell.tsx");
  assert.match(ana, /min-h-\[var\(--shell-header-h\)\]/);
});

test("drawer jurnal memiliki aria-expanded, aria-controls, dan focus management", () => {
  const jurnal = baca("components/app-shell.tsx");
  assert.match(jurnal, /aria-expanded=\{open\}/);
  assert.match(jurnal, /aria-controls="drawer-jurnal"/);
  assert.match(jurnal, /role="dialog"/);
  assert.match(jurnal, /aria-modal="true"/);
  assert.match(jurnal, /tombolTutupRef\.current\?\.focus\(\)/);
  assert.match(jurnal, /document\.body\.style\.overflow = "hidden"/);
});

test("aksen shell administrasi & analisis memakai token workspace", () => {
  const adm = baca("components/administrasi/administrasi-shell.tsx");
  assert.match(adm, /bg-accent-soft/);
  assert.match(adm, /text-accent-foreground/);
  assert.match(adm, /bg-accent\b/);
  const ana = baca("components/analisis-nilai/analisis-shell.tsx");
  assert.match(ana, /bg-accent-soft/);
  assert.match(ana, /border-accent-border/);
});

test("WorkspaceSwitcher netral, mempertahankan href/hak akses, target 44px", () => {
  const sw = baca("components/workspace-switcher.tsx");
  // Sumber daftar & href tetap dari konfigurasi role (tidak di-hardcode).
  assert.match(sw, /getWorkspaces\(\{ role, isAkunPiket \}\)/);
  assert.match(sw, /tentukanWorkspaceAktif\(pathname, workspaces\)/);
  assert.match(sw, /href=\{w\.href\}/);
  assert.ok(!/href="\/(administrasi|analisis-nilai)"/.test(sw)); // tujuan dari config, bukan literal
  assert.match(sw, /min-h-\[44px\]/);
  // Netral: tidak memakai aksen rumah.
  assert.ok(!sw.includes("bg-accent"));
  assert.match(sw, /focus-visible:ring/);
});

test("menu navigasi tidak berubah — shell tetap memakai nav-config yang dites", () => {
  assert.match(baca("components/app-shell.tsx"), /getSidebarNav\(user\.role/);
  assert.match(baca("components/app-shell.tsx"), /getBottomNavConfig\(user\.role/);
  assert.match(baca("components/administrasi/administrasi-shell.tsx"), /getAdministrasiNav\(role\)/);
  assert.match(baca("components/administrasi/administrasi-shell.tsx"), /getAdministrasiBottomNav\(user\.role\)/);
  // Konfigurasi workspace (href/akses) tidak diubah oleh tahap ini.
  const wc = baca("lib/workspace-config.ts");
  assert.match(wc, /alamatRumahJurnal\(input\.role, input\.isAkunPiket\)/);
  assert.match(wc, /href: "\/administrasi"/);
  assert.match(wc, /href: "\/analisis-nilai"/);
});

test("konfigurasi role tidak berubah — shell tetap memakai lib/constants", () => {
  for (const rel of [
    "components/app-shell.tsx",
    "components/administrasi/administrasi-shell.tsx",
    "components/analisis-nilai/analisis-shell.tsx",
  ]) {
    assert.match(baca(rel), /ROLE_BADGE, ROLE_LABEL.*@\/lib\/constants|from "@\/lib\/constants"/);
  }
});

test("tailwind mengekspos token accent dengan dukungan alpha", () => {
  const tw = baca("tailwind.config.ts");
  // Primitive HSL triplet → dikonsumsi via hsl(var() / alpha).
  assert.match(tw, /accent:\s*"hsl\(var\(--workspace-accent-rgb\) \/ <alpha-value>\)"/);
  assert.match(tw, /"accent-soft":\s*"hsl\(var\(--workspace-accent-soft-rgb\) \/ <alpha-value>\)"/);
  assert.match(tw, /"accent-border":\s*"hsl\(var\(--workspace-accent-border-rgb\) \/ <alpha-value>\)"/);
  // Convenience solid di globals.css juga hsl (bukan rgb) agar warna benar.
  assert.match(css, /--workspace-accent:\s*hsl\(var\(--workspace-accent-rgb\)\)/);
});

test("dokumentasi design system ada dan membahas tiga rumah", () => {
  const doc = baca("docs/design-system-workspaces.md");
  for (const kata of ["Rumah Jurnal", "Rumah Administrasi", "Rumah Analisis Nilai", "PRIMITIVE", "SEMANTIC", "COMPONENT", "data-workspace", "prefers-reduced-motion"]) {
    assert.ok(doc.includes(kata), `dokumen harus membahas ${kata}`);
  }
});

test("tidak ada data sensitif yang tersentuh perubahan token", () => {
  // File yang diubah tahap ini tidak boleh menyentuh storage/key/otorisasi.
  for (const rel of ["app/globals.css", "tailwind.config.ts", "components/app-shell.tsx", "components/administrasi/administrasi-shell.tsx", "components/analisis-nilai/analisis-shell.tsx", "components/workspace-switcher.tsx"]) {
    const src = baca(rel);
    assert.ok(!src.includes("kunciPenyimpanan"), `${rel} tidak boleh menyentuh storage key`);
    assert.ok(!/prisma\./.test(src), `${rel} tidak boleh menjalankan query`);
  }
});
