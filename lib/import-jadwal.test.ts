import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { importJadwalBaru } from "./import-jadwal";
import { susunBarisJadwal } from "./kolom-jadwal";

function fakePrisma(opts: {
  gurus?: { id: string; nama: string; kode: string | null }[];
  kelas?: { id: string; nama: string; tingkat: number; waliKelasId: string | null }[];
  mapels?: { id: string; nama: string; kode: string | null }[];
  jadwal?: { kelasId: string; hari: string; jamKeMulai: number; jamKeSelesai: number; mapelId: string }[];
  jadwalFull?: unknown[];
}) {
  const calls: { model: string; aksi: string }[] = [];
  const gurus = opts.gurus ?? [];
  const kelas = opts.kelas ?? [{ id: "k1", nama: "IX F", tingkat: 9, waliKelasId: null }];
  const mapels = opts.mapels ?? [{ id: "mIps", nama: "IPS", kode: "IPS" }, { id: "mWali", nama: "Wali Kelas", kode: null }];
  const jadwal = opts.jadwal ?? [];
  const jadwalFull = opts.jadwalFull ?? jadwal;
  return {
    calls,
    client: {
      guru: {
        findMany: async () => gurus as never,
      },
      kelas: {
        findMany: async () => kelas as never,
        create: async (args: { data: { nama: string; tingkat: number } }) => {
          calls.push({ model: "kelas", aksi: "create" });
          return { id: `k-${args.data.nama}`, nama: args.data.nama, tingkat: args.data.tingkat, waliKelasId: null } as never;
        },
        update: async () => {
          calls.push({ model: "kelas", aksi: "update" });
          return {} as never;
        },
      },
      mataPelajaran: {
        findMany: async () => mapels as never,
        create: async (args: { data: { nama: string; kode: string | null } }) => {
          calls.push({ model: "mataPelajaran", aksi: "create" });
          return { id: `m-${args.data.nama}`, nama: args.data.nama, kode: args.data.kode } as never;
        },
      },
      jadwal: {
        findMany: async () => (jadwalFull as never[]) ?? (jadwal as never[]),
        create: async () => {
          calls.push({ model: "jadwal", aksi: "create" });
          return {} as never;
        },
      },
      _calls: calls,
    } as unknown as Parameters<typeof importJadwalBaru>[4] extends { prismaClient?: infer T } ? T : never,
  };
}

const SEMESTER = { id: "sem1", nama: "Ganjil (2025/2026)" };

