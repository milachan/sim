#!/usr/bin/env node
// scripts/check-env.mjs — pemeriksa environment variable.
// - Tidak pernah mencetak nilai secret.
// - Hanya memeriksa keberadaan & format dasar.
// - Exit 0 bila wajib valid; non-zero bila ada yang salah.
// - Jalankan: node scripts/check-env.mjs              (mode dev/test)
//             node scripts/check-env.mjs --production (ketat untuk production)

import fs from "node:fs";
import path from "node:path";

const PRODUCTION = process.argv.includes("--production");
const DOTENV = PRODUCTION ? ".env.production" : ".env";
const ENV_FILE = path.resolve(process.cwd(), PRODUCTION ? ".env.production" : ".env");

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  const txt = fs.readFileSync(file, "utf8");
  for (const raw of txt.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
if (!fs.existsSync(ENV_FILE) && fs.existsSync(path.resolve(process.cwd(), ".env"))) {
  loadDotEnv(path.resolve(process.cwd(), ".env"));
} else {
  loadDotEnv(ENV_FILE);
}

let errors = 0;
let warnings = 0;

function ok(label) { console.log(`  \u2713 ${label}`); }
function warn(label, hint) { warnings++; console.log(`  \u26a0 ${label}${hint ? ` — ${hint}` : ""}`); }
function fail(label, hint) { errors++; console.log(`  \u2717 ${label}${hint ? ` — ${hint}` : ""}`); }

function isValidUrl(s) {
  try { const u = new URL(s); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; }
}
function isLocalhostUrl(s) {
  try {
    const u = new URL(s);
    const h = u.hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "::1" || h.endsWith(".localhost");
  } catch { return false; }
}
function isVapidSubjectValid(s) {
  if (!s) return true;
  return s.startsWith("mailto:") || s.startsWith("https://") || s.startsWith("http://");
}

console.log(`\nPemeriksaan environment (${PRODUCTION ? "production" : "development"})`);
console.log(`Sumber: ${fs.existsSync(ENV_FILE) ? path.basename(ENV_FILE) : ".env (fallback)"}\n`);

console.log("Wajib (aplikasi tidak jalan tanpa ini):");

const db = process.env.DATABASE_URL ?? "";
if (!db) fail("DATABASE_URL", "tidak ditemukan");
else if (!/^mysql:\/\//i.test(db)) fail("DATABASE_URL", "harus diawali mysql:// (MySQL/MariaDB)");
else ok("DATABASE_URL (mysql)");

const secret = process.env.NEXTAUTH_SECRET ?? "";
if (!secret) fail("NEXTAUTH_SECRET", "tidak ditemukan");
else if (secret.length < 32) fail("NEXTAUTH_SECRET", `terlalu pendek (${secret.length} < 32 karakter)`);
else ok("NEXTAUTH_SECRET (panjang memadai)");

const url = process.env.NEXTAUTH_URL ?? "";
if (!url) fail("NEXTAUTH_URL", "tidak ditemukan");
else if (!isValidUrl(url)) fail("NEXTAUTH_URL", "bukan URL http/https yang valid");
else if (PRODUCTION && isLocalhostUrl(url)) fail("NEXTAUTH_URL", "tidak boleh localhost/127.0.0.1 di production — isi URL HTTPS publik");
else if (PRODUCTION && !url.startsWith("https://")) fail("NEXTAUTH_URL", "wajib https:// di production (HTTP tidak diterima)");
else ok(`NEXTAUTH_URL (${PRODUCTION ? "valid, bukan localhost, HTTPS" : "valid"})`);

console.log("\nOpsional (fitur terkait saja):");

const cron = process.env.PUSH_CRON_SECRET ?? "";
if (!cron) console.log("  - PUSH_CRON_SECRET (kosong — cron eksternal dinonaktifkan, manual via UI tetap jalan)");
else if (cron.length < 16) warn("PUSH_CRON_SECRET", "terlalu pendek, disarankan >=16 karakter");
else ok("PUSH_CRON_SECRET (terisi)");

const vapidPub = process.env.VAPID_PUBLIC_KEY ?? "";
const vapidPriv = process.env.VAPID_PRIVATE_KEY ?? "";
const vapidSubj = process.env.VAPID_SUBJECT ?? "";
const vapidAny = !!(vapidPub || vapidPriv || vapidSubj);
if (!vapidAny) console.log("  - VAPID_* (kosong — akan auto-generate di DB, push tetap jalan)");
else {
  if ((!!vapidPub) !== (!!vapidPriv)) fail("VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY", "harus diisi berpasangan (keduanya atau kosong keduanya)");
  else if (vapidPub && vapidPriv) {
    if (vapidSubj && !isVapidSubjectValid(vapidSubj)) fail("VAPID_SUBJECT", "harus mailto: atau https://");
    else ok("VAPID_* (pasangan lengkap)");
  } else {
    if (vapidSubj) warn("VAPID_SUBJECT", "diisi tanpa pasangan kunci — akan diabaikan");
    else console.log("  - VAPID_* (tidak lengkap — fallback DB)");
  }
}

const wa = process.env.WA_TOKEN ?? "";
if (!wa) console.log("  - WA_TOKEN (kosong — fallback ke Setting UI)");
else ok("WA_TOKEN (terisi — fallback Setting tetap ada)");

const bk = process.env.BK_APP_URL ?? "";
if (!bk) console.log("  - BK_APP_URL (kosong — halaman /bk menampilkan pesan konfigurasi)");
else if (!isValidUrl(bk)) fail("BK_APP_URL", "bukan URL http/https yang valid");
else ok("BK_APP_URL (URL valid)");

console.log("\nOtomatis (runtime):");
console.log(`  - NODE_ENV=${process.env.NODE_ENV ?? "(tidak diset — Next.js akan isi otomatis)"}`);

console.log("");
if (errors > 0) {
  console.log(`Hasil: ${errors} error, ${warnings} peringatan — perbaiki konfigurasi wajib sebelum melanjutkan.\n`);
  process.exit(1);
}
if (warnings > 0) {
  console.log(`Hasil: OK dengan ${warnings} peringatan (tidak menghalangi start, tapi sebaiknya diperbaiki).\n`);
  process.exit(0);
}
console.log("Hasil: OK — konfigurasi wajib valid.\n");
process.exit(0);
