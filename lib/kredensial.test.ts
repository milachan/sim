import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ambilKredensial,
  bersihkanKedaluwarsa,
  simpanKredensial,
  type BarisKredensial,
  type EntriKredensial,
} from "./kredensial-store";

function dataDummy(): BarisKredensial[] {
  return [{ nama: "Budi", kode: "K5", username: "k5", password: "PASSWORD-PALOS-DUMMY", peran: "GURU", wajib: "TIDAK" }];
}

function storeBaru(): Map<string, EntriKredensial> {
  return new Map();
}

test("token kredensial terikat ke admin pembuat import (owner)", () => {
  const store = storeBaru();
  const token = simpanKredensial(store, "admin-A", dataDummy(), { now: 1000 });
  // Pemilik bisa mengambil.
  const milik = ambilKredensial(store, token, "admin-A", 2000);
  assert.equal(milik.ok, true);
  // Admin lain yang mendapatkan token TIDAK boleh mengunduh — respons generik.
  const store2 = storeBaru();
  const token2 = simpanKredensial(store2, "admin-A", dataDummy(), { now: 1000 });
  const bukanMilik = ambilKredensial(store2, token2, "admin-B", 2000);
  assert.equal(bukanMilik.ok, false);
});

test("kegagalan generik: token salah, bukan milik, dan kedaluwarsa menghasilkan hasil yang sama", () => {
  const store = storeBaru();
  simpanKredensial(store, "admin-A", dataDummy(), { now: 1000 });
  const r1 = ambilKredensial(store, "token-ngawur", "admin-A", 2000);
  const store2 = storeBaru();
  const t2 = simpanKredensial(store2, "admin-A", dataDummy(), { now: 1000 });
  const r2 = ambilKredensial(store2, t2, "admin-B", 2000);
  const store3 = storeBaru();
  const t3 = simpanKredensial(store3, "admin-A", dataDummy(), { now: 1000, ttlMs: 500 });
  const r3 = ambilKredensial(store3, t3, "admin-A", 5000);
  assert.equal(r1.ok, false);
  assert.equal(r2.ok, false);
  assert.equal(r3.ok, false);
});

test("token hanya dapat dipakai SEKALI", () => {
  const store = storeBaru();
  const token = simpanKredensial(store, "admin-A", dataDummy(), { now: 1000 });
  const pertama = ambilKredensial(store, token, "admin-A", 2000);
  const kedua = ambilKredensial(store, token, "admin-A", 2000);
  assert.equal(pertama.ok, true);
  assert.equal(kedua.ok, false);
  assert.equal(store.size, 0);
});

test("token kedaluwarsa sesuai TTL pendek", () => {
  const store = storeBaru();
  const token = simpanKredensial(store, "admin-A", dataDummy(), { now: 1000, ttlMs: 60000 });
  assert.equal(ambilKredensial(store, token, "admin-A", 1000 + 59000).ok, true);
  const store2 = storeBaru();
  const token2 = simpanKredensial(store2, "admin-A", dataDummy(), { now: 1000, ttlMs: 60000 });
  assert.equal(ambilKredensial(store2, token2, "admin-A", 1000 + 61000).ok, false);
});

test("entri kedaluwarsa dibersihkan saat akses", () => {
  const store = storeBaru();
  simpanKredensial(store, "admin-A", dataDummy(), { now: 1000, ttlMs: 1000 });
  simpanKredensial(store, "admin-A", dataDummy(), { now: 1000, ttlMs: 999999 });
  assert.equal(store.size, 2);
  ambilKredensial(store, "token-tidak-ada", "admin-A", 10000);
  assert.equal(store.size, 1);
});

test("bersihkanKedaluwarsa menghapus semua entri basi tanpa menyentuh yang aktif", () => {
  const store = storeBaru();
  simpanKredensial(store, "admin-A", dataDummy(), { now: 0, ttlMs: 100 });
  simpanKredensial(store, "admin-B", dataDummy(), { now: 0, ttlMs: 100 });
  simpanKredensial(store, "admin-C", dataDummy(), { now: 0, ttlMs: 100000 });
  bersihkanKedaluwarsa(store, 500);
  assert.equal(store.size, 1);
});

test("token acak: tidak mengandung data kredensial dan unik antar penyimpanan", () => {
  const store = storeBaru();
  const t1 = simpanKredensial(store, "admin-A", dataDummy(), { now: 0 });
  const t2 = simpanKredensial(store, "admin-A", dataDummy(), { now: 0 });
  assert.notEqual(t1, t2);
  assert.ok(!t1.includes("PASSWORD"));
  assert.ok(!t1.includes("Budi"));
});