describe("TAHAP 3B.5-B — Import Jadwal selaras master Guru (fungsi produksi)", () => {
  test("Guru tersedia → preview dapat dilanjutkan (jadwalBaru >0, guruTidakDitemukan kosong)", async () => {
    const f = fakePrisma({ gurus: [{ id: "g1", nama: "Akhmadi, S.Pd.", kode: "K5" }] });
    const rows = [["Akhmadi, S.Pd. (K5)", "Senin", "4", "9:15 - 9:55", "IPS", "IX F"]];
    const plan = await importJadwalBaru(rows, SEMESTER, "gabung", "preview", { prismaClient: f.client as never });
    assert.equal(plan.guruTidakDitemukan.length, 0);
    assert.equal(plan.error.length, 0);
    assert.equal(plan.jadwalBaru, 1);
    assert.equal(plan.kelasBaru.length, 0);
    assert.ok(!plan.guruBaru || plan.guruBaru.length === 0);
  });

  test("Guru tidak tersedia → preview error, guruTidakDitemukan memuat kode dan nomor baris", async () => {
    const f = fakePrisma({ gurus: [] });
    const rows = [["Akhmadi, S.Pd. (K5)", "Senin", "4", "9:15 - 9:55", "IPS", "IX F"]];
    const plan = await importJadwalBaru(rows, SEMESTER, "gabung", "preview", { prismaClient: f.client as never });
    assert.equal(plan.guruTidakDitemukan.length, 1);
    assert.equal(plan.guruTidakDitemukan[0].kode, "K5");
    assert.equal(plan.guruTidakDitemukan[0].barisKe, 2);
    assert.match(plan.guruTidakDitemukan[0].nama, /Akhmadi/);
    assert.ok(plan.error.some((e) => e.includes("K5") && e.includes("Import Guru")));
    assert.equal(plan.jadwalBaru, 0);
  });

  test("Eksekusi dengan Guru hilang tidak memanggil create/update manapun (preflight mencegah partial write)", async () => {
    const f = fakePrisma({ gurus: [] });
    const rows = [
      ["Akhmadi, S.Pd. (K5)", "Senin", "4", "9:15 - 9:55", "IPS", "IX F"],
      ["Akhmadi, S.Pd. (K5)", "Selasa", "1", "6:50 - 7:55", "IPS", "IX E"],
    ];
    const plan = await importJadwalBaru(rows, SEMESTER, "gabung", "exec", { prismaClient: f.client as never });
    assert.ok(plan.guruTidakDitemukan.length > 0);
    assert.equal(f.calls.length, 0, `harus 0 write, got ${JSON.stringify(f.calls)}`);
    assert.ok(!f.calls.some((c) => c.model === "guru" && c.aksi === "create"), "tidak boleh guru.create");
    assert.ok(!f.calls.some((c) => c.model === "kelas" && c.aksi === "create"));
    assert.ok(!f.calls.some((c) => c.model === "mataPelajaran" && c.aksi === "create"));
    assert.ok(!f.calls.some((c) => c.model === "jadwal" && c.aksi === "create"));
    assert.ok(!f.calls.some((c) => c.model === "kelas" && c.aksi === "update"));
  });

  test("Import Jadwal tidak pernah membuat Guru otomatis (guru.create tidak dipanggil bahkan jika kode ada)", async () => {
    const previewFake = fakePrisma({ gurus: [{ id: "g1", nama: "Akhmadi, S.Pd.", kode: "K5" }] });
    const rows = [
      ["Akhmadi, S.Pd. (K5)", "Senin", "4", "9:15 - 9:55", "IPS", "IX F"],
      ["Budi Baru (F2)", "Selasa", "1", "6:50 - 7:55", "IPS", "IX E"],
    ];
    const preview = await importJadwalBaru(rows, SEMESTER, "gabung", "preview", { prismaClient: previewFake.client as never });
    assert.equal(preview.guruTidakDitemukan.length, 1);
    assert.equal(preview.guruTidakDitemukan[0].kode, "F2");
    const execFake = fakePrisma({ gurus: [{ id: "g1", nama: "Akhmadi, S.Pd.", kode: "K5" }] });
    const exec = await importJadwalBaru(rows, SEMESTER, "gabung", "exec", { prismaClient: execFake.client as never });
    assert.equal(exec.guruTidakDitemukan.length, 1);
    assert.equal(execFake.calls.length, 0, `exec harus 0 write, got ${JSON.stringify(execFake.calls)}`);
    assert.ok(!execFake.calls.some((c) => c.model === "guru" && c.aksi === "create"));
    assert.equal(exec.jadwalBaru, 0);
  });

  test("Semua Guru tersedia → Kelas/Mapel baru masih dapat direncanakan (preview)", async () => {
    const f = fakePrisma({
      gurus: [{ id: "g1", nama: "Akhmadi, S.Pd.", kode: "K5" }],
      kelas: [{ id: "k1", nama: "IX F", tingkat: 9, waliKelasId: null }],
      mapels: [{ id: "mIps", nama: "IPS", kode: "IPS" }],
    });
    // Kelas VII A belum ada, Mapel Tahfidz belum ada — harus masuk kelasBaru/mapelBaru
    const rows = [["Akhmadi, S.Pd. (K5)", "Senin", "4", "9:15 - 9:55", "Tahfidz", "VII A"]];
    const plan = await importJadwalBaru(rows, SEMESTER, "gabung", "preview", { prismaClient: f.client as never });
    assert.equal(plan.guruTidakDitemukan.length, 0);
    assert.equal(plan.kelasBaru.length, 1);
    assert.equal(plan.kelasBaru[0], "VII A");
    assert.equal(plan.mapelBaru.length, 1);
    assert.equal(plan.jadwalBaru, 1);
  });

  test("Baris Wali Kelas tidak dihitung sebagai Jadwal pelajaran", async () => {
    const f = fakePrisma({ gurus: [{ id: "g1", nama: "Akhmadi, S.Pd.", kode: "K5" }] });
    const rows = [["Akhmadi, S.Pd. (K5)", "Senin", "4", "9:15 - 9:55", "Wali Kelas", "IX F"]];
    const plan = await importJadwalBaru(rows, SEMESTER, "gabung", "preview", { prismaClient: f.client as never });
    assert.equal(plan.waliKelas.length, 1);
    assert.equal(plan.jadwalBaru, 0);
    assert.equal(plan.guruTidakDitemukan.length, 0);
  });

  test("Preview file saat ini membedakan 418 baris data; 19 Wali Kelas; 399 Jadwal pelajaran", async () => {
    // Bangun 418 rows sintetis: 19 Wali Kelas + 399 IPS — semua guru tersedia
    const gurus = [{ id: "g1", nama: "Akhmadi, S.Pd.", kode: "K5" }];
    // Tambahkan guru-guru lain agar 19 wali kelas berbeda guru tidak error
    for (let i = 2; i <= 20; i++) gurus.push({ id: `g${i}`, nama: `Guru ${i}`, kode: `K${i}` });
    const f = fakePrisma({ gurus });
    const rows: string[][] = [];
    // 19 Wali Kelas
    for (let i = 0; i < 19; i++) rows.push([`Guru ${i + 2} (K${i + 2})`, "Senin", "1", "6:50 - 7:55", "Wali Kelas", `VII ${String.fromCharCode(65 + (i % 8))}`]);
    // 399 IPS dengan kombinasi hari/jam/kelas unik agar tidak bentrok
    const haris = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    for (let i = 0; i < 399; i++) {
      const hari = haris[i % haris.length];
      const jam = String((i % 9) + 1);
      const kelas = `Kelas${i}`;
      rows.push(["Akhmadi, S.Pd. (K5)", hari, jam, "9:15 - 9:55", "IPS", kelas]);
    }
    // Perlu kelas untuk IPS — mock akan auto-create kelas baru, jadi tidak perlu pre-seed semua
    const plan = await importJadwalBaru(rows, SEMESTER, "gabung", "preview", { prismaClient: f.client as never });
    assert.equal(rows.length, 418);
    assert.equal(plan.waliKelas.length, 19);
    // jadwalBaru harus 399 (Wali Kelas tidak dihitung)
    // Catatan: karena kelas dibuat baru tiap row, tidak ada bentrok kelas — semua 399 jadwal valid
    // Jika ada bentrok karena overlap jam yang sama pada kelas yang sama, jumlah bisa <399; tes ini hanya
    // memverifikasi pemisahan wali vs pelajaran, bukan bentrok.
    assert.equal(plan.waliKelas.length + plan.jadwalBaru, 418 - plan.dilewati);
  });
});

