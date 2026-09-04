import { test } from "node:test";
import assert from "node:assert/strict";
import {
  guruIdPertemuan,
  namaGuruPertemuan,
  wherePertemuanGuru,
  wherePertemuanGuruAkun,
  hitungKelengkapanPerGuru,
  type PertemuanUntukAtribusi,
} from "./laporan";

const otomatisA = { sumber: "OTOMATIS", jadwal: { guruId: "g-a", guru: { nama: "Guru A" } } } as PertemuanUntukAtribusi;
const manualA = { sumber: "MANUAL", jadwal: null, dibuatOleh: { guruId: "g-a", nama: "Guru A" } } as PertemuanUntukAtribusi;
const manualB = { sumber: "MANUAL", jadwal: null, dibuatOleh: { guruId: "g-b", nama: "Guru B" } } as PertemuanUntukAtribusi;
const manualAdmin = { sumber: "MANUAL", jadwal: null, dibuatOleh: { guruId: null, nama: "Administrator" } } as PertemuanUntukAtribusi;
const manualTanpaPembuat = { sumber: "MANUAL", jadwal: null, dibuatOleh: null } as PertemuanUntukAtribusi;

test("jurnal otomatis diatribusikan ke guru jadwal", () => {
  assert.equal(guruIdPertemuan(otomatisA), "g-a");
  assert.equal(namaGuruPertemuan(otomatisA), "Guru A");
});

test("jurnal manual guru diatribusikan ke guru pembuat", () => {
  assert.equal(guruIdPertemuan(manualA), "g-a");
  assert.equal(namaGuruPertemuan(manualA), "Guru A");
});

test("jurnal manual guru lain tidak diatribusikan ke guru A", () => {
  assert.equal(guruIdPertemuan(manualB), "g-b");
  assert.notEqual(guruIdPertemuan(manualB), "g-a");
});

test("jurnal manual buatan admin tanpa guru tidak ditebak ke guru mana pun", () => {
  assert.equal(guruIdPertemuan(manualAdmin), null);
  assert.equal(namaGuruPertemuan(manualAdmin), "Administrator");
});

test("jurnal manual tanpa dibuatOlehId → null atribusi", () => {
  assert.equal(guruIdPertemuan(manualTanpaPembuat), null);
});

test("jadwal jadi sumber utama manual pengganti (tidak dihitung dua kali)", () => {
  const manualDgnJadwal = { sumber: "MANUAL", jadwal: { guruId: "g-a" }, dibuatOleh: { guruId: "g-b" } } as PertemuanUntukAtribusi;
  assert.equal(guruIdPertemuan(manualDgnJadwal), "g-a");
});

test("wherePertemuanGuru menangkap jadwal milik guru + manualnya", () => {
  const w = wherePertemuanGuru("g-a");
  assert.deepEqual(w, { OR: [{ jadwal: { guruId: "g-a" } }, { sumber: "MANUAL", dibuatOleh: { guruId: "g-a" } }] });
});

test("wherePertemuanGuruAkun menangkap jadwal milik guru + manual yang ia buat", () => {
  const w = wherePertemuanGuruAkun("g-a", "u1");
  assert.deepEqual(w, { OR: [{ jadwal: { guruId: "g-a" } }, { dibuatOlehId: "u1" }] });
});

test("hitungKelengkapanPerGuru: manual ikut, satu kali, admin tanpa guru tidak masuk", () => {
  const gurus = [
    { id: "g-a", nama: "Guru A" },
    { id: "g-b", nama: "Guru B" },
  ];
  const hasil = hitungKelengkapanPerGuru([otomatisA, manualA, manualB, manualAdmin, manualTanpaPembuat], gurus);
  const a = hasil.find((x) => x.guruId === "g-a")!;
  const b = hasil.find((x) => x.guruId === "g-b")!;
  // A: otomatis 1 + manual 1 = 2; B: manual 1.
  assert.equal(a.total, 2);
  assert.equal(a.manual, 1);
  assert.equal(b.total, 1);
  assert.equal(b.manual, 1);
  // Admin/tanpa pembuat tidak masuk ke guru mana pun — total semua tidak bertambah.
  assert.equal(hasil.reduce((sum, x) => sum + x.total, 0), 3);
});

test("hitungKelengkapanPerGuru: TIDAK_TERLAKSANA dikecualikan", () => {
  const batal = { status: "TIDAK_TERLAKSANA", sumber: "OTOMATIS", jadwal: { guruId: "g-a" } } as PertemuanUntukAtribusi;
  const hasil = hitungKelengkapanPerGuru([otomatisA, batal], [{ id: "g-a", nama: "Guru A" }]);
  assert.equal(hasil[0].total, 1);
});