import type { Role } from "@prisma/client";

/**
 * Normalisasi & validasi input form Hak Akses (murni, tanpa DB).
 *
 * Aturan inti:
 * - Username selalu divalidasi terpisah.
 * - Role pengajar (GURU/WAKA): nama TIDAK boleh dipercaya dari client —
 *   server mengambilnya dari Data Guru; yang divalidasi adalah guruId.
 * - Role non-pengajar (ADMIN/SUPERADMIN/KEPALA): nama wajib dari form,
 *   relasi Guru harus dikosongkan.
 */

export type InputUserForm = {
  id?: string;
  username?: string | null;
  nama?: string | null;
  role?: string | null;
  guruId?: string | null;
};

export const ROLE_PENGAJAR: ReadonlySet<string> = new Set(["GURU", "WAKA"]);

export const ROLE_ALLOWLIST: ReadonlySet<string> = new Set(["GURU", "WAKA", "ADMIN", "SUPERADMIN", "KEPALA"]);

export function apakahRolePengajar(role: string | null | undefined): boolean {
  return !!role && ROLE_PENGAJAR.has(role);
}

export type HasilValidasiInputUser =
  | {
      ok: true;
      perluGuru: boolean;
      username: string;
      namaClient: string;
      guruIdMentah: string;
      role: Role;
    }
  | { ok: false; error: string };

export function validasiInputUser(input: InputUserForm): HasilValidasiInputUser {
  const username = (input.username ?? "").trim();
  if (!username) return { ok: false, error: "Username wajib diisi." };

  const roleRaw = (input.role ?? "").trim();
  if (!roleRaw) return { ok: false, error: "Peran akun wajib dipilih." };
  if (!ROLE_ALLOWLIST.has(roleRaw)) return { ok: false, error: "Peran akun tidak dikenal." };
  const role = roleRaw as Role;

  if (apakahRolePengajar(role)) {
    const gid = (input.guruId ?? "").trim();
    if (!gid) {
      return {
        ok: false,
        error: `Akun ${role} wajib terhubung ke data Guru yang valid.`,
      };
    }
    return { ok: true, perluGuru: true, username, namaClient: (input.nama ?? "").trim(), guruIdMentah: gid, role };
  }

  const nama = (input.nama ?? "").trim();
  if (!nama) return { ok: false, error: "Nama wajib diisi untuk akun non-pengajar." };
  return { ok: true, perluGuru: false, username, namaClient: nama, guruIdMentah: "", role };
}

/**
 * Keputusan akhir identitas akun setelah data Guru diverifikasi ke DB.
 * Dipisah agar mudah dites tanpa database.
 */
export function tentukanIdentitasAkun(args: {
  perluGuru: boolean;
  namaClient: string;
  namaGuruDb: string | null;
}): { ok: true; nama: string } | { ok: false; error: string } {
  if (args.perluGuru) {
    if (!args.namaGuruDb || !args.namaGuruDb.trim()) {
      return { ok: false, error: "Nama pada Data Guru kosong — lengkapi Data Guru dulu." };
    }
    // Server TIDAK mempercayai nama dari client untuk akun pengajar.
    return { ok: true, nama: args.namaGuruDb.trim() };
  }
  if (!args.namaClient.trim()) return { ok: false, error: "Nama wajib diisi." };
  return { ok: true, nama: args.namaClient.trim() };
}
