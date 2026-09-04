import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { buatAkunUntukGuru, MIN_PANJANG_PASSWORD } from "@/lib/akun-provision";
import type { Prisma } from "@prisma/client";

export type KredensialAkunBaru = { nama: string; kode: string; username: string; passwordAwal: string; peran: string; wajibGanti: boolean };

export type ImportErrorItem = { barisKe: number | null; pesan: string };

/**
 * Error aman-untuk-klien: pesannya sudah disanitasi sehingga boleh dikirim
 * ke UI. Error lain (mis. Prisma) tidak boleh dibawa keluar dari server.
 */
export class ImportSafeError extends Error {
  constructor(pesan: string) {
    super(pesan);
    this.name = "ImportSafeError";
  }
}

export function formatImportError(e: ImportErrorItem): string {
  if (e.barisKe == null) return e.pesan;
  return `Baris ${e.barisKe} — ${e.pesan}`;
}

export function fileGuruDidukung(namaFile: string): boolean {
  return namaFile.toLowerCase().endsWith(".xlsx");
}

export type RencanaGuru = {
  baru: { nama: string; kode: string; akunAkanDibuat: boolean }[];
  update: {
    kode: string;
    namaLama: string;
    namaBaru: string;
    nipLama: string;
    nipBaru: string;
    teleponLama: string;
    teleponBaru: string;
    dipulihkan: boolean;
    /** Hanya penulisan nama yang beda (mis. ditambah gelar) — tanpa perubahan data lain. */
    hanyaFormat: boolean;
  }[];
  sama: number;
  dilewati: number;
  error: string[];
  errorItems: ImportErrorItem[];
  akunBaruRencana: number;
  akunBaru?: KredensialAkunBaru[];
  akunSudahAda: number;
  rowGagal: number;
  rowBerhasil: number;
  status: "success" | "partial" | "failed";
};

export type BarisTervalidasi = {
  barisKe: number;
  label: string;
  nama: string;
  kode: string;
  nip: string;
  telepon: string;
  usernameEksplisit: string | null;
  passwordAwal: string | null;
  peranAkun: "GURU" | "WAKA";
  akunAktif: boolean;
  wajibGanti: boolean;
};

const RE_KODE_GURU = /^[A-Za-z]\d{1,3}$/;
const RE_USERNAME = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const RE_TELEPON = /^[0-9+\-\s().]{9,15}$/;

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Nama mirip secara praktis: identik setelah dinormalisasi, atau salah satu awalan yang lain (mis. "Budi" vs "Budi, S.Pd."). */
function miripNama(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  return x === y || x.startsWith(y) || y.startsWith(x);
}

export function cariKolom(header: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  header.forEach((h, i) => {
    const n = norm(h);
    if (!n) return;
    if (!(n in idx)) idx[n] = i;
  });
  const kunci = (arr: string[]): number => {
    for (const k of arr) if (k in idx) return idx[k];
    return -1;
  };
  return {
    nama: kunci(["nama", "namalengkap"]) >= 0 ? kunci(["nama", "namalengkap"]) : header.findIndex((h) => norm(h).includes("nama")),
    kode: kunci(["kode"]) >= 0 ? kunci(["kode"]) : header.findIndex((h) => norm(h).includes("kode")),
    nip: kunci(["nip", "nuptk"]) >= 0 ? kunci(["nip", "nuptk"]) : header.findIndex((h) => norm(h).includes("nip")),
    telepon:
      kunci(["whatsapp", "nowhatsapp", "telepon", "nohp"]) >= 0
        ? kunci(["whatsapp", "nowhatsapp", "telepon", "nohp"])
        : header.findIndex((h) => norm(h).includes("whatsapp") || norm(h).includes("telepon") || norm(h).includes("nohp")),
    username: kunci(["username", "user"]),
    password: kunci(["passwordawal", "password"]),
    peran: kunci(["peranakun", "peran"]),
    akunAktif: kunci(["akunaktif", "aktif"]),
    wajibGanti: kunci(["wajibgantipassword", "wajibganti"]),
  };
}