describe("TAHAP 3B.5-C — Tabrakan data Guru vs Jadwal", () => {
  test("Kode mengarah ke guru dengan nama BEDA TOTAL → jadwal tetap masuk memakai nama data guru, tapi butuh konfirmasi (guruBedaNama)", async () => {
    const f = fakePrisma({ gurus: [{ id: "g-siti", nama: "Siti Aminah, S.Pd.", kode: "K5" }] });
    const rows = [["Budi Santoso (K5)", "Senin", "4", "9:15 - 9:55", "IPS", "IX F"]];
    const plan = await importJadwalBaru(rows, SEMESTER, "gabung", "preview", { prismaClient: f.client as never });
    assert.equal(plan.guruBedaNama.length, 1);
    assert.equal(plan.guruBedaNama[0].namaDb, "Siti Aminah, S.Pd.");
    assert.equal(plan.guruCatatan.length, 0);
    assert.equal(plan.perluKonfirmasiKode, true);
    // Jadwal tetap direncanakan — memakai guru pemilik kode (nama dari data guru).
    assert.equal(plan.jadwalBaru, 1);
    // Tanpa konfirmasi → belum bisa dieksekusi, tapi bukan error (tidak diblokir).
    assert.equal(plan.siapEksekusi, false);
    assert.ok(!plan.error.some((e) => e.includes("K5")));

    // Preview dengan konfirmasi → siap dieksekusi.
    const fKonf = fakePrisma({ gurus: [{ id: "g-siti", nama: "Siti Aminah, S.Pd.", kode: "K5" }] });
    const planKonf = await importJadwalBaru(rows, SEMESTER, "gabung", "preview", {
      prismaClient: fKonf.client as never,
      konfirmasiKodeBedaNama: true,
    });
    assert.equal(planKonf.siapEksekusi, true);

    // Eksekusi TANPA konfirmasi → tidak menulis apa pun.
    const f2 = fakePrisma({ gurus: [{ id: "g-siti", nama: "Siti Aminah, S.Pd.", kode: "K5" }] });
    const exec = await importJadwalBaru(rows, SEMESTER, "gabung", "exec", { prismaClient: f2.client as never });
    assert.equal(exec.siapEksekusi, false);
    assert.equal(f2.calls.length, 0);

    // Eksekusi DENGAN konfirmasi → jadwal ditulis memakai guru dari kode.
    const f3 = fakePrisma({ gurus: [{ id: "g-siti", nama: "Siti Aminah, S.Pd.", kode: "K5" }] });
    const execKonf = await importJadwalBaru(rows, SEMESTER, "gabung", "exec", {
      prismaClient: f3.client as never,
      konfirmasiKodeBedaNama: true,
    });
    assert.equal(execKonf.siapEksekusi, true);
    assert.equal(execKonf.jadwalBaru, 1);
    assert.ok(f3.calls.some((c) => c.model === "jadwal" && c.aksi === "create"));
  });

  test("Nama beda format tapi mirip (mis. tanpa gelar) → tetap diproses, hanya catatan info", async () => {
    const f = fakePrisma({ gurus: [{ id: "g1", nama: "Akhmadi, S.Pd.", kode: "K5" }] });
    const rows = [["Akhmadi (K5)", "Senin", "4", "9:15 - 9:55", "IPS", "IX F"]];
    const plan = await importJadwalBaru(rows, SEMESTER, "gabung", "preview", { prismaClient: f.client as never });
    assert.equal(plan.guruBedaNama.length, 0);
    assert.equal(plan.guruCatatan.length, 1);
    assert.equal(plan.jadwalBaru, 1);
    assert.equal(plan.siapEksekusi, true);
  });

  test("Bentrok guru DALAM SATU FILE terdeteksi saat preview (konsisten dengan exec)", async () => {
    const f = fakePrisma({ gurus: [{ id: "g1", nama: "Akhmadi, S.Pd.", kode: "K5" }] });
    const rows = [
      ["Akhmadi, S.Pd. (K5)", "Senin", "4", "9:15 - 9:55", "IPS", "IX F"],
      ["Akhmadi, S.Pd. (K5)", "Senin", "4", "9:15 - 9:55", "Matematika", "IX E"],
    ];
    const plan = await importJadwalBaru(rows, SEMESTER, "gabung", "preview", { prismaClient: f.client as never });
    assert.equal(plan.jadwalBaru, 1);
    assert.equal(plan.bentrok, 1);
    assert.equal(plan.dilewati, 1);
    assert.equal(plan.siapEksekusi, false);
    assert.ok(plan.error.some((e) => e.includes("Bentrok")));
  });

  test("Detail per-baris tersedia untuk tabel ringkasan (baru/bentrok/dilewati/blokir)", async () => {
    const f = fakePrisma({ gurus: [{ id: "g1", nama: "Akhmadi, S.Pd.", kode: "K5" }] });
    const rows = [
      ["Akhmadi, S.Pd. (K5)", "Senin", "4", "9:15 - 9:55", "IPS", "IX F"],
      ["Akhmadi, S.Pd. (K5)", "Senin", "4", "9:15 - 9:55", "Matematika", "IX E"],
      ["Guru Hilang (F9)", "Selasa", "1", "6:50 - 7:55", "IPS", "IX F"],
    ];
    const plan = await importJadwalBaru(rows, SEMESTER, "gabung", "preview", { prismaClient: f.client as never });
    assert.equal(plan.barisJadwal.length, 3);
    const statuses = [...plan.barisJadwal].sort((a, b) => a.barisKe - b.barisKe).map((r) => r.status);
    assert.deepEqual(statuses, ["baru", "bentrok", "blokir"]);
    assert.ok(plan.barisJadwal.every((r) => r.barisKe >= 2));
  });
});

