import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { prisma } from "./prisma";
import type { Prisma, Role } from "@prisma/client";

/** Kebijakan panjang minimum password akun baru (sama dengan form Hak Akses). */
export const MIN_PANJANG_PASSWORD = 6;

function safeUsername(kodeRaw: string): string {
  const s = kodeRaw.toLowerCase().replace(/[^a-z0-9]/g, "") || "guru";
  return s.slice(0, 24);
}

export async function usernameUnik(base: string, excludeId?: string, client?: Prisma.TransactionClient): Promise<string> {
  const db = client ?? prisma;
  let cand = base;
  let suf = 2;
  while (true) {
    const ada = await db.user.findUnique({ where: { username: cand } });
    if (!ada || (excludeId && ada.id === excludeId)) return cand;
    cand = `${base}-${suf++}`;
  }
}

/**
 * Charset tanpa karakter mudah tertukar (tanpa I l O 0 1). 58 simbol × 12
 * karakter ≈ 70 bit entropi — memadai untuk password awal sementara.
 */
export const CHARSET_PASSWORD = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/**
 * Password acak kuat memakai CSPRNG bawaan Node (`crypto.randomInt`),
 * BUKAN Math.random yang tidak aman secara kriptografis.
 */
export function passwordAcakKuat(len = 12): string {
  if (len < MIN_PANJANG_PASSWORD) len = MIN_PANJANG_PASSWORD;
  let out = "";
  for (let i = 0; i < len; i++) out += CHARSET_PASSWORD[randomInt(CHARSET_PASSWORD.length)];
  return out;
}

export function passwordAwalValid(plain: string): boolean {
  return plain.length >= MIN_PANJANG_PASSWORD;
}

/**
 * Buat akun User untuk seorang Guru.
 * WAJIB dipanggil dengan client transaksi (`tx`) ketika berada di dalam
 * `prisma.$transaction` — semua query (cek guruId, cek username, create)
 * memakai `client ?? prisma` sehingga ikut rollback bila transaksi gagal.
 */
export async function buatAkunUntukGuru(
  opts: {
    guruId: string;
    guruNama: string;
    kode?: string | null;
    username?: string | null;
    passwordAwal?: string | null;
    peranAkun?: string | null;
    aktif?: boolean | null;
    wajibGantiPassword?: boolean | null;
  },
  client?: Prisma.TransactionClient
): Promise<{ username: string; passwordPlain: string; role: Role }> {
  const db = client ?? prisma;
  const ada = await db.user.findUnique({ where: { guruId: opts.guruId } });
  if (ada) throw new Error("Guru sudah mempunyai akun.");
  const role: Role = opts.peranAkun?.toUpperCase() === "WAKA" ? "WAKA" : "GURU";

  // USERNAME eksplisit harus tetap tidak kosong setelah sanitasi.
  const usernameEksplisit = opts.username?.trim()
    ? opts.username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")
    : "";
  if (opts.username?.trim() && !usernameEksplisit) {
    throw new Error(`USERNAME "${opts.username.trim()}" tidak valid setelah sanitasi — gunakan huruf/angka/. _ -`);
  }
  const base = usernameEksplisit || safeUsername(opts.kode ?? "");
  const username = await usernameUnik(base, undefined, db);

  // PASSWORD AWAL eksplisit wajib memenuhi kebijakan minimum; kosong = dibuat otomatis.
  const plainEksplisit = opts.passwordAwal?.trim() ? opts.passwordAwal.trim() : "";
  if (plainEksplisit && !passwordAwalValid(plainEksplisit)) {
    throw new Error(`PASSWORD AWAL terlalu pendek — minimal ${MIN_PANJANG_PASSWORD} karakter.`);
  }
  const plain = plainEksplisit || passwordAcakKuat(12);

  const wajib = opts.wajibGantiPassword ?? false;
  const hash = await bcrypt.hash(plain, 10);
  await db.user.create({
    data: {
      username,
      password: hash,
      nama: opts.guruNama,
      role,
      guruId: opts.guruId,
      aktif: opts.aktif ?? true,
      wajibGantiPassword: wajib,
    },
  });
  return { username, passwordPlain: plain, role };
}
