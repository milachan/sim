import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  bacaFileGuru,
  cariKolom,
  validasiSemuaBaris,
  buatGuruDanAkunDalamTx,
  perbaruiGuruDanAkunDalamTx,
  prosesGuru,
  hitungRowGagalUnik,
  formatImportError,
  type RencanaGuru,
} from "./import-guru";

/** Bangun bytes .xlsx di memori — tidak menyentuh database sama sekali. */
async function xlsx(rows: (string | number)[][]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Data Guru");
  for (const r of rows) ws.addRow(r);
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}

const HEADER9 = ["NAMA", "KODE", "NIP", "WHATSAPP", "USERNAME", "PASSWORD AWAL", "PERAN AKUN", "AKUN AKTIF", "WAJIB GANTI PASSWORD"];
const HEADER4 = ["NAMA", "KODE", "NIP", "WHATSAPP"];

async function validasi(rows: (string | number)[][]) {
  const bytes = await xlsx(rows);
  const { header, rows: data } = await bacaFileGuru(bytes);
  const kol = cariKolom(header);
  return validasiSemuaBaris(data, kol);
}

function _planKosong(): RencanaGuru {
  return { baru: [], update: [], sama: 0, dilewati: 0, error: [], errorItems: [], akunBaruRencana: 0, akunSudahAda: 0, rowGagal: 0, rowBerhasil: 0, status: "success" };
}
void _planKosong;

// ── Parse & struktur ──

test("file kosong tanpa header → pesan jelas", async () => {
  const bytes = await xlsx([]);
  await assert.rejects(bacaFileGuru(bytes), /File kosong/);
});

test("file hanya berisi petunjuk (tanpa kolom NAMA/KODE) → pesan jelas", async () => {
  const bytes = await xlsx([["PETUNJUK IMPORT"], ["1. Isi data sesuai template."], ["2. Hapus baris ini."]]);
  await assert.rejects(bacaFileGuru(bytes), /petunjuk|template/i);
});

test("header tanpa baris data → pesan jelas", async () => {
  const bytes = await xlsx([HEADER4]);
  await assert.rejects(bacaFileGuru(bytes), /tidak memiliki baris data/);
});

// ── Validasi seluruh file ──

test("template lama 4 kolom tetap didukung dengan default yang benar", async () => {
  const { baris, error } = await validasi([
    HEADER4,
    ["Budi Santoso", "k5", "", ""],
  ]);
  assert.deepEqual(error, []);
  assert.equal(baris.length, 1);
  const b = baris[0];
  assert.equal(b.kode, "K5"); // dinormalisasi huruf besar
  assert.equal(b.peranAkun, "GURU"); // default
  assert.equal(b.akunAktif, true); // default YA
  assert.equal(b.wajibGanti, false); // default TIDAK
  assert.equal(b.usernameEksplisit, null); // dibuat otomatis dari KODE
  assert.equal(b.passwordAwal, null); // dibuat otomatis
});

test("template 9 kolom lengkap terbaca semua", async () => {
  const { baris, error } = await validasi([
    HEADER9,
    ["Akhmadi, S.Pd.", "K5", "198512312010011001", "081234567890", "Akhmadi.K5", "Rahasia123!", "WAKA", "TIDAK", "YA"],
  ]);
  assert.deepEqual(error, []);
  const b = baris[0];
  assert.equal(b.usernameEksplisit, "akhmadi.k5");
  assert.equal(b.passwordAwal, "Rahasia123!");
  assert.equal(b.peranAkun, "WAKA");
  assert.equal(b.akunAktif, false);
  assert.equal(b.wajibGanti, true);
});

test("NAMA atau KODE kosong ditolak", async () => {
  const { error, errorItems } = await validasi([HEADER4, ["", "K5"], ["Tanpa Kode", ""]]);
  assert.equal(error.length, 2);
  assert.match(error[0], /NAMA dan KODE wajib/);
  assert.equal(errorItems[0].barisKe, 2);
  assert.match(formatImportError(errorItems[0]), /^Baris 2 —/);
});

