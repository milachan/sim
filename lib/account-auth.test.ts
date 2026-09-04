import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isUserAktif,
  roleDbUser,
  punyaRoleDb,
  guruOperasionalValid,
  adalahPengajarOperasional,
  hasilAksesApi,
  cronBearerValid,
  type InfoUserDb,
} from "./account-auth";

const guruAktif: InfoUserDb = {
  id: "u1",
  role: "GURU",
  aktif: true,
  guruId: "g1",
  guru: { status: true, deletedAt: null },
};

const guruNonAktif = { ...guruAktif, aktif: false };

const adminAktif: InfoUserDb = { id: "a1", role: "ADMIN", aktif: true, guruId: null };
const wakaAktif: InfoUserDb = { id: "w1", role: "WAKA", aktif: true, guruId: null };
const kepalaAktif: InfoUserDb = { id: "k1", role: "KEPALA", aktif: true, guruId: null };

test("user aktif dianggap sah", () => {
  assert.equal(isUserAktif(guruAktif), true);
  assert.equal(isUserAktif(adminAktif), true);
});

test("user nonaktif dengan JWT lama ditolak", () => {
  // Data termutakhir dari DB menunjukkan aktif=false, walau JWT lama tersimpan.
  assert.equal(isUserAktif(guruNonAktif), false);
  assert.equal(roleDbUser(guruNonAktif), null);
});

test("user yang sudah tidak ada di database ditolak", () => {
  assert.equal(isUserAktif(null), false);
  assert.equal(isUserAktif(undefined), false);
  assert.equal(roleDbUser(null), null);
});

test("admin yang diturunkan menjadi GURU langsung kehilangan hak admin", () => {
  const diturunkan: InfoUserDb = { id: "a1", role: "GURU", aktif: true, guruId: "g1", guru: { status: true, deletedAt: null } };
  assert.equal(punyaRoleDb(diturunkan, ["ADMIN", "SUPERADMIN"]), false);
  assert.equal(punyaRoleDb(guruAktif, ["ADMIN", "SUPERADMIN"]), false);
});

test("guru yang dipromosikan menjadi ADMIN langsung mendapat hak admin", () => {
  const dipromosikan: InfoUserDb = { id: "g1", role: "ADMIN", aktif: true, guruId: null };
  assert.equal(punyaRoleDb(dipromosikan, ["ADMIN", "SUPERADMIN"]), true);
});

test("perubahan peran antar role berlaku dari database", () => {
  assert.equal(punyaRoleDb(wakaAktif, ["WAKA"]), true);
  assert.equal(punyaRoleDb(kepalaAktif, ["KEPALA"]), true);
  assert.equal(punyaRoleDb(wakaAktif, ["KEPALA"]), false);
  const nowWaka: InfoUserDb = { id: "w1", role: "KEPALA", aktif: true, guruId: null };
  assert.equal(punyaRoleDb(nowWaka, ["KEPALA"]), true);
});

test("guru tanpa guruId tidak operasional", () => {
  const tanpaGuruId: InfoUserDb = { id: "u9", role: "GURU", aktif: true, guruId: null, guru: null };
  assert.equal(guruOperasionalValid(tanpaGuruId), false);
});

test("guru dengan data guru dinonaktifkan / soft-delete tidak operasional", () => {
  const guruNonaktif = { ...guruAktif, guru: { status: false, deletedAt: null } };
  const guruDeleted = { ...guruAktif, guru: { status: true, deletedAt: new Date() } };
  assert.equal(guruOperasionalValid(guruNonaktif), false);
  assert.equal(guruOperasionalValid(guruDeleted), false);
  assert.equal(guruOperasionalValid(guruAktif), true);
});

test("hasilAksesApi: 401 untuk tidak login / nonaktif / guru non-operasional", () => {
  assert.equal(hasilAksesApi(null).ok, false);
  assert.equal((hasilAksesApi(null) as { status: number }).status, 401);
  assert.equal(hasilAksesApi(guruNonAktif).ok, false);
  const nonOp: InfoUserDb = { id: "u9", role: "GURU", aktif: true, guruId: null, guru: null };
  assert.equal(hasilAksesApi(nonOp).ok, false);
});

test("hasilAksesApi: 403 untuk role yang tidak berhak", () => {
  const r = hasilAksesApi(guruAktif, ["ADMIN", "SUPERADMIN"]);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 403);
});

test("hasilAksesApi: user aktif berhak diizinkan", () => {
  const r = hasilAksesApi(guruAktif, ["GURU", "ADMIN"]);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.user.id, "u1");
});

test("cron bearer dengan secret valid tetap berjalan tanpa sesi", () => {
  assert.equal(cronBearerValid("Bearer rahasia", "rahasia"), true);
  assert.equal(cronBearerValid("Bearer salah", "rahasia"), false);
  assert.equal(cronBearerValid("Bearer rahasia", undefined), false);
  assert.equal(cronBearerValid(null, "rahasia"), false);
});

test("cron bearer: panjang beda / awalan mirip ditolak (constant-time)", () => {
  assert.equal(cronBearerValid("Bearer rahasiaa", "rahasia"), false);
  assert.equal(cronBearerValid("Bearer ra", "rahasia"), false);
  assert.equal(cronBearerValid("Bearer rahasia ", "rahasia"), false);
  assert.equal(cronBearerValid("bearer rahasia", "rahasia"), false);
  assert.equal(cronBearerValid("Bearer rahasia", "rahasia"), true);
});

test("WAKA dengan guruId aktif = pengajar operasional", () => {
  const wakaPengajar: InfoUserDb = { id: "w1", role: "WAKA", aktif: true, guruId: "g1", guru: { status: true, deletedAt: null } };
  assert.equal(adalahPengajarOperasional(wakaPengajar), true);
  // guruOperasionalValid hanya untuk role GURU.
  assert.equal(guruOperasionalValid(wakaPengajar), false);
});

test("WAKA tanpa guruId bukan pengajar, tetap waka pemantau", () => {
  assert.equal(adalahPengajarOperasional(wakaAktif), false);
  assert.equal(punyaRoleDb(wakaAktif, ["WAKA"]), true);
});

test("GURU yang dipromosikan jadi WAKA dengan guruId tetap operasional", () => {
  const g = { id: "g1", role: "WAKA", aktif: true, guruId: "g1", guru: { status: true, deletedAt: null } };
  assert.equal(adalahPengajarOperasional(g), true);
});

test("WAKA dengan guru nonaktif bukan pengajar operasional", () => {
  const wakaBad: InfoUserDb = { id: "w1", role: "WAKA", aktif: true, guruId: "g1", guru: { status: false, deletedAt: null } };
  assert.equal(adalahPengajarOperasional(wakaBad), false);
});