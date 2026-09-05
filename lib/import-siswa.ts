import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";

export type ItemSiswaBaru = { nisn: string; nis: string; nama: string; jk: "L" | "P" | null; kelas: string };
export type ItemSiswaUpdate = {
  nisn: string;
  namaLama: string;
  namaBaru: string;
  nisLama: string;
  nisBaru: string;
  jkLama: string;
  jkBaru: string;
  kelasLama: string;
  kelasBaru: string;
  dipulihkan: boolean;
};
// Nama cocok dengan siswa yang sudah ada, tapi NISN/NIS-nya beda → butuh konfirmasi
// admin; siswa DITAMBAHKAN sebagai siswa baru (bukan replace data lama).
export type ItemSiswaKonflik = {
  nisnFile: string;
  nisFile: string;
  namaFile: string;
  jkFile: string;
  kelasFile: string;
  nisnLama: string;
  nisLama: string;
  namaLama: string;
  jkLama: string;
  kelasLama: string;
};

export type RencanaSiswa = {
  baru: ItemSiswaBaru[];
  update: ItemSiswaUpdate[];
  konflik: ItemSiswaKonflik[];
  sama: number;
  dilewati: number;
  error: string[];
};

export type SiswaImportPrisma = {
  kelas: { findMany: (args?: unknown) => Promise<{ id: string; nama: string }[]> };
  siswa: {
    findMany: (args?: unknown) => Promise<
      {
        id: string;
        nama: string;
        nisn: string | null;
        nis: string | null;
        jenisKelamin: "L" | "P" | null;
        kelasId: string | null;
        deletedAt: Date | null;
      }[]
    >;
    create: (args: {
      data: {
        nama: string;
        nisn: string | null;
        nis: string | null;
        jenisKelamin: "L" | "P" | null;
        kelasId: string | null;
        status: string;
        deletedAt: null;
      };
    }) => Promise<{
      id: string;
      nama: string;
      nisn: string | null;
      nis: string | null;
      jenisKelamin: "L" | "P" | null;
      kelasId: string | null;
      deletedAt: Date | null;
    }>;
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  };
};

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function cariKolom(header: string[]): { nisn: number; nis: number; nama: number; jk: number; kelas: number } {
  const idx: Record<string, number> = {};
  header.forEach((h, i) => {
    const n = norm(h);
    if (!n) return;
    if (!(n in idx)) idx[n] = i;
  });
  const nisn = idx["nisn"] ?? header.findIndex((h) => norm(h).includes("nisn"));
  const nis = idx["nis"] ?? idx["nisinduk"] ?? header.findIndex((h) => norm(h).includes("nis") && !norm(h).includes("nisn"));
  const nama = idx["nama"] ?? idx["namalengkap"] ?? header.findIndex((h) => norm(h).includes("nama"));
  // Jenis kelamin: JENIS KELAMIN / JK / KELAMIN / GENDER (opsional)
  const jk =
    idx["jeniskelamin"] ??
    idx["jk"] ??
    idx["kelamin"] ??
    idx["gender"] ??
    header.findIndex((h) => {
      const n = norm(h);
      return n.includes("jeniskelamin") || n === "jk" || n.includes("kelamin") || n.includes("gender");
    });
  const kelas = idx["kelas"] ?? idx["rombonganbelajar"] ?? header.findIndex((h) => norm(h).includes("kelas") || norm(h).includes("rombel"));
  return { nisn, nis, nama, jk, kelas };
}

/**
 * Normalisasi jenis kelamin dari isi sel Excel. Mengembalikan:
 * - { nilai: "L" | "P" | null } — null bila sel kosong (opsional).
 * - { error: string } — nilai tidak dikenal.
 */
export function bacaJenisKelamin(v: string): { nilai: "L" | "P" | null } | { error: string } {
  const n = v.trim().toLowerCase().replace(/[^a-z]/g, "");
  if (!n) return { nilai: null };
  if (n === "l" || n === "lakilaki" || n === "lk" || n === "pria" || n === "laki") return { nilai: "L" };
  if (n === "p" || n === "perempuan" || n === "pr" || n === "wanita" || n === "cewek") return { nilai: "P" };
  return { error: `Jenis kelamin "${v}" tidak dikenal (gunakan L/P atau Laki-laki/Perempuan).` };
}

/**
 * Proses file import Data Siswa (format NISN | NIS | NAMA | KELAS, header fleksibel).
 * KUNCI sinkron = NISN (10 digit):
 *   - NISN cocok  → perbarui siswa yang ada (kolom kosong dipertahankan).
 *   - NISN/NIS beda tapi NAMA sama → masuk daftar KONFLIK (butuh konfirmasi admin):
 *     siswa DITAMBAHKAN sebagai siswa baru — NISN beda berarti orang berbeda, walau senama.
 *   - NISN/NIS & nama belum ada → siswa baru.
 *   - Siswa nonaktif yang cocok otomatis dipulihkan.
 * Mode "preview" tidak menulis apa pun ke database.
 */
