import { test } from "node:test";
import assert from "node:assert/strict";
import { putuskanPeranPengisi } from "./absensi-harian";

/**
 * Keputusan peran pengisi Absensi Harian (fungsi murni yang dipakai server
 * action & halaman detail). Hak ditentukan kecocokan user.guruId — BUKAN role.
 */

const PIKET = new Set(["guru-piket"]);

test("WAKA terhubung sebagai guru jam pertama boleh mengisi", () => {
  const r = putuskanPeranPengisi(
    { role: "WAKA", guruId: "g-waka" },
    { guruJamPertamaId: "g-waka", waliKelasGuruId: null, piketIds: PIKET }
  );
  assert.equal(r, "GURU_JAM_PERTAMA");
});

test("WAKA terhubung sebagai wali kelas pada periode itu boleh mengisi", () => {
  const r = putuskanPeranPengisi(
    { role: "WAKA", guruId: "g-waka" },
    { guruJamPertamaId: "g-lain", waliKelasGuruId: "g-waka", piketIds: PIKET }
  );
  assert.equal(r, "WALI_KELAS");
});

test("WAKA terhubung sebagai guru piket boleh mengisi", () => {
  const r = putuskanPeranPengisi(
    { role: "WAKA", guruId: "guru-piket" },
    { guruJamPertamaId: "g-lain", waliKelasGuruId: null, piketIds: PIKET }
  );
  assert.equal(r, "GURU_PIKET");
});

test("WAKA terhubung TIDAK boleh mengisi kelas milik Guru lain", () => {
  const r = putuskanPeranPengisi(
    { role: "WAKA", guruId: "g-waka" },
    { guruJamPertamaId: "g-lain", waliKelasGuruId: "g-lain2", piketIds: PIKET }
  );
  assert.equal(r, null);
});

test("WAKA tanpa guruId ditolak untuk pengisian", () => {
  const r = putuskanPeranPengisi(
    { role: "WAKA", guruId: null },
    { guruJamPertamaId: "g-lain", waliKelasGuruId: null, piketIds: PIKET }
  );
  assert.equal(r, null);
});

test("KEPALA selalu ditolak (read-only, bukan pengajar)", () => {
  const r1 = putuskanPeranPengisi(
    { role: "KEPALA", guruId: "g-waka" },
    { guruJamPertamaId: "g-waka", waliKelasGuruId: "g-waka", piketIds: PIKET }
  );
  const r2 = putuskanPeranPengisi(
    { role: "KEPALA", guruId: null },
    { guruJamPertamaId: null, waliKelasGuruId: null, piketIds: PIKET }
  );
  assert.equal(r1, null);
  assert.equal(r2, null);
});

test("ADMIN/SUPERADMIN tetap backup seperti guru piket (aturan saat ini)", () => {
  assert.equal(
    putuskanPeranPengisi({ role: "ADMIN", guruId: null }, { guruJamPertamaId: null, waliKelasGuruId: null, piketIds: new Set() }),
    "GURU_PIKET"
  );
  assert.equal(
    putuskanPeranPengisi({ role: "SUPERADMIN", guruId: null }, { guruJamPertamaId: "g-lain", waliKelasGuruId: null, piketIds: new Set() }),
    "GURU_PIKET"
  );
});

test("GURU perilaku tidak berubah: JP, wali, piket, atau ditolak", () => {
  assert.equal(
    putuskanPeranPengisi({ role: "GURU", guruId: "g1" }, { guruJamPertamaId: "g1", waliKelasGuruId: null, piketIds: PIKET }),
    "GURU_JAM_PERTAMA"
  );
  assert.equal(
    putuskanPeranPengisi({ role: "GURU", guruId: "g1" }, { guruJamPertamaId: "g2", waliKelasGuruId: "g1", piketIds: PIKET }),
    "WALI_KELAS"
  );
  assert.equal(
    putuskanPeranPengisi({ role: "GURU", guruId: "guru-piket" }, { guruJamPertamaId: "g2", waliKelasGuruId: null, piketIds: PIKET }),
    "GURU_PIKET"
  );
  assert.equal(
    putuskanPeranPengisi({ role: "GURU", guruId: "g1" }, { guruJamPertamaId: "g2", waliKelasGuruId: "g3", piketIds: new Set() }),
    null
  );
});
