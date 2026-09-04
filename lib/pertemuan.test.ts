import { test } from "node:test";
import assert from "node:assert/strict";
import { rencanaPertemuanOtomatis, type RencanaPertemuanOtomatis } from "./pertemuan";
import { hariDariTanggal } from "./absensi-harian";
import type { Hari } from "@prisma/client";

const hutc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const taId = "ta-2025";
const smt = { id: "s1", tahunAjaranId: taId, mulai: hutc("2026-07-20"), selesai: hutc("2026-07-31") };

const jadwalSenin = { id: "j-senin", semesterId: "s1", hari: "SENIN" as Hari };
const jadwalSabtu = { id: "j-sabtu", semesterId: "s1", hari: "SABTU" as Hari };
const jadwalSelasa = { id: "j-selasa", semesterId: "s1", hari: "SELASA" as Hari };

type ItemExisting = { id: string; jadwalId: string | null; tanggal: Date; pertemuanKe: number; sumber: string };

function buatRencana({ jadwals, existing = [], libur = [], sampai = hutc("2026-07-28") }: {
  jadwals: { id: string; semesterId: string; hari: Hari }[];
  existing?: ItemExisting[];
  libur?: { tanggal: Date; tahunAjaranId: string | null }[];
  sampai?: Date;
}): RencanaPertemuanOtomatis {
  return rencanaPertemuanOtomatis({ semesters: [smt], jadwals, libur, existing, sampai, namaHari: hariDariTanggal });
}

test("guru yang tidak pernah membuka aplikasi: seluruh slot jadwal direncanakan", () => {
  const r = buatRencana({ jadwals: [jadwalSenin, jadwalSabtu] });
  // Senin 20 & 27, Sabtu 25 — Minggu 26 dilewati.
  assert.equal(r.slotTotal, 3);
  assert.equal(r.belumAda, 3);
  assert.equal(r.minggu, 1);

  const senin = r.buat.filter((x) => x.jadwalId === "j-senin").map((x) => hutcISO(x.tanggal));
  assert.deepEqual(senin, ["2026-07-20", "2026-07-27"]);
  const sabtu = r.buat.filter((x) => x.jadwalId === "j-sabtu").map((x) => hutcISO(x.tanggal));
  assert.deepEqual(sabtu, ["2026-07-25"]);
});

// helper — jangan dipanggil sebelum definisi (hoisting fungsi)
function hutcISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

test("backfill beberapa hari terlewat: tanggal lama yang hilang ikut direncanakan", () => {
  // Guru hanya punya pertemuan Senin 27 (ke-2 via lazy), Senin 20 hilang.
  const existing: ItemExisting[] = [{ id: "p-27", jadwalId: "j-senin", tanggal: hutc("2026-07-27"), pertemuanKe: 2, sumber: "OTOMATIS" }];
  const r = buatRencana({ jadwals: [jadwalSenin], existing });
  const dibuatSenin = r.buat.filter((x) => x.jadwalId === "j-senin");
  assert.deepEqual(dibuatSenin.map((x) => hutcISO(x.tanggal)), ["2026-07-20"]);
  assert.equal(dibuatSenin[0].pertemuanKe, 1);
  assert.ok(r.perluNormalisasi.includes("j-senin")); // ada gap / nomor perlu disusun ulang
});

test("hari libur (tipe LIBUR) tidak menghasilkan pertemuan", () => {
  const r = buatRencana({
    jadwals: [jadwalSenin],
    libur: [{ tanggal: hutc("2026-07-27"), tahunAjaranId: taId }],
  });
  assert.equal(r.slotTotal, 1); // hanya Senin 20
  assert.deepEqual(r.libur, ["2026-07-27"]);
  const dibuatSenin = r.buat.filter((x) => x.jadwalId === "j-senin").map((x) => hutcISO(x.tanggal));
  assert.deepEqual(dibuatSenin, ["2026-07-20"]);
});

test("kalender libur tahun ajaran lain tidak memengaruhi semester ini", () => {
  const r = buatRencana({
    jadwals: [jadwalSenin],
    libur: [{ tanggal: hutc("2026-07-27"), tahunAjaranId: "ta-LAIN" }],
  });
  assert.equal(r.slotTotal, 2);
  assert.equal(r.belumAda, 2);
});

test("Kalender libur dengan tahunAjaranId null berlaku umum", () => {
  const r = buatRencana({
    jadwals: [jadwalSenin],
    libur: [{ tanggal: hutc("2026-07-27"), tahunAjaranId: null }],
  });
  assert.deepEqual(r.buat.map((x) => hutcISO(x.tanggal)), ["2026-07-20"]);
});

