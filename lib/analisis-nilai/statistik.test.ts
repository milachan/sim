import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalisasiPersen,
  rataRata,
  median,
  minMaks,
  ringkasNilai,
  distribusiRentang,
  hitungStatusPengumpulan,
  susunTrenKegiatan,
  type InputTren,
} from "./statistik";

test("normalisasiPersen: dasar dan nilai maksimal berbeda", () => {
  assert.equal(normalisasiPersen(80, 100), 80);
  assert.equal(normalisasiPersen(45, 60), 75);
  assert.equal(normalisasiPersen(30, 40), 75);
  assert.equal(normalisasiPersen(0, 100), 0);
});

test("normalisasiPersen: nilai desimal dibulatkan konsisten 1 desimal", () => {
  assert.equal(normalisasiPersen(7, 9), 77.8); // 77.777… → 77.8
  assert.equal(normalisasiPersen(1, 3), 33.3); // 33.333… → 33.3
  assert.equal(normalisasiPersen(2, 3), 66.7); // 66.666… → 66.7
});

test("normalisasiPersen: nilai null / non-angka tidak ikut dihitung", () => {
  assert.equal(normalisasiPersen(null, 100), null);
  assert.equal(normalisasiPersen(undefined, 100), null);
  assert.equal(normalisasiPersen(Number.NaN, 100), null);
});

test("normalisasiPersen: nilai maksimal nol atau tidak valid → null", () => {
  assert.equal(normalisasiPersen(80, 0), null);
  assert.equal(normalisasiPersen(80, -10), null);
  assert.equal(normalisasiPersen(80, null), null);
  assert.equal(normalisasiPersen(80, Number.NaN), null);
  assert.equal(normalisasiPersen(80, Number.POSITIVE_INFINITY), null);
});

test("normalisasiPersen: hasil di-clamp ke rentang 0–100", () => {
  assert.equal(normalisasiPersen(120, 100), 100);
  assert.equal(normalisasiPersen(-5, 100), 0);
});

test("rataRata: array kosong null, satu & beberapa nilai, desimal", () => {
  assert.equal(rataRata([]), null);
  assert.equal(rataRata([80]), 80);
  assert.equal(rataRata([70, 90]), 80);
  assert.equal(rataRata([1, 2]), 1.5);
  assert.equal(rataRata([70, 80, 90, 100]), 85);
});

test("median: kosong, ganjil, genap, satu nilai, desimal", () => {
  assert.equal(median([]), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([7]), 7);
  assert.equal(median([10.5, 20.5, 30.5]), 20.5);
  assert.equal(median([1, 2, 3, 4, 100]), 3);
});

test("minMaks: kosong null; satu nilai; beberapa nilai", () => {
  assert.deepEqual(minMaks([]), null);
  assert.deepEqual(minMaks([5]), { min: 5, max: 5 });
  assert.deepEqual(minMaks([90, 55, 78]), { min: 55, max: 90 });
});

test("ringkasNilai: menghitung terisi vs null", () => {
  const r = ringkasNilai([80, null, 90, undefined, 70]);
  assert.equal(r.jumlahNilai, 5);
  assert.equal(r.terisi, 3);
  assert.equal(r.belumTerisi, 2);
  assert.equal(r.rata, 80);
  assert.equal(r.median, 80);
  assert.equal(r.tertinggi, 90);
  assert.equal(r.terendah, 70);

  const kosong = ringkasNilai([null, null]);
  assert.equal(kosong.terisi, 0);
  assert.equal(kosong.rata, null);
});

test("distribusiRentang: batas 60, 75, 90, dan 100 masuk rentang benar", () => {
  const d = distribusiRentang([59.9, 60, 74.9, 75, 89.4, 90, 100, 0, 99.9]);
  assert.deepEqual(
    d.map((r) => r.label),
    ["0 – <60", "60 – <75", "75 – <90", "90 – 100"]
  );
  assert.equal(d[0]!.jumlah, 2); // 59.9, 0
  assert.equal(d[1]!.jumlah, 2); // 60, 74.9
  assert.equal(d[2]!.jumlah, 2); // 75, 89.4
  assert.equal(d[3]!.jumlah, 3); // 90, 100, 99.9
});

test("distribusiRentang: array kosong → semua nol; nilai di luar 0–100 diabaikan", () => {
  const kosong = distribusiRentang([]);
  assert.equal(kosong.length, 4);
  assert.ok(kosong.every((r) => r.jumlah === 0));

  const d = distribusiRentang([-5, 150, Number.NaN, 50]);
  assert.equal(d[0]!.jumlah, 1);
  assert.equal(d[1]!.jumlah + d[2]!.jumlah + d[3]!.jumlah, 0);
});

test("hitungStatusPengumpulan: menghitung DIKUMPULKAN/BELUM/TERLAMBAT", () => {
  const h = hitungStatusPengumpulan(["DIKUMPULKAN", "BELUM", "DIKUMPULKAN", "TERLAMBAT", "BELUM"]);
  assert.deepEqual(h, { DIKUMPULKAN: 2, BELUM: 2, TERLAMBAT: 1 });
  assert.deepEqual(hitungStatusPengumpulan([]), { DIKUMPULKAN: 0, BELUM: 0, TERLAMBAT: 0 });
});

function tren(judul: string, tanggal: string, maks: number, rata: number | null): InputTren {
  return { id: judul, judul, tanggal, nilaiMaksimal: maks, rataNilai: rata };
}

test("susunTrenKegiatan: hanya kegiatan valid (rata terisi, maksimal > 0)", () => {
  const items = [
    tren("K3", "2026-03-03", 100, 80),
    tren("TanpaNilai", "2026-03-02", 100, null),
    tren("MaksNol", "2026-03-01", 0, 50),
    tren("K2", "2026-02-02", 50, 40),
    tren("K1", "2026-01-01", 200, 120),
  ];
  const hasil = susunTrenKegiatan(items);
  assert.equal(hasil.length, 3);
  // Kronologis lama → baru untuk digambar sebagai garis/batang tren.
  assert.deepEqual(
    hasil.map((t) => t.id),
    ["K1", "K2", "K3"]
  );
  assert.deepEqual(
    hasil.map((t) => t.persen),
    [60, 80, 80]
  );
});

test("susunTrenKegiatan: dibatasi maksimal 6 titik terbaru", () => {
  const items: InputTren[] = [];
  // Input terurut terbaru → terlama (K9 paling baru).
  for (let i = 9; i >= 1; i--) {
    items.push(tren(`K${i}`, `2026-01-${String(i).padStart(2, "0")}`, 100, 50 + i));
  }
  const hasil = susunTrenKegiatan(items);
  assert.equal(hasil.length, 6);
  // 6 terbaru = K4..K9, lalu diurutkan kronologis dari K4.
  assert.equal(hasil[0]!.id, "K4");
  assert.equal(hasil[5]!.id, "K9");
});

test("susunTrenKegiatan: array kosong atau tak ada yang valid → kosong (tanpa data palsu)", () => {
  assert.deepEqual(susunTrenKegiatan([]), []);
  assert.deepEqual(susunTrenKegiatan([tren("X", "2026-01-01", 0, 10)]), []);
});