export async function prosesSiswa(
  bytes: Uint8Array,
  mode: "preview" | "exec",
  deps?: { prismaClient?: SiswaImportPrisma }
): Promise<RencanaSiswa> {
  const db = (deps?.prismaClient ?? (prisma as unknown as SiswaImportPrisma));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("File Excel tidak memiliki sheet.");

  let header: string[] | null = null;
  const rows: string[][] = [];
  ws.eachRow((row) => {
    const cells = (row.values as unknown[]).slice(1).map((v) => (v == null ? "" : String(v).trim()));
    if (cells.every((c) => !c)) return;
    if (!header) {
      header = cells;
      return;
    }
    rows.push(cells);
  });
  if (!header) throw new Error("File kosong — tidak ada baris data.");
  if (rows.length === 0) return { baru: [], update: [], konflik: [], sama: 0, dilewati: 0, error: [] };

  const kol = cariKolom(header);
  const plan: RencanaSiswa = { baru: [], update: [], konflik: [], sama: 0, dilewati: 0, error: [] };

  const [kelasDb, siswaDb] = await Promise.all([
    db.kelas.findMany(),
    db.siswa.findMany({ select: { id: true, nama: true, nisn: true, nis: true, jenisKelamin: true, kelasId: true, deletedAt: true } }),
  ]);
  const byKelas = new Map(kelasDb.map((k) => [norm(k.nama), k]));
  const byNisn = new Map<string, (typeof siswaDb)[number]>();
  const byNis = new Map<string, (typeof siswaDb)[number]>();
  const byNama = new Map<string, (typeof siswaDb)[number]>();
  for (const s of siswaDb) {
    if (s.nisn) byNisn.set(s.nisn, s);
    if (s.nis) byNis.set(s.nis, s);
    const key = norm(s.nama);
    if (!byNama.has(key)) byNama.set(key, s);
  }
  // Kunci yang sudah muncul di file (cegah duplikat dalam satu file)
  const fileNisn = new Set<string>();
  const fileNis = new Set<string>();

  const get = (cells: string[], i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "");
  const namaKelas = (id: string | null) => kelasDb.find((k) => k.id === id)?.nama ?? "-";

  for (const cells of rows) {
    const nisn = get(cells, kol.nisn);
    const nis = get(cells, kol.nis);
    const nama = get(cells, kol.nama);
    const jk = bacaJenisKelamin(get(cells, kol.jk));
    const kelasNama = get(cells, kol.kelas);
    const label = `${nama}${nisn ? ` (${nisn})` : nis ? ` (NIS ${nis})` : ""}`.trim() || `baris ${rows.indexOf(cells) + 2}`;

    if (!nama) {
      plan.error.push(`Baris "${label}": NAMA wajib diisi.`);
      plan.dilewati++;
      continue;
    }
    if ("error" in jk) {
      plan.error.push(`Baris "${label}": ${jk.error}`);
      plan.dilewati++;
      continue;
    }
    if (nisn && !/^\d{10}$/.test(nisn)) {
      plan.error.push(`Baris "${label}": NISN harus 10 digit angka ("${nisn}").`);
      plan.dilewati++;
      continue;
    }
    if (nisn && fileNisn.has(nisn)) {
      plan.error.push(`Baris "${label}": NISN ${nisn} muncul lebih dari sekali di file — hanya baris pertama diproses.`);
      plan.dilewati++;
      continue;
    }
    if (nis && fileNis.has(nis)) {
      plan.error.push(`Baris "${label}": NIS ${nis} muncul lebih dari sekali di file — hanya baris pertama diproses.`);
      plan.dilewati++;
      continue;
    }
    const kelas = kelasNama ? byKelas.get(norm(kelasNama)) : undefined;
    if (kelasNama && !kelas) {
      plan.error.push(`Baris "${label}": kelas "${kelasNama}" tidak ditemukan. Buat kelasnya dulu atau perbaiki penulisannya.`);
      plan.dilewati++;
      continue;
    }

    // ---------- Cocokkan berdasarkan kunci: NISN, lalu NIS ----------
    const ada = (nisn && byNisn.get(nisn)) || (nis && byNis.get(nis));
    if (ada) {
      // File membawa NISN yang ternyata milik siswa lain (bentrok kunci unik)
      if (nisn && ada.nisn !== nisn) {
        const pemilik = byNisn.get(nisn);
        plan.error.push(`Baris "${label}": NISN ${nisn} sudah dipakai siswa "${pemilik?.nama ?? "?"}". Perbaiki NISN di file.`);
        plan.dilewati++;
        continue;
      }
      if (nisn && !fileNisn.has(nisn)) fileNisn.add(nisn);
      if (nis && !fileNis.has(nis)) fileNis.add(nis);

      const namaBerubah = nama !== ada.nama;
      const nisBerubah = nis && nis !== (ada.nis ?? "") ? nis : null;
      const nisnBerubah = nisn && nisn !== (ada.nisn ?? "") ? nisn : null;
      const jkBerubah = jk.nilai && jk.nilai !== ada.jenisKelamin ? jk.nilai : null;
      const kelasBerubah = kelas ? kelas.id !== ada.kelasId : false;
      const dipulihkan = !!ada.deletedAt;

      if (!namaBerubah && !nisBerubah && !nisnBerubah && !jkBerubah && !kelasBerubah && !dipulihkan) {
        plan.sama++;
        continue;
      }
      plan.update.push({
        nisn: ada.nisn ?? "-",
        namaLama: ada.nama,
        namaBaru: nama,
        nisLama: ada.nis ?? "-",
        nisBaru: nis || "(tetap)",
        jkLama: ada.jenisKelamin ?? "-",
        jkBaru: jk.nilai ?? "(tetap)",
        kelasLama: namaKelas(ada.kelasId),
        kelasBaru: kelas ? kelas.nama : "(tetap)",
        dipulihkan,
      });
      if (mode === "exec") {
        await db.siswa.update({
          where: { id: ada.id },
          data: {
            nama,
            ...(nisn ? { nisn } : {}),
            ...(nis ? { nis } : {}),
            ...(jk.nilai ? { jenisKelamin: jk.nilai } : {}),
            ...(kelas ? { kelasId: kelas.id } : {}),
            status: "AKTIF",
            deletedAt: null,
          },
        });
        if (nisn) byNisn.set(nisn, { ...ada, nama, nisn });
      }
      continue;
    }

    // ---------- Kunci tidak cocok → cek nama (nama sama = siswa baru, butuh konfirmasi) ----------
    const adaNama = byNama.get(norm(nama));
    if (adaNama) {
      // NISN/NIS beda tapi nama sama: orang yang berbeda bisa senama. Jangan
      // replace data orang yang salah — DITAMBAHKAN sebagai siswa baru, dengan
      // konfirmasi admin (terlihat di pratinjau sebagai "nama sama").
      if (!nisn && !nis) {
        plan.error.push(
          `Baris "${label}": nama "${nama}" sama dengan siswa yang sudah ada (${adaNama.nama}${adaNama.nisn ? `, NISN ${adaNama.nisn}` : ""}) tapi NISN/NIS kosong — isi NISN di file agar siswa baru bisa ditambahkan.`
        );
        plan.dilewati++;
        continue;
      }
      plan.konflik.push({
        nisnFile: nisn,
        nisFile: nis,
        namaFile: nama,
        jkFile: jk.nilai ?? "",
        kelasFile: kelas?.nama ?? "",
        nisnLama: adaNama.nisn ?? "-",
        nisLama: adaNama.nis ?? "-",
        namaLama: adaNama.nama,
        jkLama: adaNama.jenisKelamin ?? "",
        kelasLama: namaKelas(adaNama.kelasId),
      });
      if (mode === "exec") {
        // Tambah sebagai siswa BARU — NISN beda berarti orang berbeda, walau senama.
        const created = await db.siswa.create({
          data: {
            nama,
            nisn: nisn || null,
            nis: nis || null,
            jenisKelamin: jk.nilai,
            kelasId: kelas?.id ?? null,
            status: "AKTIF",
            deletedAt: null,
          },
        });
        byNama.set(norm(nama), created);
        if (created.nisn) byNisn.set(created.nisn, created);
        if (created.nis) byNis.set(created.nis, created);
      }
      if (nisn && !fileNisn.has(nisn)) fileNisn.add(nisn);
      if (nis && !fileNis.has(nis)) fileNis.add(nis);
      continue;
    }

    // ---------- Belum ada → siswa baru ----------
    if (!nisn && !nis) {
      plan.error.push(`Baris "${label}": NISN/NIS kosong dan nama tidak ditemukan — isi NISN agar bisa disinkronkan.`);
      plan.dilewati++;
      continue;
    }
    plan.baru.push({ nisn, nis, nama, jk: jk.nilai, kelas: kelas?.nama ?? "" });
    if (nisn) fileNisn.add(nisn);
    if (nis) fileNis.add(nis);
    if (mode === "exec") {
      const created = await db.siswa.create({
        data: {
          nama,
          nisn: nisn || null,
          nis: nis || null,
          jenisKelamin: jk.nilai,
          kelasId: kelas?.id ?? null,
          status: "AKTIF",
          deletedAt: null,
        },
      });
      byNama.set(norm(nama), created);
      if (created.nisn) byNisn.set(created.nisn, created);
      if (created.nis) byNis.set(created.nis, created);
    }
  }

  return plan;
}
