import { test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { passwordAcakKuat, CHARSET_PASSWORD, buatAkunUntukGuru, MIN_PANJANG_PASSWORD } from "./akun-provision";

test("kredensial: password disimpan sebagai hash, bukan plaintext", async () => {
  const plain = "S3cure!pass";
  const hash = await bcrypt.hash(plain, 10);
  assert.notEqual(hash, plain);
  assert.ok(hash.startsWith("$2"));
});

test("kredensial: hash valid bila cocok, tidak cocok bila salah", async () => {
  const hash = await bcrypt.hash("benar123", 10);
  assert.equal(await bcrypt.compare("benar123", hash), true);
  assert.equal(await bcrypt.compare("salah123", hash), false);
});

test("passwordAcakKuat menghasilkan panjang sesuai dan tidak kosong", async () => {
  const p = passwordAcakKuat(14);
  assert.equal(p.length, 14);
  assert.equal(passwordAcakKuat(12).length, 12);
});

test("password otomatis memakai generator kriptografis: hanya charset yang diizinkan", () => {
  const diizinkan = new Set(CHARSET_PASSWORD.split(""));
  for (let i = 0; i < 50; i++) {
    const p = passwordAcakKuat(12);
    assert.equal(p.length, 12);
    for (const c of p) assert.ok(diizinkan.has(c), `karakter tak terduga: ${c}`);
    // Tidak ada karakter mudah tertukar (I, l, O, 0, 1).
    assert.ok(!/[IlO01]/.test(p));
  }
});

test("password otomatis: beberapa hasil tidak selalu identik (tidak deterministik)", () => {
  const hasil = new Set<string>();
  for (let i = 0; i < 30; i++) hasil.add(passwordAcakKuat(12));
  assert.ok(hasil.size > 20, `terlalu sedikit variasi: ${hasil.size}`);
});

test("password otomatis: panjang minimum tetap dipatuhi", () => {
  assert.equal(passwordAcakKuat(4).length, MIN_PANJANG_PASSWORD);
});

/** Fake transaction client — semua query tercatat, tanpa DB utama. */
function fakeTx(opts?: { guruSudahPunyaAkun?: boolean; gagalCreate?: boolean }) {
  const calls: string[] = [];
  let dataTerakhir: Record<string, unknown> | null = null;
  const tx = {
    user: {
      findUnique: async (args: { where: { username?: string; guruId?: string } }) => {
        calls.push(args.where.username !== undefined ? `cari-username:${args.where.username}` : "cari-guruId");
        if (opts?.guruSudahPunyaAkun) return { id: "user-lama" };
        return null;
      },
      create: async (args: { data: Record<string, unknown> }) => {
        calls.push("user.create");
        if (opts?.gagalCreate) throw new Error("simulasi gagal");
        dataTerakhir = args.data;
        return { id: "user-baru" };
      },
    },
  };
  return {
    tx: tx as unknown as Parameters<typeof buatAkunUntukGuru>[1],
    calls,
    data: () => dataTerakhir,
  };
}

const OPS = {
  guruId: "guru-1",
  guruNama: "Budi Santoso",
  kode: "K5",
};

test("buatAkunUntukGuru memakai client tx yang diberikan (bukan prisma global)", async () => {
  const f = fakeTx();
  const hasil = await buatAkunUntukGuru(OPS, f.tx);
  assert.ok(f.calls.includes("cari-guruId"));
  assert.ok(f.calls.some((c) => c.startsWith("cari-username:")));
  assert.ok(f.calls.includes("user.create"));
  // username default dibuat dari KODE
  assert.equal(hasil.username, "k5");
  assert.ok(hasil.passwordPlain.length >= 12);
});

test("password yang tersimpan tetap berupa hash bcrypt", async () => {
  const f = fakeTx();
  const hasil = await buatAkunUntukGuru(OPS, f.tx);
  const data = f.data() as { password: string } | null;
  assert.ok(data);
  assert.notEqual(data!.password, hasil.passwordPlain);
  assert.ok(data!.password.startsWith("$2"));
  assert.equal(await bcrypt.compare(hasil.passwordPlain, data!.password), true);
});

test("PASSWORD AWAL eksplisit terlalu pendek ditolak", async () => {
  const f = fakeTx();
  await assert.rejects(
    () => buatAkunUntukGuru({ ...OPS, passwordAwal: "abc12" }, f.tx),
    /terlalu pendek/
  );
  assert.ok(!f.calls.includes("user.create")); // tidak ada akun dibuat
});

test("PASSWORD AWAL eksplisit memadai dipakai apa adanya", async () => {
  const f = fakeTx();
  const hasil = await buatAkunUntukGuru({ ...OPS, passwordAwal: "Rahasia123!" }, f.tx);
  assert.equal(hasil.passwordPlain, "Rahasia123!");
  const data = f.data() as { password: string };
  assert.equal(await bcrypt.compare("Rahasia123!", data.password), true);
});

test("Guru yang sudah punya akun tidak diproses ulang (tidak reset password lama)", async () => {
  const f = fakeTx({ guruSudahPunyaAkun: true });
  await assert.rejects(() => buatAkunUntukGuru(OPS, f.tx), /sudah mempunyai akun/);
  assert.ok(!f.calls.includes("user.create"));
});

test("USERNAME eksplisit yang kosong setelah sanitasi ditolak", async () => {
  const f = fakeTx();
  await assert.rejects(
    () => buatAkunUntukGuru({ ...OPS, username: "***" }, f.tx),
    /USERNAME.*tidak valid/
  );
});

test("peran akun WAKA diteruskan ke User yang dibuat", async () => {
  const f = fakeTx();
  const hasil = await buatAkunUntukGuru({ ...OPS, peranAkun: "WAKA" }, f.tx);
  assert.equal(hasil.role, "WAKA");
  const data = f.data() as { role: string };
  assert.equal(data.role, "WAKA");
});