export async function bacaFileGuru(bytes: Uint8Array): Promise<{ header: string[]; rows: string[][] }> {
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
  if (!header) {
    throw new ImportSafeError("File kosong — tidak ada header maupun baris data. Gunakan template Import Guru.");
  }
  const kol = cariKolom(header);
  if (kol.nama < 0 || kol.kode < 0) {
    throw new ImportSafeError(
      "File hanya berisi contoh/petunjuk atau format tidak dikenali. Gunakan template Import Guru dengan kolom NAMA, KODE, NIP, WHATSAPP, USERNAME, PASSWORD AWAL, PERAN AKUN, AKUN AKTIF, WAJIB GANTI PASSWORD."
    );
  }
  if (rows.length === 0) throw new ImportSafeError("File tidak memiliki baris data — isi minimal satu guru (baris contoh boleh dihapus).");
  return { header, rows };
}

export function validasiSemuaBaris(
  rows: string[][],
  kol: Record<string, number>
): { baris: BarisTervalidasi[]; error: string[]; errorItems: ImportErrorItem[] } {
  const baris: BarisTervalidasi[] = [];
  const errorItems: ImportErrorItem[] = [];
  const kodeTerlihat = new Map<string, number>();
  const nipTerlihat = new Map<string, number>();

  const get = (cells: string[], i: number) => (i >= 0 ? (cells[i] ?? "").trim() : "");
  const pushErr = (barisKe: number | null, label: string, msg: string) => {
    const pesan = barisKe != null ? `${label}: ${msg}` : msg;
    errorItems.push({ barisKe, pesan });
  };

  rows.forEach((cells, idx) => {
    const barisKe = idx + 2;
    const nama = get(cells, kol.nama);
    const kodeRaw = get(cells, kol.kode);
    const label = nama ? `${nama}${kodeRaw ? ` (${kodeRaw.toUpperCase()})` : ""}` : `baris ${barisKe}`;

    if (!nama || !kodeRaw) {
      pushErr(barisKe, label, "NAMA dan KODE wajib diisi.");
      return;
    }
    const kode = kodeRaw.toUpperCase();
    if (!RE_KODE_GURU.test(kode)) {
      pushErr(barisKe, label, `format KODE tidak valid ("${kode}"). Aturan kode Guru: satu huruf diikuti 1–3 angka, mis. K5, F2.`);
      return;
    }
    const kodeDup = kodeTerlihat.get(kode);
    if (kodeDup !== undefined) {
      pushErr(barisKe, label, `KODE ${kode} muncul dua kali dalam file (pertama di baris ${kodeDup}). KODE harus unik per file.`);
      return;
    }
    kodeTerlihat.set(kode, barisKe);

    const nip = get(cells, kol.nip);
    if (nip) {
      const nipDup = nipTerlihat.get(nip);
      if (nipDup !== undefined) {
        pushErr(barisKe, label, `NIP ${nip} duplikat dalam file (pertama di baris ${nipDup}).`);
        return;
      }
      nipTerlihat.set(nip, barisKe);
    }

    const telepon = get(cells, kol.telepon);
    if (telepon && !RE_TELEPON.test(telepon)) {
      pushErr(barisKe, label, `format No. WhatsApp tidak valid ("${telepon}"). Contoh: 081234567890.`);
      return;
    }

    const peranRaw = get(cells, kol.peran).toUpperCase();
    let peranAkun: "GURU" | "WAKA" = "GURU";
    if (peranRaw) {
      if (peranRaw !== "GURU" && peranRaw !== "WAKA") {
        pushErr(barisKe, label, `PERAN AKUN hanya menerima GURU atau WAKA (diterima: "${get(cells, kol.peran)}").`);
        return;
      }
      peranAkun = peranRaw;
    }

    const bacaYaTidak = (nilai: string, namaKolom: string, def: boolean): boolean | null => {
      if (!nilai) return def;
      if (nilai === "YA") return true;
      if (nilai === "TIDAK") return false;
      pushErr(barisKe, label, `kolom ${namaKolom} hanya menerima kosong, YA, atau TIDAK (diterima: "${nilai}").`);
      return null;
    };
    const akunAktif = bacaYaTidak(get(cells, kol.akunAktif).toUpperCase(), "AKUN AKTIF", true);
    if (akunAktif === null) return;
    const wajibGanti = bacaYaTidak(get(cells, kol.wajibGanti).toUpperCase(), "WAJIB GANTI PASSWORD", false);
    if (wajibGanti === null) return;

    const usernameMentah = get(cells, kol.username);
    let usernameEksplisit: string | null = null;
    if (usernameMentah) {
      const s = usernameMentah.toLowerCase();
      if (!RE_USERNAME.test(s)) {
        pushErr(
          barisKe,
          label,
          `USERNAME "${usernameMentah}" tidak valid — 3–30 karakter, awali huruf/angka, hanya huruf kecil, angka, titik, garis bawah, atau tanda hubung.`
        );
        return;
      }
      usernameEksplisit = s;
    }

    const passwordMentah = get(cells, kol.password);
    if (passwordMentah && passwordMentah.length < MIN_PANJANG_PASSWORD) {
      pushErr(barisKe, label, `PASSWORD AWAL terlalu pendek — minimal ${MIN_PANJANG_PASSWORD} karakter (atau biarkan kosong agar dibuat otomatis).`);
      return;
    }

    baris.push({
      barisKe,
      label,
      nama,
      kode,
      nip,
      telepon,
      usernameEksplisit,
      passwordAwal: passwordMentah || null,
      peranAkun,
      akunAktif,
      wajibGanti,
    });
  });

  const error = errorItems.map(formatImportError);
  return { baris, error, errorItems };
}