test("hari Minggu: tidak ada pertemuan otomatis", () => {
  const jadwalMingguFix = { ...jadwalSenin, id: "j-minggu", hari: "MINGGU" as never } as never;
  const r = rencanaPertemuanOtomatis({
    semesters: [smt],
    jadwals: [jadwalMingguFix as unknown as typeof jadwalSenin],
    libur: [],
    existing: [],
    sampai: hutc("2026-07-28"),
    namaHari: hariDariTanggal,
  });
  // Jenis Hari tidak menyediakan MINGGU — tidak ada jadwal yang match, slot 0.
  assert.equal(r.slotTotal, 0);
  assert.equal(r.belumAda, 0);
});

test("batas awal semester: tanggal sebelum semester.mulai tidak diproses", () => {
  const r = buatRencana({ jadwals: [jadwalSenin], sampai: hutc("2026-07-20") });
  assert.equal(r.slotTotal, 1);
  assert.deepEqual(r.buat.map((x) => hutcISO(x.tanggal)), ["2026-07-20"]);
});

test("batas akhir semester: setelah semester.selesai tidak diproses", () => {
  const smtPendek = { ...smt, selesai: hutc("2026-07-24") };
  const r = rencanaPertemuanOtomatis({
    semesters: [smtPendek],
    jadwals: [jadwalSenin, jadwalSabtu],
    libur: [],
    existing: [],
    sampai: hutc("2026-07-31"),
    namaHari: hariDariTanggal,
  });
  // Rentang 20..24 Juli: Senin 20 & Sabtu 25 (di luar). Minggu 26 di luar.
  assert.deepEqual(r.buat.map((x) => hutcISO(x.tanggal)).sort(), ["2026-07-20"]);
});

test("tanggal masa depan tidak pernah direncanakan", () => {
  const r = buatRencana({ jadwals: [jadwalSelasa, jadwalSenin], sampai: hutc("2026-07-28") });
  const maks = Math.max(...r.buat.map((x) => x.tanggal.getTime()));
  assert.ok(maks <= hutc("2026-07-28").getTime(), "tidak boleh melewati sampai");
  assert.ok(!r.buat.some((x) => hutcISO(x.tanggal) === "2026-08-03")); // Senin depan tidak diproses
});

test("eksekusi berulang (idempotent): tidak menambah duplikat", () => {
  const pertama = buatRencana({ jadwals: [jadwalSenin, jadwalSabtu] });
  const existingSetelah = pertama.buat.map((x) => ({
    jadwalId: x.jadwalId,
    tanggal: x.tanggal,
    pertemuanKe: x.pertemuanKe,
    sumber: "OTOMATIS" as const,
  }));
  const kedua = buatRencana({
    jadwals: [jadwalSenin, jadwalSabtu],
    existing: existingSetelah.map((x, i) => ({ id: `p-${i}`, ...x })),
  });
  assert.equal(kedua.belumAda, 0);
  assert.equal(kedua.sudahAda, pertama.buat.length);
});

test("eksekusi paralel: rencana tanpa saling menimpa (murni, deterministik)", () => {
  const existing: ItemExisting[] = [{ id: "p-20", jadwalId: "j-senin", tanggal: hutc("2026-07-20"), pertemuanKe: 1, sumber: "OTOMATIS" }];
  const a = buatRencana({ jadwals: [jadwalSenin], existing });
  const b = buatRencana({ jadwals: [jadwalSenin], existing });
  assert.deepEqual(a.buat.map((x) => hutcISO(x.tanggal)), b.buat.map((x) => hutcISO(x.tanggal)));
  assert.deepEqual(a.buat.map((x) => x.pertemuanKe), b.buat.map((x) => x.pertemuanKe));
});

test("pertemuan yang sudah punya jurnal/absensi tidak diutak-atik", () => {
  const existing: ItemExisting[] = [{ id: "p-20", jadwalId: "j-senin", tanggal: hutc("2026-07-20"), pertemuanKe: 1, sumber: "OTOMATIS" }];
  const r = buatRencana({ jadwals: [jadwalSenin], existing });
  assert.equal(r.sudahAda, 1);
  assert.ok(!r.buat.some((x) => hutcISO(x.tanggal) === "2026-07-20"));
});

test("penomoran: pertemuan lama bernomor 2, backfill tanggal lama harus jadi ke-1", () => {
  const existing: ItemExisting[] = [{ id: "p-27", jadwalId: "j-senin", tanggal: hutc("2026-07-27"), pertemuanKe: 2, sumber: "OTOMATIS" }];
  const r = buatRencana({ jadwals: [jadwalSenin], existing });
  const baru = r.buat.find((x) => hutcISO(x.tanggal) === "2026-07-20");
  assert.equal(baru?.pertemuanKe, 1);
  assert.ok(r.perluNormalisasi.includes("j-senin"));
});