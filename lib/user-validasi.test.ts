import { test } from "node:test";
import assert from "node:assert/strict";
import { validasiInputUser, tentukanIdentitasAkun, apakahRolePengajar } from "./user-validasi";

test("GURU tanpa nama client tetap valid — nama wajib berasal dari Guru", () => {
  const v = validasiInputUser({ username: "budi", nama: "", role: "GURU", guruId: "g1" });
  assert.equal(v.ok, true);
  if (v.ok) {
    assert.equal(v.perluGuru, true);
    assert.equal(v.guruIdMentah, "g1");
  }
});

test("WAKA valid dengan guruId meski field nama tidak dikirim browser", () => {
  const v = validasiInputUser({ username: "waka1", nama: undefined, role: "WAKA", guruId: " g2 " });
  assert.equal(v.ok, true);
  if (v.ok) assert.equal(v.guruIdMentah, "g2");
});

test("pengajar tanpa guruId ditolak", () => {
  const v = validasiInputUser({ username: "x", role: "WAKA", guruId: "" });
  assert.equal(v.ok, false);
  if (!v.ok) assert.match(v.error, /terhubung/);
});

test("username kosong ditolak terpisah dari nama", () => {
  const v = validasiInputUser({ username: "   ", nama: "Budi", role: "KEPALA" });
  assert.equal(v.ok, false);
  if (!v.ok) assert.match(v.error, /Username/);
});

test("non-pengajar tanpa nama ditolak", () => {
  for (const role of ["ADMIN", "SUPERADMIN", "KEPALA"]) {
    const v = validasiInputUser({ username: "u", nama: "", role });
    assert.equal(v.ok, false, role);
    if (!v.ok) assert.match(v.error, /Nama/, role);
  }
});

test("non-pengajar dengan nama valid lulus dan tidak membawa guruId", () => {
  const v = validasiInputUser({ username: "kamad", nama: "  Ahmad  ", role: "KEPALA", guruId: "harusDibuang" });
  assert.equal(v.ok, true);
  if (v.ok) {
    assert.equal(v.perluGuru, false);
    assert.equal(v.namaClient, "Ahmad");
    assert.equal(v.guruIdMentah, "");
  }
});

test("identitas akun pengajar selalu dari Data Guru, bukan client", () => {
  const r = tentukanIdentitasAkun({ perluGuru: true, namaClient: "Nama Ngawur", namaGuruDb: "Budi Santoso, S.Pd." });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.nama, "Budi Santoso, S.Pd.");
});

test("identitas akun gagal bila nama Guru di DB kosong", () => {
  const r = tentukanIdentitasAkun({ perluGuru: true, namaClient: "", namaGuruDb: " " });
  assert.equal(r.ok, false);
});

test("identitas akun non-pengajar memakai nama client", () => {
  const r = tentukanIdentitasAkun({ perluGuru: false, namaClient: "Admin Utama", namaGuruDb: null });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.nama, "Admin Utama");
});

test("apakahRolePengajar hanya mengenali GURU & WAKA", () => {
  assert.equal(apakahRolePengajar("GURU"), true);
  assert.equal(apakahRolePengajar("WAKA"), true);
  assert.equal(apakahRolePengajar("ADMIN"), false);
  assert.equal(apakahRolePengajar("SUPERADMIN"), false);
  assert.equal(apakahRolePengajar("KEPALA"), false);
  assert.equal(apakahRolePengajar(null), false);
});
