import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { bacaJenisKelamin, cariKolom, prosesSiswa } from "./import-siswa";

function fakePrisma(opts: {
  kelas?: { id: string; nama: string }[];
  siswa?: {
    id: string;
    nama: string;
    nisn: string | null;
    nis: string | null;
    jenisKelamin: "L" | "P" | null;
    kelasId: string | null;
    deletedAt: Date | null;
  }[];
}) {
  const calls: { model: string; aksi: string }[] = [];
  const kelas = opts.kelas ?? [
    { id: "k7a", nama: "7A" },
    { id: "k7b", nama: "7B" },
  ];
  const siswa = opts.siswa ?? [];
  let seq = 0;
  return {
    calls,
    client: {
      kelas: { findMany: async () => kelas as never },
      siswa: {
        findMany: async () => siswa as never,
        create: async (args: { data: { nama: string; nisn: string | null; nis: string | null; jenisKelamin: "L" | "P" | null; kelasId: string | null } }) => {
          calls.push({ model: "siswa", aksi: "create" });
          return {
            id: `s${++seq}`,
            nama: args.data.nama,
            nisn: args.data.nisn,
            nis: null,
            jenisKelamin: args.data.jenisKelamin,
            kelasId: args.data.kelasId,
            deletedAt: null,
          } as never;
        },
        update: async () => {
          calls.push({ model: "siswa", aksi: "update" });
          return {} as never;
        },
      },
    } as never,
  };
}

async function buatFile(rows: string[][]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Siswa");
  for (const r of rows) ws.addRow(r);
  const buf = await wb.xlsx.writeBuffer();
  return buf as unknown as Uint8Array;
}

const HEADER = ["NISN", "NIS", "NAMA", "JENIS KELAMIN", "KELAS"];

test("cariKolom mendeteksi kolom JENIS KELAMIN dari berbagai header", () => {
  const a = cariKolom(["NISN", "NIS", "NAMA", "JENIS KELAMIN", "KELAS"]);
  assert.equal(a.jk, 3);
  const b = cariKolom(["NISN", "NIS", "NAMA", "JK", "KELAS"]);
  assert.equal(b.jk, 3);
  const c = cariKolom(["NISN", "NIS", "NAMA", "Jenis Kelamin", "Kelas"]);
  assert.equal(c.jk, 3);
  const d = cariKolom(["NISN", "NIS", "NAMA", "JENIS_KELAMIN", "KELAS"]);
  assert.equal(d.jk, 3);
  const e = cariKolom(["NISN", "NIS", "NAMA", "GENDER", "KELAS"]);
  assert.equal(e.jk, 3);
  // Tanpa kolom JK → -1 (opsional)
  const f = cariKolom(["NISN", "NIS", "NAMA", "KELAS"]);
  assert.equal(f.jk, -1);
});

test("bacaJenisKelamin menormalkan L/P & varian lainnya", () => {
  assert.deepEqual(bacaJenisKelamin("L"), { nilai: "L" });
  assert.deepEqual(bacaJenisKelamin("l"), { nilai: "L" });
  assert.deepEqual(bacaJenisKelamin("Laki-laki"), { nilai: "L" });
  assert.deepEqual(bacaJenisKelamin("LAKI LAKI"), { nilai: "L" });
  assert.deepEqual(bacaJenisKelamin("P"), { nilai: "P" });
  assert.deepEqual(bacaJenisKelamin("p"), { nilai: "P" });
  assert.deepEqual(bacaJenisKelamin("Perempuan"), { nilai: "P" });
  assert.deepEqual(bacaJenisKelamin(""), { nilai: null });
  assert.deepEqual(bacaJenisKelamin("   "), { nilai: null });
});

test("bacaJenisKelamin menolak nilai tak dikenal", () => {
  const hasil = bacaJenisKelamin("X");
  assert.ok("error" in hasil);
  assert.match(hasil.error, /tidak dikenal/);
});