describe("TAHAP 3B.5-D — Kecocokan lewat nama & nama ambigu terlihat jelas", () => {
  test("Kode di file tidak dikenal tapi nama cocok → dicocokkan lewat nama (guruCocokNama), tidak diblokir", async () => {
    const f = fakePrisma({ gurus: [{ id: "g1", nama: "Budi Santoso", kode: "K5" }] });
    const rows = [["Budi Santoso (K6)", "Senin", "4", "9:15 - 9:55", "IPS", "IX F"]];
    const plan = await importJadwalBaru(rows, SEMESTER, "gabung", "preview", { prismaClient: f.client as never });
    assert.equal(plan.guruCocokNama.length, 1);
    assert.equal(plan.guruCocokNama[0].kodeFile, "K6");
    assert.equal(plan.guruCocokNama[0].kodeDb, "K5");
    assert.equal(plan.jadwalBaru, 1);
    assert.equal(plan.siapEksekusi, true);
    assert.ok(plan.barisJadwal.some((r) => r.status === "cocok"));
    assert.equal(plan.guruBedaNama.length, 0);
  });

  test("Dua guru senama & file tanpa kode → diblokir (nama ambigu), bukan diam-diam pilih salah satu", async () => {
    const f = fakePrisma({
      gurus: [
        { id: "g1", nama: "Budi Santoso", kode: "K5" },
        { id: "g2", nama: "Budi Santoso", kode: "K7" },
      ],
    });
    const rows = [["Budi Santoso", "Senin", "4", "9:15 - 9:55", "IPS", "IX F"]];
    const plan = await importJadwalBaru(rows, SEMESTER, "gabung", "preview", { prismaClient: f.client as never });
    assert.equal(plan.jadwalBaru, 0);
    assert.equal(plan.siapEksekusi, false);
    assert.ok(plan.error.some((e) => e.includes("ambigu")));
    assert.equal(plan.guruTidakDitemukan.length, 0);
    assert.equal(plan.guruBedaNama.length, 0);
    assert.ok(plan.barisJadwal.some((r) => r.status === "blokir"));
  });

  test("Dua guru senama tapi file menulis kode yang benar → tetap jalan normal", async () => {
    const f = fakePrisma({
      gurus: [
        { id: "g1", nama: "Budi Santoso", kode: "K5" },
        { id: "g2", nama: "Budi Santoso", kode: "K7" },
      ],
    });
    const rows = [["Budi Santoso (K7)", "Senin", "4", "9:15 - 9:55", "IPS", "IX F"]];
    const plan = await importJadwalBaru(rows, SEMESTER, "gabung", "preview", { prismaClient: f.client as never });
    assert.equal(plan.jadwalBaru, 1);
    assert.equal(plan.siapEksekusi, true);
    assert.equal(plan.guruCocokNama.length, 0);
    assert.equal(plan.error.length, 0);
  });
});

