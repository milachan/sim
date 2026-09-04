import { test } from "node:test";
import assert from "node:assert/strict";
import { intervalsOverlap } from "./jadwal-validasi";

test("interval inklusif: tumpang tindih", () => {
  assert.equal(intervalsOverlap(1, 3, 2, 4), true);
  assert.equal(intervalsOverlap(3, 3, 3, 3), true);
  assert.equal(intervalsOverlap(1, 2, 2, 3), true);
  assert.equal(intervalsOverlap(2, 3, 1, 2), true);
});

test("interval inklusif: tidak tumpang tindih (adjacent)", () => {
  assert.equal(intervalsOverlap(1, 2, 3, 4), false);
  assert.equal(intervalsOverlap(3, 4, 1, 2), false);
  assert.equal(intervalsOverlap(1, 1, 2, 2), false);
});

test("akun nonaktif dengan session lama ditolak (via isUserAktif)", async () => {
  const { isUserAktif, hasilAksesApi } = await import("./account-auth");
  assert.equal(isUserAktif({ id: "u1", role: "GURU", aktif: false, guruId: "g1", guru: { status: true, deletedAt: null } }), false);
  assert.equal(hasilAksesApi({ id: "u1", role: "GURU", aktif: false, guruId: "g1", guru: { status: true, deletedAt: null } }).ok, false);
});

test("perubahan role saat session masih aktif: role dari DB yang berlaku", async () => {
  const { punyaRoleDb } = await import("./account-auth");
  assert.equal(punyaRoleDb({ id: "a1", role: "GURU", aktif: true, guruId: "g1", guru: { status: true, deletedAt: null } }, ["ADMIN"]), false);
  assert.equal(punyaRoleDb({ id: "a1", role: "ADMIN", aktif: true, guruId: null }, ["ADMIN"]), true);
});

test("akun GURU tanpa relasi tidak operasional", async () => {
  const { guruOperasionalValid } = await import("./account-auth");
  assert.equal(guruOperasionalValid({ id: "u1", role: "GURU", aktif: true, guruId: null, guru: null }), false);
  assert.equal(guruOperasionalValid({ id: "u1", role: "GURU", aktif: true, guruId: "g1", guru: null }), false);
});

test("jadwal satu jam valid: 3-3", () => {
  assert.equal(intervalsOverlap(3, 3, 3, 3), true);
  assert.equal(intervalsOverlap(3, 3, 4, 4), false);
});

test("bentrok kelas: interval overlap", () => {
  assert.equal(intervalsOverlap(1, 3, 2, 2), true);
  assert.equal(intervalsOverlap(1, 2, 3, 4), false);
});

test("bentrok guru: interval overlap", () => {
  assert.equal(intervalsOverlap(1, 2, 1, 2), true);
  assert.equal(intervalsOverlap(1, 1, 2, 2), false);
});

test("adjacent tidak bentrok", () => {
  assert.equal(intervalsOverlap(1, 2, 3, 3), false);
  assert.equal(intervalsOverlap(1, 1, 2, 3), false);
});

test("edit jadwal: excludeId mengabaikan dirinya sendiri", async () => {
  const { validasiJadwal } = await import("./jadwal-validasi");
  const { prisma } = await import("./prisma");
  const origFindMany = prisma.jamPelajaran.findMany;
  (prisma.jamPelajaran.findMany as unknown as () => Promise<never[]>) = async () => Array.from({ length: 10 }, (_, i) => ({ hari: "SENIN", jamKe: i + 1, mulai: "07:00", selesai: "07:40" })) as never[];
  try {
    const existing = [
      { id: "j1", guruId: "g1", kelasId: "k1", hari: "SENIN" as const, jamKeMulai: 1, jamKeSelesai: 2, semesterId: "s1" },
      { id: "j2", guruId: "g2", kelasId: "k2", hari: "SENIN" as const, jamKeMulai: 3, jamKeSelesai: 4, semesterId: "s1" },
    ];
    const res = await validasiJadwal(
      { guruId: "g1", kelasId: "k1", mapelId: "m1", hari: "SENIN", jamKeMulai: 1, jamKeSelesai: 2, semesterId: "s1" },
      existing,
      { excludeId: "j1" }
    );
    assert.equal(res.ok, true);
  } finally {
    prisma.jamPelajaran.findMany = origFindMany;
    const { invalidateJamCache } = await import("./jam-utils");
    invalidateJamCache();
  }
});

test("validasi sama untuk manual dan impor via helper yang sama", async () => {
  const { validasiJadwal } = await import("./jadwal-validasi");
  const { prisma } = await import("./prisma");
  const origFindMany = prisma.jamPelajaran.findMany;
  (prisma.jamPelajaran.findMany as unknown as () => Promise<never[]>) = async () => Array.from({ length: 10 }, (_, i) => ({ hari: "SENIN", jamKe: i + 1, mulai: "07:00", selesai: "07:40" })) as never[];
  try {
    const existing = [
      { id: "j1", guruId: "g1", kelasId: "k1", hari: "SENIN" as const, jamKeMulai: 1, jamKeSelesai: 2, semesterId: "s1" },
    ];
    const input = { guruId: "g1", kelasId: "k1", mapelId: "m1", hari: "SENIN" as const, jamKeMulai: 2, jamKeSelesai: 3, semesterId: "s1" };
    const r1 = await validasiJadwal(input, existing);
    const r2 = await validasiJadwal(input, existing);
    assert.equal(r1.ok, false);
    assert.equal(r2.ok, false);
    if (!r1.ok && !r2.ok) assert.equal(r1.error, r2.error);
  } finally {
    prisma.jamPelajaran.findMany = origFindMany;
    const { invalidateJamCache } = await import("./jam-utils");
    invalidateJamCache();
  }
});

test("cache jam: invalidateJamCache wajib dipanggil setelah data jam berubah (regresi simpan jam pelajaran)", async () => {
  const { jamMaksHariFromDb, invalidateJamCache } = await import("./jam-utils");
  const { prisma } = await import("./prisma");
  const origFindMany = prisma.jamPelajaran.findMany;
  const barisSenin = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ hari: "SENIN", jamKe: i + 1, mulai: "07:00", selesai: "07:40" })) as never[];
  try {
    (prisma.jamPelajaran.findMany as unknown as () => Promise<never[]>) = async () => barisSenin(5);
    invalidateJamCache();
    assert.equal(await jamMaksHariFromDb("SENIN"), 5);

    // DB berubah (seolah-olah simpanJamPelajaran baru saja dijalankan admin)...
    (prisma.jamPelajaran.findMany as unknown as () => Promise<never[]>) = async () => barisSenin(8);
    // ...tanpa invalidasi, hasil lama masih terpakai (cache ±60 detik):
    assert.equal(await jamMaksHariFromDb("SENIN"), 5);

    // Setelah invalidasi, nilai termutakhir yang terpakai:
    invalidateJamCache();
    assert.equal(await jamMaksHariFromDb("SENIN"), 8);
  } finally {
    prisma.jamPelajaran.findMany = origFindMany;
    invalidateJamCache();
  }
});

test("hari tak dikenal ditolak validasi (guard runtime, bukan hanya tipe)", async () => {
  const { validasiJadwal } = await import("./jadwal-validasi");
  const input = {
    guruId: "g1",
    kelasId: "k1",
    mapelId: "m1",
    hari: "MINGGU",
    jamKeMulai: 1,
    jamKeSelesai: 2,
    semesterId: "s1",
  } as unknown as Parameters<typeof validasiJadwal>[0];
  const res = await validasiJadwal(input, []);
  assert.equal(res.ok, false);
});