test("Nama sama + NISN beda → konflik; eksekusi membuat siswa BARU (bukan replace)", async () => {
  const f = fakePrisma({
    siswa: [{ id: "s1", nama: "Budi Santoso", nisn: "1111111111", nis: "001", jenisKelamin: "L", kelasId: "k7a", deletedAt: null }],
  });
  const bytes = await buatFile([HEADER, ["2222222222", "002", "Budi Santoso", "L", "7B"]]);

  const preview = await prosesSiswa(bytes, "preview", { prismaClient: f.client as never });
  assert.equal(preview.konflik.length, 1);
  assert.equal(preview.konflik[0].nisnFile, "2222222222");
  assert.equal(preview.konflik[0].nisnLama, "1111111111");
  assert.equal(preview.baru.length, 0);
  assert.equal(preview.update.length, 0);
  assert.equal(preview.dilewati, 0);

  // Preview tidak menulis apa pun.
  assert.equal(f.calls.length, 0);

  // Eksekusi: CREATE (siswa baru), bukan UPDATE (replace data lama).
  const f2 = fakePrisma({
    siswa: [{ id: "s1", nama: "Budi Santoso", nisn: "1111111111", nis: "001", jenisKelamin: "L", kelasId: "k7a", deletedAt: null }],
  });
  const exec = await prosesSiswa(bytes, "exec", { prismaClient: f2.client as never });
  assert.equal(exec.konflik.length, 1);
  assert.ok(f2.calls.some((c) => c.model === "siswa" && c.aksi === "create"));
  assert.ok(!f2.calls.some((c) => c.aksi === "update"));
});

test("Nama sama tapi NISN/NIS kosong → dilewati dengan error (tidak bisa dibedakan)", async () => {
  const f = fakePrisma({
    siswa: [{ id: "s1", nama: "Budi Santoso", nisn: "1111111111", nis: "001", jenisKelamin: "L", kelasId: "k7a", deletedAt: null }],
  });
  const bytes = await buatFile([HEADER, ["", "", "Budi Santoso", "L", "7B"]]);
  const plan = await prosesSiswa(bytes, "preview", { prismaClient: f.client as never });
  assert.equal(plan.dilewati, 1);
  assert.equal(plan.konflik.length, 0);
  assert.equal(plan.error.length, 1);
  assert.match(plan.error[0], /NISN/);
});

test("NISN cocok tetap memperbarui data (bukan konflik) — regresi kunci sinkron", async () => {
  const f = fakePrisma({
    siswa: [{ id: "s1", nama: "Budi Santoso", nisn: "1111111111", nis: "001", jenisKelamin: "L", kelasId: "k7a", deletedAt: null }],
  });
  const bytes = await buatFile([HEADER, ["1111111111", "", "Budi Santoso", "L", "7B"]]);
  const preview = await prosesSiswa(bytes, "preview", { prismaClient: f.client as never });
  assert.equal(preview.update.length, 1);
  assert.equal(preview.konflik.length, 0);

  const f2 = fakePrisma({
    siswa: [{ id: "s1", nama: "Budi Santoso", nisn: "1111111111", nis: "001", jenisKelamin: "L", kelasId: "k7a", deletedAt: null }],
  });
  await prosesSiswa(bytes, "exec", { prismaClient: f2.client as never });
  assert.ok(f2.calls.some((c) => c.model === "siswa" && c.aksi === "update"));
  assert.ok(!f2.calls.some((c) => c.aksi === "create"));
});

test("Beberapa siswa senama di DB + NISN baru → dibuat siswa baru, yang lama tak tersentuh", async () => {
  const f = fakePrisma({
    siswa: [
      { id: "s1", nama: "Budi Santoso", nisn: "1111111111", nis: "001", jenisKelamin: "L", kelasId: "k7a", deletedAt: null },
      { id: "s2", nama: "Budi Santoso", nisn: "2222222222", nis: "002", jenisKelamin: "L", kelasId: "k7b", deletedAt: null },
    ],
  });
  const bytes = await buatFile([HEADER, ["3333333333", "003", "Budi Santoso", "P", "7B"]]);
  const preview = await prosesSiswa(bytes, "preview", { prismaClient: f.client as never });
  assert.equal(preview.konflik.length, 1);
  assert.equal(preview.konflik[0].namaLama, "Budi Santoso");

  const f2 = fakePrisma({
    siswa: [
      { id: "s1", nama: "Budi Santoso", nisn: "1111111111", nis: "001", jenisKelamin: "L", kelasId: "k7a", deletedAt: null },
      { id: "s2", nama: "Budi Santoso", nisn: "2222222222", nis: "002", jenisKelamin: "L", kelasId: "k7b", deletedAt: null },
    ],
  });
  const exec = await prosesSiswa(bytes, "exec", { prismaClient: f2.client as never });
  assert.equal(exec.konflik.length, 1);
  assert.equal(f2.calls.filter((c) => c.aksi === "create").length, 1);
  assert.equal(f2.calls.filter((c) => c.aksi === "update").length, 0);
});