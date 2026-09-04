"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { adalahPengajarOperasional } from "@/lib/account-auth";
import type { Role } from "@prisma/client";

/** Wajib login dengan user termutakhir dari database; nonaktif/hapus ditolak. */
export async function wajibLogin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Wajib memegang salah satu role. Role diambil dari DB, bukan JWT. */
export async function wajibRole(...roles: Role[]) {
  const user = await wajibLogin();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

export async function wajibAdmin() {
  return wajibRole("ADMIN", "SUPERADMIN");
}

/**
 * Wajib pengajar operasional: GURU atau WAKA yang memiliki guruId & data guru aktif.
 * Dipakai action yang mengelola jadwal/jurnal/absensi/nilai milik guru (bukan pemantauan).
 */
export async function wajibPengajar() {
  const user = await wajibLogin();
  if (!adalahPengajarOperasional(user)) redirect("/");
  return user;
}

/** Wajib dapat mengelola jurnal: pengajar (GURU/WAKA) atau admin. */
export async function wajibKelola() {
  const user = await wajibLogin();
  if (!adalahPengajarOperasional(user) && user.role !== "ADMIN" && user.role !== "SUPERADMIN") {
    redirect("/");
  }
  return user;
}

export async function wajibWaka() {
  return wajibRole("WAKA", "ADMIN", "SUPERADMIN");
}

export async function wajibKepala() {
  return wajibRole("KEPALA", "ADMIN", "SUPERADMIN");
}

/**
 * Wajib guru operasional: role GURU harus memiliki guruId valid dan data gurunya
 * aktif (belum dinonaktifkan / soft-delete). getCurrentUser sudah menolak GURU
 * non-operasional, jadi ini sebagai penegasan eksplisit.
 */
export async function wajibGuruAktif() {
  const user = await wajibLogin();
  if (!guruOperasionalValidLokal(user)) redirect("/");
  return user;
}

function guruOperasionalValidLokal(user: { role: string; guruId: string | null; guru?: { status: boolean; deletedAt: Date | null } | null }): boolean {
  return user.role === "GURU" && !!user.guruId && !!user.guru && user.guru.status === true && user.guru.deletedAt === null;
}