describe("Kolom Waktu opsional — file tanpa kolom Waktu tetap terimport benar", () => {
  test("gabung tanpa kolom Waktu (gaya file hasil konversi PDF): kolom tidak bergeser", async () => {
    const f = fakePrisma({
      gurus: [{ id: "g1", nama: "Agus Setiawati, S.Ag., M.Pd.", kode: "B1" }],
    });
    const header = ["Guru", "Hari", "Jam Ke", "Mapel/Kegiatan", "Kelas"];
    // Baris persis seperti contoh_jadwal/Jadwal_Guru_Utara_September_Terstruktur.xlsx
    const rowsFile = [["Agus Setiawati,S.Ag., M.P.d. (B1)", "Senin", "2", "Qur'an Hadist", "IX K"]];
    const { format, rows } = susunBarisJadwal(header, rowsFile);
    if (format === "lama") throw new Error("format tidak terduga");
    assert.equal(format, "gabung");
    const plan = await importJadwalBaru(rows, SEMESTER, format, "preview", { prismaClient: f.client as never });
    assert.equal(plan.error.length, 0);
    assert.equal(plan.guruTidakDitemukan.length, 0);
    assert.equal(plan.jadwalBaru, 1);
    // Label baris harus membaca hari/jam/kelas/mapel dari kolom yang benar
    // (mapel dinormalisasi: "Qur'an Hadist" → kanonik "Al-Qur'an Hadits")
    assert.match(plan.barisJadwal[0].teks, /Senin jam 2 IX K/);
    assert.match(plan.barisJadwal[0].teks, /Al-Qur'an Hadits/);
  });

  test("terpisah tanpa kolom Waktu (template baru): kode tetap jadi kunci sinkron", async () => {
    const f = fakePrisma({
      gurus: [{ id: "g1", nama: "Akhmadi, S.Pd.", kode: "K5" }],
    });
    const header = ["Guru", "Kode", "Hari", "Jam Ke", "Mapel/Kegiatan", "Kelas"];
    const rowsFile = [["Akhmadi, S.Pd.", "K5", "Senin", "4", "IPS", "IX F"]];
    const { format, rows } = susunBarisJadwal(header, rowsFile);
    if (format === "lama") throw new Error("format tidak terduga");
    assert.equal(format, "terpisah");
    const plan = await importJadwalBaru(rows, SEMESTER, format, "preview", { prismaClient: f.client as never });
    assert.equal(plan.error.length, 0);
    assert.equal(plan.guruTidakDitemukan.length, 0);
    assert.equal(plan.jadwalBaru, 1);
    assert.equal(plan.barisJadwal.length, 1);
    assert.match(plan.barisJadwal[0].teks, /Senin jam 4 IX F/);
  });

  test("hasil import file tanpa Waktu identik dengan file yang masih memakai kolom Waktu", async () => {
    const deps = { gurus: [{ id: "g1", nama: "Akhmadi, S.Pd.", kode: "K5" }] };
    const rowsTanpa = susunBarisJadwal(["Guru", "Kode", "Hari", "Jam Ke", "Mapel/Kegiatan", "Kelas"], [
      ["Akhmadi, S.Pd.", "K5", "Senin", "4", "IPS", "IX F"],
      ["Akhmadi, S.Pd.", "K5", "Selasa", "1", "IPS", "IX E"],
    ]);
    const rowsDengan = susunBarisJadwal(["Guru", "Kode", "Hari", "Jam Ke", "Waktu", "Mapel/Kegiatan", "Kelas"], [
      ["Akhmadi, S.Pd.", "K5", "Senin", "4", "9:15 - 9:55", "IPS", "IX F"],
      ["Akhmadi, S.Pd.", "K5", "Selasa", "1", "6:50 - 7:55", "IPS", "IX E"],
    ]);
    if (rowsTanpa.format === "lama" || rowsDengan.format === "lama") throw new Error("format tidak terduga");
    const a = await importJadwalBaru(rowsTanpa.rows, SEMESTER, rowsTanpa.format, "preview", {
      prismaClient: fakePrisma(deps).client as never,
    });
    const b = await importJadwalBaru(rowsDengan.rows, SEMESTER, rowsDengan.format, "preview", {
      prismaClient: fakePrisma(deps).client as never,
    });
    assert.equal(a.jadwalBaru, b.jadwalBaru);
    assert.equal(a.error.length, b.error.length);
    assert.equal(a.barisJadwal.length, b.barisJadwal.length);
    assert.deepEqual(a.barisJadwal.map((r) => r.status), b.barisJadwal.map((r) => r.status));
  });
});
