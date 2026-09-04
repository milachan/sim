import { test } from "node:test";
import assert from "node:assert/strict";
import { scopeBacaAnalisisNilai, whereScopeKegiatan } from "./scope";
import { bolehBacaKegiatanNilai, type InfoUser } from "@/lib/otorisasi";

const guruMilik: InfoUser = { id: "u1", role: "GURU", guruId: "g1" };
const guruTanpaGuruId: InfoUser = { id: "u2", role: "GURU", guruId: null };
const waka: InfoUser = { id: "u3", role: "WAKA", guruId: null };
const kepala: InfoUser = { id: "u4", role: "KEPALA", guruId: null };
const admin: InfoUser = { id: "u5", role: "ADMIN", guruId: null };

test("scope: GURU dengan guruId hanya melihat jadwal miliknya", () => {
  const s = scopeBacaAnalisisNilai(guruMilik);
  assert.ok(s && !s.lihatSemua);
  const where = whereScopeKegiatan(guruMilik);
  assert.deepEqual(where, { jadwal: { guruId: "g1" } });
});

test("scope: GURU tanpa guruId tidak berhak membaca apa pun", () => {
  assert.equal(scopeBacaAnalisisNilai(guruTanpaGuruId), null);
  assert.equal(whereScopeKegiatan(guruTanpaGuruId), null);
});

test("scope: WAKA/KEPALA/ADMIN/SUPERADMIN melihat semua (read-only)", () => {
  for (const u of [waka, kepala, admin, { id: "u6", role: "SUPERADMIN", guruId: null } as InfoUser]) {
    const s = scopeBacaAnalisisNilai(u);
    assert.ok(s?.lihatSemua);
    assert.deepEqual(whereScopeKegiatan(u), {});
  }
});

test("scope: tanpa user → tidak berhak", () => {
  assert.equal(scopeBacaAnalisisNilai(null), null);
  assert.equal(scopeBacaAnalisisNilai(undefined), null);
});

test("scope konsisten dengan otorisasi existing: kegiatan di luar scope ditolak", () => {
  // Kegiatan pada jadwal milik guru lain ("g2") tidak boleh dibaca guru g1,
  // dan halaman tidak boleh memperluas aturan ini.
  assert.equal(bolehBacaKegiatanNilai(guruMilik, "g2"), false);
  // Pemantau/admin tetap boleh membacanya sesuai aturan existing.
  assert.equal(bolehBacaKegiatanNilai(waka, "g2"), true);
  assert.equal(bolehBacaKegiatanNilai(admin, "g2"), true);
});