type GuruLama = {
  id: string;
  nama: string;
  kode: string | null;
  nip: string | null;
  telepon: string | null;
  status: boolean;
  deletedAt: Date | null;
  user: { id: string; username: string; role: string; aktif: boolean } | null;
};

export async function buatGuruDanAkunDalamTx(
  tx: Prisma.TransactionClient,
  b: BarisTervalidasi
): Promise<KredensialAkunBaru | null> {
  const guru = await tx.guru.create({
    data: { nama: b.nama, kode: b.kode, nip: b.nip || null, telepon: b.telepon || null, status: true, deletedAt: null },
  });
  const akun = await buatAkunUntukGuru(
    {
      guruId: guru.id,
      guruNama: b.nama,
      kode: b.kode,
      username: b.usernameEksplisit,
      passwordAwal: b.passwordAwal,
      peranAkun: b.peranAkun,
      aktif: b.akunAktif,
      wajibGantiPassword: b.wajibGanti,
    },
    tx
  );
  return {
    nama: b.nama,
    kode: b.kode,
    username: akun.username,
    passwordAwal: akun.passwordPlain,
    peran: akun.role,
    wajibGanti: b.wajibGanti,
  };
}

export async function perbaruiGuruDanAkunDalamTx(
  tx: Prisma.TransactionClient,
  ada: GuruLama,
  b: BarisTervalidasi
): Promise<KredensialAkunBaru | null> {
  const namaBerubah = b.nama !== ada.nama;
  const nipBerubah = !!b.nip && b.nip !== (ada.nip ?? "");
  const teleponBerubah = !!b.telepon && b.telepon !== (ada.telepon ?? "");
  const dipulihkan = !!ada.deletedAt;

  if (namaBerubah || nipBerubah || teleponBerubah || dipulihkan) {
    await tx.guru.update({
      where: { id: ada.id },
      data: {
        nama: b.nama,
        ...(b.nip ? { nip: b.nip } : {}),
        ...(b.telepon ? { telepon: b.telepon } : {}),
        status: true,
        deletedAt: null,
      },
    });
  }
  if (!ada.user) {
    const akun = await buatAkunUntukGuru(
      {
        guruId: ada.id,
        guruNama: b.nama,
        kode: b.kode,
        username: b.usernameEksplisit,
        passwordAwal: b.passwordAwal,
        peranAkun: b.peranAkun,
        aktif: b.akunAktif,
        wajibGantiPassword: b.wajibGanti,
      },
      tx
    );
    return {
      nama: b.nama,
      kode: b.kode,
      username: akun.username,
      passwordAwal: akun.passwordPlain,
      peran: akun.role,
      wajibGanti: b.wajibGanti,
    };
  } else if (namaBerubah) {
    await tx.user.update({ where: { id: ada.user.id }, data: { nama: b.nama } });
  }
  return null;
}

