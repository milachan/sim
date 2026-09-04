import type { Role } from "@prisma/client";

export type KeputusanSuperadmin = { boleh: true } | { boleh: false; pesan: string };

export function keputusanHapusSuperadmin(
  target: { role: Role; aktif: boolean } | null,
  jumlahSuperAktif: number
): KeputusanSuperadmin {
  if (!target) return { boleh: false, pesan: "Akun tidak ditemukan." };
  if (target.role !== "SUPERADMIN" || !target.aktif) return { boleh: true };
  if (jumlahSuperAktif <= 1) return { boleh: false, pesan: "Tidak dapat menghapus super admin terakhir." };
  return { boleh: true };
}

export function keputusanUbahSuperadmin(
  existing: { role: Role; aktif: boolean } | null,
  input: { role: Role; aktif: boolean },
  jumlahSuperAktif: number
): KeputusanSuperadmin {
  if (!existing) return { boleh: false, pesan: "Akun tidak ditemukan." };
  if (existing.role !== "SUPERADMIN" || !existing.aktif) return { boleh: true };
  const akanHilang = input.aktif === false || input.role !== "SUPERADMIN";
  if (!akanHilang) return { boleh: true };
  if (jumlahSuperAktif <= 1) return { boleh: false, pesan: "Tidak dapat menonaktifkan atau menurunkan role super admin terakhir." };
  return { boleh: true };
}

export function validasiPasswordAkun(
  password: string | undefined | null,
  isCreate: boolean
): { ok: true } | { ok: false; error: string } {
  const t = (password ?? "").trim();
  if (isCreate) {
    if (t.length < 6) return { ok: false, error: "Password minimal 6 karakter untuk akun baru." };
    return { ok: true };
  }
  if (!t) return { ok: true };
  if (t.length < 6) return { ok: false, error: "Password minimal 6 karakter." };
  return { ok: true };
}