test("format KODE mengikuti aturan aplikasi (huruf + 1-3 angka)", async () => {
  const { error } = await validasi([HEADER4, ["Budi", "ABCDE"], ["Enny", "K12345"], ["Fina", "F2"]]);
  assert.equal(error.length, 2);
  assert.match(error[0], /format KODE tidak valid/);
  assert.match(error[1], /format KODE tidak valid/);
});

test("KODE ganda dalam satu file ditolak", async () => {
  const { error } = await validasi([
    HEADER4,
    ["Budi", "K5"],
    ["Budi Lagi", "K5"],
  ]);
  assert.equal(error.length, 1);
  assert.match(error[0], /dua kali dalam file|duplikat/i);
});

test("NIP ganda dalam satu file ditolak", async () => {
  const { error } = await validasi([
    HEADER4,
    ["Budi", "K5", "198500001234567890"],
    ["Enny", "E1", "198500001234567890"],
  ]);
  assert.equal(error.length, 1);
  assert.match(error[0], /NIP.*duplikat/);
});

test("PERAN AKUN hanya menerima GURU/WAKA/kosong", async () => {
  const { error } = await validasi([
    HEADER9,
    ["Budi", "K5", "", "", "", "", "ADMIN", "", ""],
  ]);
  assert.equal(error.length, 1);
  assert.match(error[0], /PERAN AKUN hanya menerima GURU atau WAKA/);
});

test("nilai YA/TIDAK tidak dikenal TIDAK diam-diam dianggap default", async () => {
  const { error } = await validasi([
    HEADER9,
    ["Budi", "K5", "", "", "", "", "", "YES", ""],
    ["Enny", "E1", "", "", "", "", "", "AKTIF", ""],
    ["Fina", "F2", "", "", "", "", "", "", "1"],
  ]);
  assert.equal(error.length, 3);
  assert.match(error[0], /AKUN AKTIF hanya menerima/);
  assert.match(error[1], /AKUN AKTIF hanya menerima/);
  assert.match(error[2], /WAJIB GANTI PASSWORD hanya menerima/);
});

test("PASSWORD AWAL eksplisit terlalu pendek ditolak; kosong boleh (otomatis)", async () => {
  const { baris, error } = await validasi([
    HEADER9,
    ["Pendek", "K5", "", "", "", "abc12", "", "", ""],
    ["Otomatis", "E1", "", "", "", "", "", "", ""],
  ]);
  assert.equal(error.length, 1);
  assert.match(error[0], /terlalu pendek/);
  assert.equal(baris.length, 1);
  assert.equal(baris[0].passwordAwal, null);
});

test("USERNAME eksplisit harus memenuhi format; kosong setelah sanitasi ditolak", async () => {
  const { error } = await validasi([
    HEADER9,
    ["Spasi", "K5", "", "", "budi santoso", "", "", "", ""],
    ["Mulai angka tanda", "E1", "", "", "-enny", "", "", "", ""],
    ["Terlalu pendek", "F2", "", "", "ab", "", "", "", ""],
    ["Valid", "G7", "", "", "g7.guru_x", "", "", "", ""],
  ]);
  assert.equal(error.length, 3);
  assert.match(error[0], /USERNAME.*tidak valid/);
  assert.equal((await validasi([HEADER9, ["Valid", "G7", "", "", "g7.guru_x", "", "", "", ""]])).error.length, 0);
});

test("No. WhatsApp mengikuti validasi Data Guru", async () => {
  const { error } = await validasi([
    HEADER4,
    ["Budi", "K5", "", "123"],
    ["Enny", "E1", "", "081234567890"],
  ]);
  assert.equal(error.length, 1);
  assert.match(error[0], /WhatsApp tidak valid/);
});

test("rowGagal dihitung dari baris unik bukan jumlah pesan", async () => {
  const { errorItems } = await validasi([HEADER4, ["", "K5"], ["", "E1"]]);
  assert.equal(hitungRowGagalUnik(errorItems), 2);
  const dupItems = [
    { barisKe: 3, pesan: "a" },
    { barisKe: 3, pesan: "b" },
  ];
  assert.equal(hitungRowGagalUnik(dupItems as never), 1);
});

