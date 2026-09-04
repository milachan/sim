import { test } from "node:test";
import assert from "node:assert/strict";
import { resolusiSemesterUntukTanggal, type SemesterRingkas } from "./semester";
import { pilihWaliKelasPadaTanggal, type RiwayatWaliRingkas } from "./wali-kelas";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

function smt(id: string, mulai: string | null, selesai: string | null, aktif = false): SemesterRingkas {
  return { id, aktif, mulai: mulai ? d(mulai) : null, selesai: selesai ? d(selesai) : null, tahunAjaranId: "ta1" };
}

test("dua semester dengan rentang berbeda: tanggal memilih semester yang berlaku", () => {
  const s1 = smt("ganjil", "2026-07-20", "2026-12-20");
  const s2 = smt("genap", "2026-01-05", "2026-06-20");
  const r = resolusiSemesterUntukTanggal(d("2026-09-01"), [s1, s2]);
  assert.equal(r.semester?.id, "ganjil");
  assert.equal(r.ambigu, false);
});

test("tanggal di akhir tahun memilih semester genap (mulai lebih akhir)", () => {
  const s1 = smt("ganjil", "2026-07-20", "2026-12-20");
  const s2 = smt("genap", "2026-01-05", "2026-06-20");
  const r = resolusiSemesterUntukTanggal(d("2026-03-01"), [s1, s2]);
  assert.equal(r.semester?.id, "genap");
});

test("semester yang diarsipkan (aktif=false) tetap terpilih bila rentangnya cocok", () => {
  const s1 = smt("lama", "2026-01-01", "2026-06-30", false);
  const s2 = smt("baru", "2026-07-01", "2026-12-31", true);
  const r = resolusiSemesterUntukTanggal(d("2026-02-10"), [s1, s2]);
  assert.equal(r.semester?.id, "lama");
});

test("semester tanpa rentang: tidak menjadi kandidat, tercatat di tanpaRentang", () => {
  const s1 = smt("tanpa", null, null);
  const r = resolusiSemesterUntukTanggal(d("2026-05-05"), [s1]);
  assert.equal(r.semester, null);
  assert.equal(r.tanpaRentang.length, 1);
});

test("tidak ada semester yang cocok → null", () => {
  const r = resolusiSemesterUntukTanggal(d("2026-05-05"), [smt("a", "2027-01-01", "2027-12-31")]);
  assert.equal(r.semester, null);
});

test("rentang semester tumpang tindih: ambigu=true dan pilihan deterministik", () => {
  const s1 = smt("ganjil", "2026-07-20", "2026-12-31");
  const s2 = smt("periode2", "2026-11-01", "2026-12-31");
  const r = resolusiSemesterUntukTanggal(d("2026-11-15"), [s1, s2]);
  assert.equal(r.ambigu, true);
  // Deterministik: mulai paling akhir (per bulan 11) dipilih.
  assert.equal(r.semester?.id, "periode2");
});

// ============ WALI KELAS ============

function riwayat(id: string, guru: string, mulai: string, selesai: string | null, semesterId: string | null): RiwayatWaliRingkas {
  return { id, kelasId: "k1", guruId: guru, semesterId, mulai: d(mulai), selesai: selesai ? d(selesai) : null };
}

test("wali kelas historis: tanggal memilih guru yang bertugas kala itu", () => {
  const rw = [
    riwayat("r1", "guruLama", "2026-07-20", "2026-09-30", "s-ganjil"),
    riwayat("r2", "guruBaru", "2026-10-01", null, "s-ganjil"),
  ];
  assert.equal(pilihWaliKelasPadaTanggal(rw, d("2026-08-01"), "s-ganjil"), "guruLama");
  assert.equal(pilihWaliKelasPadaTanggal(rw, d("2026-11-01"), "s-ganjil"), "guruBaru");
});

test("mantan wali kelas: periode setelah masa tugasnya tidak lagi dianggap wali", () => {
  const rw = [riwayat("r1", "guruLama", "2026-07-20", "2026-08-31", "s-ganjil")];
  assert.equal(pilihWaliKelasPadaTanggal(rw, d("2026-07-25"), "s-ganjil"), "guruLama");
  assert.equal(pilihWaliKelasPadaTanggal(rw, d("2026-09-15"), "s-ganjil"), null);
});

test("prioritas semesterId: riwayat lama terbuka tanpa selesai tapi semester cocok menang", () => {
  // R1 dibuka lama (mulai terdahulu) dan masih terbuka; R2 dengan semesterId
  // yang sesuai tanggal dipilih lebih dulu.
  const rw = [
    riwayat("r1", "guruLama", "2026-01-01", null, "s-genap"),
    riwayat("r2", "guruBaru", "2026-07-20", null, "s-ganjil"),
  ];
  assert.equal(pilihWaliKelasPadaTanggal(rw, d("2026-09-01"), "s-ganjil"), "guruBaru");
});

test("tidak ada riwayat → null (bukan wali saat ini)", () => {
  assert.equal(pilihWaliKelasPadaTanggal([], d("2026-09-01"), "s-ganjil"), null);
});