export function sanitasiPesanImportError(e: unknown, label: string): string {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  if (
    lower.includes("unique constraint") ||
    lower.includes("duplicate") ||
    lower.includes("already exists")
  ) {
    if (lower.includes("username")) return `${label}: gagal disimpan — username sudah digunakan.`;
    if (lower.includes("kode")) return `${label}: gagal disimpan — kode sudah digunakan.`;
    if (lower.includes("nip")) return `${label}: gagal disimpan — NIP sudah digunakan.`;
    return `${label}: gagal disimpan karena data duplikat.`;
  }
  return `${label}: gagal disimpan karena konflik data atau gangguan database.`;
}

export function hitungRowGagalUnik(items: ImportErrorItem[]): number {
  const s = new Set<number>();
  for (const it of items) if (it.barisKe != null) s.add(it.barisKe);
  return s.size;
}

/**
 * Fungsi produksi penentu status eksekusi — dipakai prosesGuru dan diuji
 * langsung, sehingga test tidak perlu meniru logika penghitungan.
 */
export function hitungStatusImport(rowBerhasil: number, rowGagal: number): "success" | "partial" | "failed" {
  if (rowGagal > 0 && rowBerhasil > 0) return "partial";
  if (rowGagal > 0 && rowBerhasil === 0) return "failed";
  return "success";
}

export type PayloadImport = {
  ok: boolean;
  mode: "preview" | "exec";
  tipe: "guru";
  preview: boolean;
  status: "success" | "partial" | "failed";
  rowBerhasil: number;
  rowGagal: number;
  siapEksekusi?: boolean;
};

/** Fungsi produksi pembentuk payload respons — satu-satunya sumber kontrak API. */
export function bangunPayloadImport(plan: RencanaGuru, preview: boolean): Record<string, unknown> {
  const rowGagal = Number(plan.rowGagal);
  const rowBerhasil = Number(plan.rowBerhasil);
  const payload: Record<string, unknown> = {
    ok: true,
    mode: preview ? "preview" : "exec",
    ...(preview ? { siapEksekusi: plan.errorItems.length === 0 && hitungRowGagalUnik(plan.errorItems) === 0 } : {}),
    rowGagal,
    rowBerhasil,
    status: plan.status,
    tipe: "guru",
    preview,
    baru: plan.baru,
    update: plan.update,
    sama: plan.sama,
    dilewati: plan.dilewati,
    error: plan.error,
    errorItems: plan.errorItems,
    akunBaruRencana: Number(plan.akunBaruRencana),
    akunSudahAda: Number(plan.akunSudahAda),
    jumlahAkunDibuat: (plan.akunBaru ?? []).length,
    teks:
      plan.baru.length === 0 && plan.update.length === 0 && plan.sama > 0 && plan.errorItems.length === 0
        ? "Semua data sudah sama — tidak ada perubahan."
        : undefined,
  };
  return payload;
}

