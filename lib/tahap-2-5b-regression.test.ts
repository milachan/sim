import { test, describe } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  buatGuruDanAkunDalamTx,
  perbaruiGuruDanAkunDalamTx,
  prosesGuru,
  bangunPayloadImport,
  sanitasiPesanImportError,
  hitungRowGagalUnik,
  hitungStatusImport,
  ImportSafeError,
  fileGuruDidukung,
} from "./import-guru";
import { validasiInputUser, ROLE_ALLOWLIST } from "./user-validasi";
import { keputusanHapusSuperadmin, keputusanUbahSuperadmin, validasiPasswordAkun } from "./superadmin-guard";
import { ambilKredensial, simpanKredensial, type BarisKredensial, type EntriKredensial } from "./kredensial-store";

async function xlsx(rows: (string | number)[][]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Data Guru");
  for (const r of rows) ws.addRow(r);
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}
const HEADER9 = ["NAMA", "KODE", "NIP", "WHATSAPP", "USERNAME", "PASSWORD AWAL", "PERAN AKUN", "AKUN AKTIF", "WAJIB GANTI PASSWORD"];

function fakeTx(opts?: { gagalSaatUserCreate?: boolean }) {
  const panggilan: { model: string; aksi: string }[] = [];
  const tx = {
    guru: {
      create: async () => {
        panggilan.push({ model: "guru", aksi: "create" });
        return { id: "guru-baru-1" };
      },
      update: async () => {
        panggilan.push({ model: "guru", aksi: "update" });
        return {};
      },
    },
    user: {
      findUnique: async () => null,
      create: async () => {
        panggilan.push({ model: "user", aksi: "create" });
        if (opts?.gagalSaatUserCreate) throw new Error("simulasi gagal membuat akun");
        return { id: "user-baru-1" };
      },
      update: async () => {
        panggilan.push({ model: "user", aksi: "update" });
        return {};
      },
    },
  };
  return { tx: tx as unknown as Parameters<typeof buatGuruDanAkunDalamTx>[0], panggilan };
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

function fakePrismaEmpty() {
  return {
    guru: {
      findMany: async () => [] as never[],
    },
    user: {
      findUnique: async () => null as never,
      count: async () => 0 as never,
    },
    $transaction: async <T>(fn: (tx: never) => Promise<T>) => fn({} as never),
  } as never;
}

describe("kontrak preview via prosesGuru + bangunPayloadImport (fungsi produksi)", () => {
  test("preview valid: ok true, siapEksekusi true, rowGagal 0, rowBerhasil sesuai", async () => {
    const bytes = await xlsx([HEADER9, ["Budi Santoso", "K5", "", "081234567890", "", "", "GURU", "YA", "TIDAK"]]);
    const plan = await prosesGuru(bytes, "preview", { prismaClient: fakePrismaEmpty() });
    const payload = bangunPayloadImport(plan, true);
    assert.equal(payload.ok, true);
    assert.equal(payload.siapEksekusi, true);
    assert.equal(payload.rowGagal, 0);
    assert.equal(payload.rowBerhasil, 1);
    assert.equal(typeof payload.rowGagal, "number");
    assert.equal(typeof payload.rowBerhasil, "number");
  });

  test("preview invalid: ok true, siapEksekusi false, rowGagal unik persis, nomor baris ada pada error", async () => {
    const bytes = await xlsx([HEADER9, ["", "K5"], ["Budi", "KODE-SALAH"]]);
    const plan = await prosesGuru(bytes, "preview", { prismaClient: fakePrismaEmpty() });
    const payload = bangunPayloadImport(plan, true);
    assert.equal(payload.ok, true);
    assert.equal(payload.siapEksekusi, false);
    // Dua baris Excel berbeda (2 dan 3) → tepat 2 baris gagal unik.
    assert.equal(payload.rowGagal, 2);
    assert.equal(payload.rowBerhasil, 0);
    for (const it of plan.errorItems) {
      assert.ok(it.barisKe !== null);
      assert.ok(typeof it.barisKe === "number");
    }
    for (const s of plan.error) assert.match(s, /^Baris \d+ —/);
  });

  test("satu baris dengan beberapa masalah dihitung SATU baris gagal (via fungsi produksi)", async () => {
    // Baris dengan KODE salah + PERAN salah tetap hanya menghasilkan pesan
    // pertama per baris; hitungRowGagalUnik juga membuktikan dedup per nomor.
    const items = [
      { barisKe: 3, pesan: "a" },
      { barisKe: 3, pesan: "b" },
      { barisKe: 4, pesan: "c" },
    ];
    assert.equal(hitungRowGagalUnik(items), 2);

    // Uji file nyata: dua masalah pada baris yang sama → satu entri error.
    const bytes = await xlsx([HEADER9, ["Budi", "KODE-SALAH", "", "", "", "", "ADMIN", "YES", ""]]);
    const plan = await prosesGuru(bytes, "preview", { prismaClient: fakePrismaEmpty() });
    const barisUnik = new Set(plan.errorItems.filter((e) => e.barisKe != null).map((e) => e.barisKe));
    assert.equal(barisUnik.size, 1);
    assert.equal(plan.rowGagal, 1);
    assert.equal(payloadSiapEksekusi(plan), false);
  });

  test("error global (workbook tanpa kolom) membuat siapEksekusi false dan TIDAK dihitung sebagai baris gagal", async () => {
    const bytes = await xlsx([["PETUNJUK"], ["Isi data di sini."]]);
    await assert.rejects(() => prosesGuru(bytes, "preview", { prismaClient: fakePrismaEmpty() }), ImportSafeError);
  });
});

describe("exec transaksi via prosesGuru dengan fake prisma/txRunner", () => {
  test("transaksi sukses masuk ke daftar hasil aktual", async () => {
    const bytes = await xlsx([HEADER9, ["Budi Santoso", "K5"]]);
    const fakePrisma = {
      guru: { findMany: async () => [] as never[] },
      $transaction: async <T>(fn: (tx: never) => Promise<T>) => fn(fakeTx().tx as never),
    } as never;
    const plan = await prosesGuru(bytes, "exec", { prismaClient: fakePrisma });
    assert.equal(plan.rowBerhasil, 1);
    assert.equal(plan.rowGagal, 0);
    assert.equal(plan.status, "success");
    assert.equal(plan.baru.length, 1);
    assert.equal(plan.akunBaru?.length, 1);
  });

  test("transaksi gagal tidak masuk ke baru/update/sama", async () => {
    const bytes = await xlsx([HEADER9, ["Budi Santoso", "K5"]]);
    const fakePrisma = {
      guru: { findMany: async () => [] as never[] },
      $transaction: async () => {
        throw new Error("Unique constraint failed on the fields: (`username`)");
      },
    } as never;
    const plan = await prosesGuru(bytes, "exec", { prismaClient: fakePrisma });
    assert.equal(plan.rowGagal, 1);
    assert.equal(plan.rowBerhasil, 0);
    assert.equal(plan.baru.length, 0);
    assert.equal(plan.update.length, 0);
    assert.equal(plan.sama, 0);
    assert.equal(plan.status, "failed");
    assert.ok(plan.error[0].startsWith("Baris 2 —"));
  });

  test("commit gagal setelah callback selesai: runner reject → tanpa hasil sukses & tanpa kredensial palsu", async () => {
    const f = fakeTx();
    let call = 0;
    const runner = async <T>(fn: (tx: never) => Promise<T>): Promise<T> => {
      call++;
      const res = await fn(f.tx as never);
      if (call === 1) throw new Error("commit failed after callback");
      return res;
    };
    const bytes = await xlsx([HEADER9, ["Budi Santoso", "K5"]]);
    const fakePrisma = { guru: { findMany: async () => [] as never[] } } as never;
    const plan = await prosesGuru(bytes, "exec", { prismaClient: fakePrisma, txRunner: runner });
    assert.equal(plan.rowGagal, 1);
    assert.equal(plan.rowBerhasil, 0);
    assert.equal(plan.baru.length, 0);
    assert.equal(plan.update.length, 0);
    assert.equal(plan.sama, 0);
    assert.equal(plan.akunBaru?.length ?? 0, 0);
    assert.equal(plan.status, "failed");
  });

  test("hasil parsial mempunyai penghitung dan status yang benar", async () => {
    const bytes = await xlsx([
      HEADER9,
      ["Budi Santoso", "K5"],
      ["Siti Aminah", "K6"],
    ]);
    let call = 0;
    const fakePrisma = {
      guru: { findMany: async () => [] as never[] },
      $transaction: async <T>(fn: (tx: never) => Promise<T>): Promise<T> => {
        call++;
        if (call === 1) return fn(fakeTx().tx as never);
        throw new Error("Unique constraint failed");
      },
    } as never;
    const plan = await prosesGuru(bytes, "exec", { prismaClient: fakePrisma });
    assert.equal(plan.rowBerhasil, 1);
    assert.equal(plan.rowGagal, 1);
    assert.equal(plan.status, "partial");
    assert.equal(plan.baru.length, 1);
    // Baris gagal tersedia dalam daftar error beserta nomor barisnya.
    assert.equal(plan.errorItems[0].barisKe, 3);
  });

  test("pesan Prisma/internal tidak muncul dalam payload client (disanitasi)", async () => {
    const bytes = await xlsx([HEADER9, ["Budi Santoso", "K5"]]);
    const fakePrisma = {
      guru: { findMany: async () => [] as never[] },
      $transaction: async () => {
        throw new Error("Invalid `prisma.user.create()` invocation: Unique constraint failed on the fields: (`username`) at table User");
      },
    } as never;
    const plan = await prosesGuru(bytes, "exec", { prismaClient: fakePrisma });
    const payload = bangunPayloadImport(plan, false);
    const semuaPesan = [...(payload.error as string[])].join("\n").toLowerCase();
    for (const terlarang of ["prisma", "invocation", "constraint", "table", "database url"]) {
      assert.ok(!semuaPesan.includes(terlarang), `payload membocorkan "${terlarang}"`);
    }
    assert.match(String((payload.error as string[])[0]), /gagal disimpan/);
  });

  test("kredensial parsial hanya memuat akun yang berhasil commit", async () => {
    const bytes = await xlsx([
      HEADER9,
      ["Budi Santoso", "K5"],
      ["Siti Aminah", "K6"],
    ]);
    let call = 0;
    const fakePrisma = {
      guru: { findMany: async () => [] as never[] },
      $transaction: async <T>(fn: (tx: never) => Promise<T>): Promise<T> => {
        call++;
        if (call === 1) return fn(fakeTx().tx as never);
        throw new Error("fail");
      },
    } as never;
    const plan = await prosesGuru(bytes, "exec", { prismaClient: fakePrisma });
    assert.equal(plan.akunBaru?.length, 1);
    assert.equal(plan.akunBaru?.[0].kode, "K5");
    assert.equal(plan.baru.length, 1);
    assert.equal(plan.status, "partial");
  });

  test("sanitasiPesanImportError: konflik dikenali ramah, error tak dikenal generik, tanpa detail internal", () => {
    const s = sanitasiPesanImportError(new Error("Unique constraint failed on the fields: (`username`)"), "Budi (K5)");
    assert.match(s, /gagal disimpan/);
    assert.match(s, /username sudah digunakan/);
    assert.ok(!s.toLowerCase().includes("prisma"));
    const generik = sanitasiPesanImportError(new Error("Connection pool timeout at db-host.internal:3306"), "Enny (E1)");
    assert.match(generik, /konflik data atau gangguan database/);
    assert.ok(!generik.includes("db-host.internal"));
    assert.ok(!generik.includes("3306"));
  });

  test("hitungStatusImport adalah fungsi produksi status eksekusi", () => {
    assert.equal(hitungStatusImport(2, 0), "success");
    assert.equal(hitungStatusImport(1, 1), "partial");
    assert.equal(hitungStatusImport(0, 2), "failed");
  });

  test("eksekutor sukses mengembalikan kredensial; gagal melempar (fungsi produksi)", async () => {
    const f1 = fakeTx();
    const kred1 = await buatGuruDanAkunDalamTx(f1.tx, BARIS_VALID);
    assert.ok(kred1 && kred1.username);
    const f2 = fakeTx({ gagalSaatUserCreate: true });
    await assert.rejects(() => buatGuruDanAkunDalamTx(f2.tx, BARIS_VALID), /gagal membuat akun/);
  });

  test("perbaruiGuru lama tanpa akun mengembalikan kredensial; dengan akun tidak", async () => {
    const f = fakeTx();
    const adaBaru = { id: "g1", nama: "Lama", kode: "K5", nip: null, telepon: null, status: true, deletedAt: null, user: null };
    const k1 = await perbaruiGuruDanAkunDalamTx(f.tx, adaBaru as never, BARIS_VALID);
    assert.ok(k1);
    const adaLama = { id: "g1", nama: "Budi Santoso", kode: "K5", nip: null, telepon: null, status: true, deletedAt: null, user: { id: "u1", username: "k5", role: "GURU", aktif: true } };
    const k2 = await perbaruiGuruDanAkunDalamTx(f.tx, adaLama as never, BARIS_VALID);
    assert.equal(k2, null);
  });
});

/** Helper test memakai fungsi produksi — bukan logika tiruan. */
function payloadSiapEksekusi(plan: Parameters<typeof bangunPayloadImport>[0]): boolean {
  return bangunPayloadImport(plan, true).siapEksekusi === true;
}

describe("kepemilikan token kredensial (fungsi produksi)", () => {
  function dataDummy(): BarisKredensial[] {
    return [{ nama: "Budi", kode: "K5", username: "k5", password: "pass123", peran: "GURU", wajib: "TIDAK" }];
  }
  test("Admin B tidak dapat memakai atau menghanguskan token milik Admin A", () => {
    const store = new Map<string, EntriKredensial>();
    const token = simpanKredensial(store, "admin-A", dataDummy(), { now: 1000 });
    const r = ambilKredensial(store, token, "admin-B", 2000);
    assert.equal(r.ok, false);
    assert.equal(store.has(token), true);
    const r2 = ambilKredensial(store, token, "admin-A", 2000);
    assert.equal(r2.ok, true);
  });
  test("token tetap sekali pakai bagi pemilik yang benar", () => {
    const store = new Map<string, EntriKredensial>();
    const token = simpanKredensial(store, "admin-A", dataDummy(), { now: 1000 });
    assert.equal(ambilKredensial(store, token, "admin-A", 2000).ok, true);
    assert.equal(ambilKredensial(store, token, "admin-A", 2000).ok, false);
  });
  test("token kedaluwarsa tidak dapat digunakan dan terhapus", () => {
    const store = new Map<string, EntriKredensial>();
    const token = simpanKredensial(store, "admin-A", dataDummy(), { now: 1000, ttlMs: 500 });
    const r = ambilKredensial(store, token, "admin-A", 5000);
    assert.equal(r.ok, false);
    assert.equal(store.has(token), false);
  });
  test("respons kegagalan tidak membocorkan data", () => {
    const store = new Map<string, EntriKredensial>();
    simpanKredensial(store, "admin-A", dataDummy(), { now: 1000 });
    const r = ambilKredensial(store, "token-ngawur", "admin-A", 2000) as { ok: boolean; data?: unknown };
    assert.equal(r.ok, false);
    assert.equal((r as { data?: unknown }).data, undefined);
  });
});

describe("perlindungan SUPERADMIN via fungsi produksi superadmin-guard", () => {
  test("SUPERADMIN aktif terakhir tidak dapat dinonaktifkan", () => {
    const k = keputusanUbahSuperadmin({ role: "SUPERADMIN", aktif: true }, { role: "SUPERADMIN", aktif: false }, 1);
    assert.equal(k.boleh, false);
  });
  test("SUPERADMIN aktif terakhir tidak dapat diturunkan role-nya", () => {
    const k = keputusanUbahSuperadmin({ role: "SUPERADMIN", aktif: true }, { role: "ADMIN", aktif: true }, 1);
    assert.equal(k.boleh, false);
  });
  test("SUPERADMIN aktif terakhir tidak dapat dihapus", () => {
    const k = keputusanHapusSuperadmin({ role: "SUPERADMIN", aktif: true }, 1);
    assert.equal(k.boleh, false);
  });
  test("perubahan diperbolehkan jika ada SUPERADMIN aktif lain", () => {
    assert.equal(keputusanUbahSuperadmin({ role: "SUPERADMIN", aktif: true }, { role: "ADMIN", aktif: true }, 2).boleh, true);
    assert.equal(keputusanHapusSuperadmin({ role: "SUPERADMIN", aktif: true }, 2).boleh, true);
  });
  test("penghapusan akun SUPERADMIN nonaktif tidak salah dianggap menghapus SUPERADMIN aktif terakhir", () => {
    assert.equal(keputusanHapusSuperadmin({ role: "SUPERADMIN", aktif: false }, 1).boleh, true);
  });
  test("akun non-SUPERADMIN tetap dapat diubah sesuai kewenangan", () => {
    assert.equal(keputusanUbahSuperadmin({ role: "ADMIN", aktif: true }, { role: "ADMIN", aktif: false }, 1).boleh, true);
    assert.equal(keputusanHapusSuperadmin({ role: "ADMIN", aktif: true }, 1).boleh, true);
  });
});

describe("validasi password via fungsi produksi validasiPasswordAkun", () => {
  test("password edit kosong tidak mengubah password lama", () => {
    assert.equal(validasiPasswordAkun("", false).ok, true);
    assert.equal(validasiPasswordAkun(undefined, false).ok, true);
  });
  test("password edit terlalu pendek ditolak", () => {
    assert.equal(validasiPasswordAkun("abc", false).ok, false);
    assert.equal(validasiPasswordAkun("abcdef", false).ok, true);
  });
  test("password create wajib minimal 6", () => {
    assert.equal(validasiPasswordAkun("", true).ok, false);
    assert.equal(validasiPasswordAkun("abcdef", true).ok, true);
  });
});

describe("validasi role via fungsi produksi validasiInputUser (normalisasi)", () => {
  test("ADMIN diterima dan role tervalidasi adalah ADMIN", () => {
    const v = validasiInputUser({ username: "u", nama: "A", role: "ADMIN" });
    assert.equal(v.ok, true);
    if (v.ok) assert.equal(v.role, "ADMIN");
  });
  test("input dengan spasi luar dinormalisasi (trim) dan diterima konsisten", () => {
    const v = validasiInputUser({ username: "u", nama: "A", role: " ADMIN " });
    assert.equal(v.ok, true);
    if (v.ok) assert.equal(v.role, "ADMIN");
  });
  test("ROOT, OWNER, SUPERUSER ditolak", () => {
    for (const role of ["ROOT", "OWNER", "SUPERUSER"]) {
      const v = validasiInputUser({ username: "u", nama: "A", role });
      assert.equal(v.ok, false, role);
    }
  });
  test("nilai yang disimpan harus role tervalidasi bukan input mentah", () => {
    const v = validasiInputUser({ username: "u", nama: "A", role: " ADMIN " });
    assert.equal(v.ok, true);
    if (v.ok) {
      assert.equal(v.role, "ADMIN");
      assert.notEqual(v.role, " ADMIN ");
    }
  });
  test("ROLE_ALLOWLIST berisi 5 role yang diizinkan", () => {
    assert.equal(ROLE_ALLOWLIST.size, 5);
    for (const r of ["GURU", "WAKA", "ADMIN", "SUPERADMIN", "KEPALA"]) assert.ok(ROLE_ALLOWLIST.has(r), r);
  });
  test("GURU/WAKA wajib guruId; KEPALA tidak wajib guruId", () => {
    assert.equal(validasiInputUser({ username: "u", nama: "A", role: "GURU" }).ok, false);
    assert.equal(validasiInputUser({ username: "u", nama: "A", role: "KEPALA" }).ok, true);
  });
});

describe("TAHAP 2.5B-F1 — preview campuran: hitungan rowBerhasil/rowGagal tidak double-count (fungsi produksi)", () => {
  test("A. satu valid + satu format invalid: rowBerhasil 1, rowGagal 1, status partial, siapEksekusi false, baru hanya valid", async () => {
    const bytes = await xlsx([
      HEADER9,
      ["Budi Santoso", "K5", "", "081234567890", "", "", "GURU", "YA", "TIDAK"],
      ["", "K6"],
    ]);
    const plan = await prosesGuru(bytes, "preview", { prismaClient: fakePrismaEmpty() });
    const payload = bangunPayloadImport(plan, true);
    assert.equal(plan.rowBerhasil, 1);
    assert.equal(payload.rowBerhasil, 1);
    assert.equal(plan.rowGagal, 1);
    assert.equal(payload.rowGagal, 1);
    assert.equal(plan.status, "partial");
    assert.equal(payload.status, "partial");
    assert.equal(payload.siapEksekusi, false);
    assert.equal(plan.baru.length, 1);
    assert.equal(plan.baru[0].kode, "K5");
    // baris invalid tidak masuk rencana sukses
    assert.equal(plan.update.length, 0);
    assert.equal(plan.sama, 0);
    // rowBerhasil dihitung dari baris tervalidasi yang tidak ada di Set error, bukan baris.length - rowGagal
    const gagalSet = new Set(plan.errorItems.filter((e) => e.barisKe != null).map((e) => e.barisKe as number));
    assert.ok(gagalSet.has(3));
    assert.ok(!gagalSet.has(2));
  });

  test("B. dua valid + satu invalid: rowBerhasil 2, rowGagal 1, status partial", async () => {
    const bytes = await xlsx([
      HEADER9,
      ["Budi Santoso", "K5"],
      ["Siti Aminah", "K6"],
      ["", "K7"],
    ]);
    const plan = await prosesGuru(bytes, "preview", { prismaClient: fakePrismaEmpty() });
    const payload = bangunPayloadImport(plan, true);
    assert.equal(plan.rowBerhasil, 2);
    assert.equal(payload.rowBerhasil, 2);
    assert.equal(plan.rowGagal, 1);
    assert.equal(payload.rowGagal, 1);
    assert.equal(plan.status, "partial");
    assert.equal(payload.status, "partial");
    assert.equal(payload.siapEksekusi, false);
    assert.equal(plan.baru.length, 2);
  });

  test("C. semua valid: penghitung tetap benar, status success", async () => {
    const bytes = await xlsx([
      HEADER9,
      ["Budi Santoso", "K5"],
      ["Siti Aminah", "K6"],
    ]);
    const plan = await prosesGuru(bytes, "preview", { prismaClient: fakePrismaEmpty() });
    const payload = bangunPayloadImport(plan, true);
    assert.equal(plan.rowBerhasil, 2);
    assert.equal(payload.rowBerhasil, 2);
    assert.equal(plan.rowGagal, 0);
    assert.equal(payload.rowGagal, 0);
    assert.equal(plan.status, "success");
    assert.equal(payload.status, "success");
    assert.equal(payload.siapEksekusi, true);
    assert.equal(plan.baru.length, 2);
  });

  test("D. semua invalid: rowBerhasil 0, status failed", async () => {
    const bytes = await xlsx([
      HEADER9,
      ["", "K5"],
      ["Budi", "KODE-SALAH"],
    ]);
    const plan = await prosesGuru(bytes, "preview", { prismaClient: fakePrismaEmpty() });
    const payload = bangunPayloadImport(plan, true);
    assert.equal(plan.rowBerhasil, 0);
    assert.equal(payload.rowBerhasil, 0);
    assert.equal(plan.rowGagal, 2);
    assert.equal(payload.rowGagal, 2);
    assert.equal(plan.status, "failed");
    assert.equal(payload.status, "failed");
    assert.equal(payload.siapEksekusi, false);
    assert.equal(plan.baru.length, 0);
    assert.equal(plan.update.length, 0);
    assert.equal(plan.sama, 0);
  });

  test("E. satu baris lolos validasi format tapi konflik NIP di database: dihitung gagal, tidak masuk rencana sukses", async () => {
    const bytes = await xlsx([HEADER9, ["Budi Santoso", "K5", "1234567890"]]);
    const fakePrismaKonflik = {
      guru: {
        findMany: async () => [
          { id: "guru-lain", nama: "Guru Lain", kode: "K99", nip: "1234567890", telepon: null, status: true, deletedAt: null, user: null },
        ],
      },
      $transaction: async <T>(fn: (tx: never) => Promise<T>) => fn({} as never),
    } as never;
    const plan = await prosesGuru(bytes, "preview", { prismaClient: fakePrismaKonflik });
    const payload = bangunPayloadImport(plan, true);
    assert.equal(plan.rowGagal, 1);
    assert.equal(payload.rowGagal, 1);
    assert.equal(plan.rowBerhasil, 0);
    assert.equal(payload.rowBerhasil, 0);
    assert.equal(plan.status, "failed");
    assert.equal(payload.status, "failed");
    assert.equal(payload.siapEksekusi, false);
    // tidak masuk daftar rencana sukses
    assert.equal(plan.baru.length, 0);
    assert.equal(plan.update.length, 0);
    assert.equal(plan.sama, 0);
    // errorItems mengandung barisKe 2 dengan pesan NIP dipakai guru lain
    assert.ok(plan.errorItems.some((e) => e.barisKe === 2 && e.pesan.toLowerCase().includes("nip")));
  });
});

describe("format file impor via kontrak route (fungsi produksi)", () => {
  test("hanya .xlsx yang diterima", () => {
    assert.equal(fileGuruDidukung("data.xlsx"), true);
    assert.equal(fileGuruDidukung("DATA.XLSX"), true);
    assert.equal(fileGuruDidukung("data.xls"), false);
    assert.equal(fileGuruDidukung("data.csv"), false);
    assert.equal(fileGuruDidukung("data.xlsx.exe"), false);
  });
});

describe("TAHAP 3B.5-A — tingkatDariNamaKelas tanpa prefix collision (fungsi produksi)", () => {
  // Mengimpor fungsi produksi langsung — bukan replika logika.
  const { tingkatDariNamaKelas } = (() => {
    // dynamic require agar tetap kompatibel dengan tsx --test (ESM)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./constants");
  })() as { tingkatDariNamaKelas: (s: string) => number | null };
  test("VII A → 7, VIII A → 8, IX A → 9, X A → 10", () => {
    assert.equal(tingkatDariNamaKelas("VII A"), 7);
    assert.equal(tingkatDariNamaKelas("VIII A"), 8);
    assert.equal(tingkatDariNamaKelas("IX A"), 9);
    assert.equal(tingkatDariNamaKelas("X A"), 10);
  });
  test("XI IPA → 11, XII IPA → 12 (tidak tertangkap sebagai X=10)", () => {
    assert.equal(tingkatDariNamaKelas("XI IPA"), 11);
    assert.equal(tingkatDariNamaKelas("XII IPA"), 12);
  });
  test("7A → 7, 8B → 8, 9C → 9", () => {
    assert.equal(tingkatDariNamaKelas("7A"), 7);
    assert.equal(tingkatDariNamaKelas("8B"), 8);
    assert.equal(tingkatDariNamaKelas("9C"), 9);
  });
  test("input tidak dikenal → null", () => {
    assert.equal(tingkatDariNamaKelas("ABC"), null);
    assert.equal(tingkatDariNamaKelas(""), null);
    assert.equal(tingkatDariNamaKelas("KELAS X"), null);
  });
  test("VII tidak menelan VIII (regression prefix collision)", () => {
    assert.equal(tingkatDariNamaKelas("VIII G"), 8);
    assert.notEqual(tingkatDariNamaKelas("VIII G"), 7);
    assert.equal(tingkatDariNamaKelas("VIII C"), 8);
  });
  test("X tidak menelan XI/XII", () => {
    assert.notEqual(tingkatDariNamaKelas("XI A"), 10);
    assert.notEqual(tingkatDariNamaKelas("XII A"), 10);
  });
});