test("format error baris mengandung nomor baris", async () => {
  const { errorItems } = await validasi([HEADER4, ["Budi", "KODE-SALAH"]]);
  assert.ok(errorItems[0].barisKe === 2);
  assert.match(errorItems[0].pesan, /KODE tidak valid/);
  assert.match(formatImportError(errorItems[0]), /^Baris 2 —/);
});

// ── Eksekutor transaksi (fake tx — tanpa DB utama) ──

type Panggilan = { model: string; aksi: string };

function fakeTx(opts?: { gagalSaatUserCreate?: boolean; userSudahAda?: string | null }) {
  const panggilan: Panggilan[] = [];
  let cariUsername = false;
  let cariGuruId = false;
  const tx = {
    guru: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      create: async (_args: unknown) => {
        panggilan.push({ model: "guru", aksi: "create" });
        return { id: "guru-baru-1" };
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      update: async (_args: unknown) => {
        panggilan.push({ model: "guru", aksi: "update" });
        return {};
      },
    },
    user: {
      findUnique: async (args: { where: { username?: string; guruId?: string } }) => {
        if (args.where.username !== undefined) cariUsername = true;
        if (args.where.guruId !== undefined) cariGuruId = true;
        return opts?.userSudahAda ? { id: opts.userSudahAda } : null;
      },
      create: async (args: { data: Record<string, unknown> }) => {
        panggilan.push({ model: "user", aksi: "create" });
        if (opts?.gagalSaatUserCreate) throw new Error("simulasi gagal membuat akun (mis. username bentrok)");
        (tx as { _dataTerakhir?: Record<string, unknown> })._dataTerakhir = args.data;
        return { id: "user-baru-1" };
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      update: async (_args: unknown) => {
        panggilan.push({ model: "user", aksi: "update" });
        return {};
      },
    },
  };
  return {
    tx: tx as unknown as Parameters<typeof buatGuruDanAkunDalamTx>[0],
    panggilan,
    status: () => ({ cariUsername, cariGuruId }),
  };
}

const BARIS_VALID = {
  barisKe: 2,
  label: "Budi Santoso (K5)",
  nama: "Budi Santoso",
  kode: "K5",
  nip: "",
  telepon: "",
  usernameEksplisit: null,
  passwordAwal: null,
  peranAkun: "GURU" as const,
  akunAktif: true,
  wajibGanti: false,
};

test("eksekusi baris baru memakai SATU client tx untuk Guru dan User", async () => {
  const f = fakeTx();
  const kred = await buatGuruDanAkunDalamTx(f.tx, BARIS_VALID);
  assert.ok(f.panggilan.some((p) => p.model === "guru" && p.aksi === "create"));
  assert.ok(f.panggilan.some((p) => p.model === "user" && p.aksi === "create"));
  assert.equal(f.status().cariUsername, true);
  assert.equal(f.status().cariGuruId, true);
  assert.ok(kred && kred.username);
});

test("kegagalan pembuatan akun melempar error sehingga transaksi baris rollback", async () => {
  const f = fakeTx({ gagalSaatUserCreate: true });
  await assert.rejects(() => buatGuruDanAkunDalamTx(f.tx, BARIS_VALID), /gagal membuat akun/);
  assert.ok(f.panggilan.some((p) => p.model === "guru" && p.aksi === "create"));
});

test("update guru lama + provisioning akun dalam tx yang sama; akun lama tidak direset", async () => {
  const f = fakeTx();
  const ada = {
    id: "guru-lama-1",
    nama: "Nama Lama",
    kode: "K5",
    nip: null,
    telepon: null,
    status: true,
    deletedAt: new Date(),
    user: null,
  };
  const kred = await perbaruiGuruDanAkunDalamTx(f.tx, ada, BARIS_VALID);
  assert.ok(f.panggilan.some((p) => p.model === "guru" && p.aksi === "update"));
  assert.ok(f.panggilan.some((p) => p.model === "user" && p.aksi === "create"));
  assert.ok(kred);
});

test("akun lama tetap aman saat import ulang: tidak ada user.create/update password", async () => {
  const f = fakeTx();
  const ada = {
    id: "guru-lama-1",
    nama: "Budi Santoso",
    kode: "K5",
    nip: null,
    telepon: null,
    status: true,
    deletedAt: null,
    user: { id: "user-lama-1", username: "k5", role: "GURU", aktif: true },
  };
  const kred = await perbaruiGuruDanAkunDalamTx(f.tx, ada, BARIS_VALID);
  assert.equal(kred, null);
  assert.ok(!f.panggilan.some((p) => p.model === "user" && p.aksi === "create"));
  assert.ok(!f.panggilan.some((p) => p.model === "user" && p.aksi === "update"));
});

// ── Tabrakan kode: kode dipakai ulang untuk orang yang berbeda ──

function fakeGuruDb(gurus: unknown[]) {
  return {
    guru: { findMany: async () => gurus as never },
    $transaction: async <T>(fn: (tx: never) => Promise<T>) => fn({} as never),
  } as never;
}

const GURU_SITI = {
  id: "g-siti",
  nama: "Siti Aminah, S.Pd.",
  kode: "K5",
  nip: "198512312010011001",
  telepon: "081111111111",
  status: true,
  deletedAt: null,
  user: { id: "u-siti", username: "siti", role: "GURU", aktif: true },
};

test("Import Guru: KODE dipakai ulang untuk nama BEDA TOTAL → error, tidak menimpa data lama", async () => {
  const bytes = await xlsx([HEADER4, ["Budi Santoso", "K5", "199001012010011002", "081222222222"]]);
  const plan = await prosesGuru(bytes, "preview", { prismaClient: fakeGuruDb([GURU_SITI]) });
  assert.equal(plan.errorItems.length, 1);
  assert.match(plan.error[0], /KODE K5 sudah dipakai/);
  assert.equal(plan.baru.length, 0);
  assert.equal(plan.update.length, 0);
  assert.equal(plan.rowBerhasil, 0);
  assert.equal(plan.rowGagal, 1);
});

test("Import Guru: perbaikan nama sebatas format (tambah gelar) tetap diizinkan sebagai update", async () => {
  const bytes = await xlsx([HEADER4, ["Budi Santoso, S.Pd.", "K5", "", ""]]);
  const plan = await prosesGuru(bytes, "preview", {
    prismaClient: fakeGuruDb([{ ...GURU_SITI, nama: "Budi Santoso" }]),
  });
  assert.equal(plan.errorItems.length, 0);
  assert.equal(plan.update.length, 1);
  assert.equal(plan.rowBerhasil, 1);
  assert.equal(plan.sama, 0);
});

test("Import Guru: update hanya penulisan nama (format) ditandai hanyaFormat=true", async () => {
  const bytes = await xlsx([HEADER4, ["Budi Santoso, S.Pd.", "K5", "", ""]]);
  const plan = await prosesGuru(bytes, "preview", {
    prismaClient: fakeGuruDb([{ ...GURU_SITI, nama: "Budi Santoso", nip: null, telepon: null }]),
  });
  assert.equal(plan.update.length, 1);
  assert.equal(plan.update[0].hanyaFormat, true);
  assert.equal(plan.update[0].dipulihkan, false);
});

test("Import Guru: NIP/WA benar-benar berubah → hanyaFormat=false", async () => {
  const bytes = await xlsx([HEADER4, ["Budi Santoso, S.Pd.", "K5", "198512312010011001", "081234567890"]]);
  const plan = await prosesGuru(bytes, "preview", {
    prismaClient: fakeGuruDb([{ ...GURU_SITI, nama: "Budi Santoso, S.Pd.", nip: null, telepon: null }]),
  });
  assert.equal(plan.update.length, 1);
  assert.equal(plan.update[0].hanyaFormat, false);
  assert.equal(plan.update[0].nipLama, "-");
  assert.equal(plan.update[0].nipBaru, "198512312010011001");
});
