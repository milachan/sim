import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

/**
 * Simulasi aman pemeriksa environment: menjalankan scripts/check-env.mjs sebagai
 * proses terpisah dengan env dummy (bukan .env aktual, tidak ada nilai rahasia).
 * - development boleh HTTP/localhost;
 * - production menolak localhost, 127.0.0.1, ::1, dan semua URL non-HTTPS (error).
 */

const SCRIPT = path.resolve(process.cwd(), "scripts", "check-env.mjs");
const SECRET_DUMMY = "u".repeat(40); // panjang memadai, bukan secret nyata
const DB_MYSQL = "mysql://user:dummy@localhost:3306/db";

function jalankan(mode: "--production" | null, nextAuthUrl: string): { kode: number; gabung: string } {
  const res = spawnSync(process.execPath, [SCRIPT, ...(mode ? [mode] : [])], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: DB_MYSQL,
      NEXTAUTH_SECRET: SECRET_DUMMY,
      NEXTAUTH_URL: nextAuthUrl,
    },
    encoding: "utf8",
    timeout: 30000,
  });
  return { kode: res.status ?? -1, gabung: `${res.stdout ?? ""}${res.stderr ?? ""}` };
}

test("development + localhost → lulus (HTTP/localhost diperbolehkan)", () => {
  const { kode } = jalankan(null, "http://localhost:3000");
  assert.equal(kode, 0);
});

test("production + localhost → GAGAL", () => {
  const { kode } = jalankan("--production", "http://localhost:3000");
  assert.notEqual(kode, 0);
});

test("production + 127.0.0.1 → GAGAL", () => {
  const { kode } = jalankan("--production", "http://127.0.0.1:3000");
  assert.notEqual(kode, 0);
});

test("production + ::1 → GAGAL", () => {
  const { kode } = jalankan("--production", "http://[::1]:3000");
  assert.notEqual(kode, 0);
});

test("production + http://domain → GAGAL (non-HTTPS adalah error)", () => {
  const { kode, gabung } = jalankan("--production", "http://jurnal.contoh.sch.id");
  assert.notEqual(kode, 0);
  assert.ok(!gabung.includes(SECRET_DUMMY));
});

test("production + https://domain → lulus", () => {
  const { kode } = jalankan("--production", "https://jurnal.contoh.sch.id");
  assert.equal(kode, 0);
});