export async function prosesGuru(
  bytes: Uint8Array,
  mode: "preview" | "exec",
  deps?: { prismaClient?: typeof prisma; txRunner?: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T> }
): Promise<RencanaGuru> {
  const db = deps?.prismaClient ?? prisma;
  const runTx = deps?.txRunner ?? (<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => db.$transaction(fn));

  const { header, rows } = await bacaFileGuru(bytes);
  const kol = cariKolom(header);
  const { baris, error, errorItems } = validasiSemuaBaris(rows, kol);

  const plan: RencanaGuru = {
    baru: [],
    update: [],
    sama: 0,
    dilewati: 0,
    error: [...error],
    errorItems: [...errorItems],
    akunBaruRencana: 0,
    akunSudahAda: 0,
    rowGagal: 0,
    rowBerhasil: 0,
    status: "success",
  };

  const gurus = await db.guru.findMany({
    select: {
      id: true,
      nama: true,
      kode: true,
      nip: true,
      telepon: true,
      status: true,
      deletedAt: true,
      user: { select: { id: true, username: true, role: true, aktif: true } },
    },
  });
  const byKode = new Map<string, (typeof gurus)[number]>();
  for (const g of gurus) if (g.kode) byKode.set(g.kode.toUpperCase(), g);

  for (const b of baris) {
    if (!b.nip) continue;
    const milikLain = gurus.find((g) => g.nip === b.nip && g.kode?.toUpperCase() !== b.kode);
    if (milikLain) {
      const item: ImportErrorItem = {
        barisKe: b.barisKe,
        pesan: `${b.label}: NIP sudah dipakai Guru lain (${milikLain.nama}${milikLain.kode ? `, kode ${milikLain.kode}` : ""}).`,
      };
      plan.errorItems.push(item);
      plan.error.push(formatImportError(item));
    }
  }

  // Tabrakan kode: KODE yang sudah dipakai guru lain dengan nama yang BEDA TOTAL
  // (bukan sekadar beda format gelar, mis. "Budi" vs "Budi, S.Pd.") akan menimpa
  // data guru yang ada saat eksekusi. Diblokir agar import tidak diam-diam
  // mengganti identitas guru — admin harus memakai kode baru atau memperbaiki nama.
  for (const b of baris) {
    const ada = byKode.get(b.kode);
    if (!ada) continue;
    const nFile = norm(b.nama);
    const nDb = norm(ada.nama);
    const mirip = nFile === nDb || nFile.startsWith(nDb) || nDb.startsWith(nFile);
    if (!mirip) {
      const item: ImportErrorItem = {
        barisKe: b.barisKe,
        pesan: `${b.label}: KODE ${b.kode} sudah dipakai oleh "${ada.nama}" — nama di file berbeda total. Ganti KODE di file (atau perbaiki nama) agar tidak menimpa data guru yang sudah ada.`,
      };
      plan.errorItems.push(item);
      plan.error.push(formatImportError(item));
    }
  }

  if (mode === "preview") {
    plan.rowGagal = hitungRowGagalUnik(plan.errorItems);
    const gagalSet = new Set<number>(plan.errorItems.filter((e) => e.barisKe != null).map((e) => e.barisKe as number));
    plan.rowBerhasil = baris.filter((b) => !gagalSet.has(b.barisKe)).length;
    plan.status = hitungStatusImport(plan.rowBerhasil, plan.rowGagal);
    const byKodePreview = new Map<string, (typeof gurus)[number]>(byKode);
    const errorBaris = gagalSet;
    for (const b of baris) {
      if (errorBaris.has(b.barisKe)) continue;
      const ada = byKodePreview.get(b.kode);
      if (!ada) {
        plan.baru.push({ nama: b.nama, kode: b.kode, akunAkanDibuat: true });
        plan.akunBaruRencana += 1;
      } else {
        const namaBerubah = b.nama !== ada.nama;
        const nipBerubah = !!b.nip && b.nip !== (ada.nip ?? "");
        const teleponBerubah = !!b.telepon && b.telepon !== (ada.telepon ?? "");
        const dipulihkan = !!ada.deletedAt;
        const hanyaFormat = namaBerubah && !nipBerubah && !teleponBerubah && !dipulihkan && miripNama(b.nama, ada.nama);
        if (ada.user) plan.akunSudahAda += 1;
        else plan.akunBaruRencana += 1;
        if (namaBerubah || nipBerubah || teleponBerubah || dipulihkan) {
          plan.update.push({
            kode: b.kode,
            namaLama: ada.nama,
            namaBaru: b.nama,
            nipLama: ada.nip ?? "-",
            nipBaru: b.nip || "(tetap)",
            teleponLama: ada.telepon ?? "-",
            teleponBaru: b.telepon || "(tetap)",
            dipulihkan,
            hanyaFormat,
          });
        } else {
          plan.sama += 1;
        }
      }
    }
    return plan;
  }

  if (plan.errorItems.length > 0) {
    plan.rowGagal = hitungRowGagalUnik(plan.errorItems);
    plan.rowBerhasil = 0;
    plan.status = "failed";
    return plan;
  }

  for (const b of baris) {
    const ada = byKode.get(b.kode);
    if (!ada) {
      try {
        // Rencana lokal per baris — baru masuk ke hasil utama SETELAH tx commit.
        const kred = await runTx((tx) => buatGuruDanAkunDalamTx(tx, b));
        plan.baru.push({ nama: b.nama, kode: b.kode, akunAkanDibuat: true });
        plan.akunBaruRencana += 1;
        if (kred) (plan.akunBaru ??= []).push(kred);
        plan.rowBerhasil += 1;
      } catch (e) {
        plan.rowGagal += 1;
        const item: ImportErrorItem = { barisKe: b.barisKe, pesan: sanitasiPesanImportError(e, b.label) };
        plan.errorItems.push(item);
        plan.error.push(formatImportError(item));
        console.error("[import-guru] gagal baris baru", b.barisKe, b.kode, e instanceof Error ? e.message : e);
      }
      continue;
    }

    const namaBerubah = b.nama !== ada.nama;
    const nipBerubah = !!b.nip && b.nip !== (ada.nip ?? "");
    const teleponBerubah = !!b.telepon && b.telepon !== (ada.telepon ?? "");
    const dipulihkan = !!ada.deletedAt;
    const akunLama = ada.user;

    const hanyaFormat = namaBerubah && !nipBerubah && !teleponBerubah && !dipulihkan && miripNama(b.nama, ada.nama);
    const rencanaUpdate =
      namaBerubah || nipBerubah || teleponBerubah || dipulihkan
        ? {
            kode: b.kode,
            namaLama: ada.nama,
            namaBaru: b.nama,
            nipLama: ada.nip ?? "-",
            nipBaru: b.nip || "(tetap)",
            teleponLama: ada.telepon ?? "-",
            teleponBaru: b.telepon || "(tetap)",
            dipulihkan,
            hanyaFormat,
          }
        : null;
    try {
      const kred = await runTx((tx) => perbaruiGuruDanAkunDalamTx(tx, ada, b));
      if (rencanaUpdate) plan.update.push(rencanaUpdate);
      else plan.sama += 1;
      if (akunLama) plan.akunSudahAda += 1;
      else if (kred) {
        (plan.akunBaru ??= []).push(kred);
        plan.akunBaruRencana += 1;
      }
      plan.rowBerhasil += 1;
    } catch (e) {
      plan.rowGagal += 1;
      const item: ImportErrorItem = { barisKe: b.barisKe, pesan: sanitasiPesanImportError(e, b.label) };
      plan.errorItems.push(item);
      plan.error.push(formatImportError(item));
      console.error("[import-guru] gagal baris update", b.barisKe, b.kode, e instanceof Error ? e.message : e);
    }
  }

  plan.status = hitungStatusImport(plan.rowBerhasil, plan.rowGagal);

  return plan;
}
