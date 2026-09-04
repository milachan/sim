import { prisma as defaultPrisma } from "@/lib/prisma";
import { HARI_LABEL, kodeDariNamaGuru, MAPEL_KODE, mapelKanonik, namaTanpaKodeGuru, normText, tingkatDariNamaKelas } from "@/lib/constants";
import { intervalsOverlap, validasiJadwal } from "@/lib/jadwal-validasi";
import { catatRiwayatWaliKelas } from "@/lib/wali-kelas";
import type { Hari } from "@prisma/client";

/**
 * Dua nama guru dianggap "sama secara praktis" bila teks ternormalisasinya
 * identik atau salah satunya merupakan awalan yang lain (mis. "Akhmadi" vs
 * "Akhmadi, S.Pd." — beda format gelar, bukan beda orang).
 * Dipakai untuk membedakan catatan info dari tabrakan data yang harus diblokir.
 */
export function namaGuruMirip(namaFile: string, namaDb: string): boolean {
  const a = normText(namaFile);
  const b = normText(namaDb);
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

export type JadwalImportPrisma = {
  guru: { findMany: (args?: unknown) => Promise<{ id: string; nama: string; kode: string | null }[]> };
  kelas: {
    findMany: (args?: unknown) => Promise<{ id: string; nama: string; tingkat: number; waliKelasId: string | null }[]>;
    create: (args: { data: { nama: string; tingkat: number } }) => Promise<{ id: string; nama: string; tingkat: number; waliKelasId: string | null }>;
    update: (args: { where: { id: string }; data: { waliKelasId: string } }) => Promise<unknown>;
  };
  mataPelajaran: {
    findMany: (args?: unknown) => Promise<{ id: string; nama: string; kode: string | null }[]>;
    create: (args: { data: { nama: string; kode: string | null } }) => Promise<{ id: string; nama: string; kode: string | null }>;
  };
  jadwal: {
    findMany: (args: unknown) => Promise<{ id?: string; guruId?: string; kelasId?: string; hari?: Hari; jamKeMulai?: number; jamKeSelesai?: number; semesterId?: string; mapelId?: string; kelasId_hari?: unknown }[]>;
    findFirst?: (args: unknown) => Promise<unknown>;
    create: (args: { data: { guruId: string; kelasId: string; mapelId: string; semesterId: string; hari: Hari; jamKeMulai: number; jamKeSelesai: number } }) => Promise<unknown>;
  };
  semester?: { findFirst?: (args: unknown) => Promise<unknown> };
};

export type GuruTidakDitemukanItem = { barisKe: number; nama: string; kode: string | null };

export type GuruBedaNamaItem = { barisKe: number; nama: string; kode: string; namaDb: string };

/** Guru di file tidak ketemu lewat Kode tapi dicocokkan lewat nama (mis. typo kode). */
export type GuruCocokNamaItem = {
  barisKe: number;
  nama: string;
  kodeFile: string | null;
  namaDb: string;
  kodeDb: string | null;
};

/** Status satu baris file pada pratinjau/hasil — dipakai tabel ringkasan per-baris di UI. */
export type BarisJadwalItem = {
  barisKe: number;
  teks: string;
  status: "baru" | "wali" | "cocok" | "bentrok" | "dilewati" | "blokir";
};

export type JadwalImportPlan = {
  preview: boolean;
  siapEksekusi: boolean;
  semesterId: string;
  semesterNama: string;
  jadwalSebelumnya: number;
  guruTidakDitemukan: GuruTidakDitemukanItem[];
  guruBedaNama: GuruBedaNamaItem[];
  guruCocokNama: GuruCocokNamaItem[];
  barisJadwal: BarisJadwalItem[];
  guruCatatan: string[];
  duplikatNama: string[];
  mapelBaru: string[];
  kelasBaru: string[];
  waliKelas: string[];
  jadwalBaru: number;
  dilewati: number;
  bentrok: number;
  error: string[];
  guruBaru?: string[];
};

const HARI_ALIAS: Record<string, Hari> = {
  SENIN: "SENIN",
  SELASA: "SELASA",
  RABU: "RABU",
  KAMIS: "KAMIS",
  JUMAT: "JUMAT",
  SABTU: "SABTU",
  Senin: "SENIN",
  Selasa: "SELASA",
  Rabu: "RABU",
  Kamis: "KAMIS",
  Jumat: "JUMAT",
  Sabtu: "SABTU",
  senin: "SENIN",
  selasa: "SELASA",
  rabu: "RABU",
  kamis: "KAMIS",
  jumat: "JUMAT",
  sabtu: "SABTU",
};

type Ringan = { id: string; nama: string; kode?: string | null; tingkat?: number | null; waliKelasId?: string | null };

export async function importJadwalBaru(
  rows: string[][],
  semester: { id: string; nama: string },
  format: "terpisah" | "gabung",
  mode: "preview" | "exec",
  deps?: { prismaClient?: JadwalImportPrisma }
): Promise<JadwalImportPlan> {
  const db = (deps?.prismaClient ?? (defaultPrisma as unknown as JadwalImportPrisma));

  const [gurusDb, kelasDb, mapelDb, jadwalDb] = await Promise.all([
    // Guru yang di-soft-delete tidak boleh menerima jadwal baru.
    db.guru.findMany({ where: { deletedAt: null } }),
    db.kelas.findMany(),
    db.mataPelajaran.findMany(),
    db.jadwal.findMany({ where: { semesterId: semester.id }, select: { kelasId: true, hari: true, jamKeMulai: true, jamKeSelesai: true, mapelId: true } }),
  ]);

  const gurus = new Map<string, Ringan>();
  // Indeks nama → semua guru dengan nama itu (bisa lebih dari satu) — dipakai
  // untuk mendeteksi nama ambigu yang selama ini diam-diam memilih guru
  // terakhir yang dimuat (Map overwrite).
  const namaKeGurus = new Map<string, Ringan[]>();
  for (const g of gurusDb) {
    const nk = normText(g.nama);
    const arr = namaKeGurus.get(nk) ?? [];
    arr.push({ id: g.id, nama: g.nama, kode: g.kode });
    namaKeGurus.set(nk, arr);
    gurus.set(`n:${nk}`, { id: g.id, nama: g.nama, kode: g.kode });
    if (g.kode) gurus.set(`k:${g.kode.toUpperCase()}`, { id: g.id, nama: g.nama, kode: g.kode });
  }

  const kelas = new Map<string, Ringan>();
  for (const k of kelasDb) kelas.set(`n:${normText(k.nama)}`, { id: k.id, nama: k.nama, tingkat: k.tingkat, waliKelasId: k.waliKelasId });

  const mapels = new Map<string, Ringan>();
  for (const m of mapelDb) mapels.set(`n:${normText(m.nama)}`, { id: m.id, nama: m.nama, kode: m.kode });

  const plan: JadwalImportPlan = {
    preview: mode === "preview",
    siapEksekusi: false,
    semesterId: semester.id,
    semesterNama: semester.nama,
    jadwalSebelumnya: jadwalDb.length,
    guruTidakDitemukan: [],
    guruBedaNama: [],
    guruCocokNama: [],
    barisJadwal: [],
    guruCatatan: [],
    duplikatNama: [],
    mapelBaru: [],
    kelasBaru: [],
    waliKelas: [],
    jadwalBaru: 0,
    dilewati: 0,
    bentrok: 0,
    error: [],
    guruBaru: [],
  };

  const createdJadwal = new Set<string>();
  const seenGuruTidak = new Set<string>();
  const namaKodeFile = new Map<string, { nama: string; kode: Set<string> }>();
  // Baris ini berhasil dicocokkan LEWAT NAMA (kode di file tidak dikenal) —
  // dipakai untuk menandai status "cocok" pada tabel per-baris.
  let viaCocok = false;
  // Jadwal yang sudah diterima dari file ini (belum tentu di DB saat preview)
  // — dipakai agar bentrok guru/kelas antar-baris dalam file yang sama
  // terdeteksi di pratinjau, konsisten dengan perilaku saat eksekusi.
  const fileSchedules: { guruId: string; kelasId: string; hari: Hari; mulai: number; selesai: number }[] = [];

  const prosesMapel = async (namaKanonik: string): Promise<Ringan | null> => {
    const key = normText(namaKanonik);
    let m = mapels.get(`n:${key}`);
    if (!m) {
      plan.mapelBaru.push(namaKanonik);
      if (mode === "exec") {
        const created = await db.mataPelajaran.create({ data: { nama: namaKanonik, kode: MAPEL_KODE[namaKanonik] ?? null } });
        m = { id: created.id, nama: namaKanonik };
        mapels.set(`n:${key}`, m);
      } else {
        m = { id: `preview-m-${plan.mapelBaru.length}`, nama: namaKanonik };
        mapels.set(`n:${key}`, m);
      }
    }
    return m;
  };

  const prosesKelas = async (namaRaw: string): Promise<Ringan | null> => {
    const nama = namaRaw.trim();
    if (!nama) return null;
    const key = normText(nama);
    let k = kelas.get(`n:${key}`);
    if (!k) {
      const tingkat = tingkatDariNamaKelas(nama);
      if (tingkat == null) {
        plan.error.push(`Kelas "${nama}" tidak dikenali tingkatnya.`);
        return null;
      }
      plan.kelasBaru.push(nama);
      if (mode === "exec") {
        const created = await db.kelas.create({ data: { nama, tingkat } });
        k = { id: created.id, nama, tingkat };
        kelas.set(`n:${key}`, k);
      } else {
        k = { id: `preview-k-${plan.kelasBaru.length}`, nama, tingkat };
        kelas.set(`n:${key}`, k);
      }
    }
    return k;
  };

  const resolveGuru = (kode: string | null, nama: string, barisKe: number): Ringan | null => {
    if (!nama) return null;
    // 1) Kode adalah kunci sinkron — cocok dulu lewat kode.
    const byKode = kode ? gurus.get(`k:${kode}`) : undefined;
    if (byKode) {
      if (byKode.nama !== nama && kode) {
        // Nama di file yang beda format (gelar, dll.) hanya dicatat. Nama yang
        // BEDA TOTAL dari pemilik kode = tabrakan data: jadwal tidak boleh
        // diam-diam menempel ke guru lain → baris diblokir.
        if (namaGuruMirip(nama, byKode.nama)) {
          const catatan = `${kode}: "${nama}" (DB: "${byKode.nama}")`;
          if (!plan.guruCatatan.includes(catatan)) plan.guruCatatan.push(catatan);
        } else {
          plan.guruBedaNama.push({ barisKe, nama, kode, namaDb: byKode.nama });
          plan.error.push(
            `Baris ${barisKe} — Kode ${kode} di file tertulis untuk "${nama}" tapi di database milik "${byKode.nama}". Perbaiki kode/nama di file — jadwal untuk baris ini tidak dibuat.`
          );
          return null;
        }
      }
      return byKode;
    }

    // 2) Kode tidak dikenal (atau tidak ditulis): coba lewat nama — tapi jangan
    // diam-diam menebak bila ada lebih dari satu guru dengan nama yang sama.
    const kandidat = namaKeGurus.get(normText(nama)) ?? [];
    if (kandidat.length === 0) {
      const key = `${barisKe}|${kode ?? ""}|${normText(nama)}`;
      if (!seenGuruTidak.has(key)) {
        seenGuruTidak.add(key);
        plan.guruTidakDitemukan.push({ barisKe, nama, kode });
        const label = kode ? `"${nama}" (kode ${kode})` : `"${nama}"`;
        plan.error.push(`Baris ${barisKe} — Guru ${label} tidak ditemukan — jalankan Import Guru terlebih dahulu.`);
      }
      return null;
    }
    if (kandidat.length > 1) {
      const daftarKode = kandidat.map((x) => (x.kode ? `kode ${x.kode}` : "tanpa kode")).join(", ");
      const denganKode = kandidat.every((x) => x.kode);
      const saran = denganKode
        ? ` Ada ${kandidat.length} guru bernama sama di database (${daftarKode}) — tulis KODE yang benar di kolom Kode agar jadwal tidak menempel ke guru yang salah.`
        : ` Ada ${kandidat.length} guru bernama sama di database. Lengkapi data guru dengan KODE unik, lalu tulis KODE-nya di file.`;
      plan.error.push(`Baris ${barisKe} — nama "${nama}" ambigu.${saran}`);
      return null;
    }
    // Satu kandidat: cocok lewat nama. Bila file menulis kode yang tidak dikenal
    // tapi namanya jelas (mis. typo K6 vs K5), tampilkan itu sebagai info
    // eksplisit — bukan penempelan jadwal yang senyap.
    const g = kandidat[0];
    if (kode && g.kode && g.kode.toUpperCase() !== kode) {
      plan.guruCocokNama.push({ barisKe, nama, kodeFile: kode, namaDb: g.nama, kodeDb: g.kode });
      viaCocok = true;
    } else if (kode && !g.kode) {
      plan.guruCocokNama.push({ barisKe, nama, kodeFile: kode, namaDb: g.nama, kodeDb: null });
      viaCocok = true;
    }
    return g;
  };

  if (mode === "exec") {
    const preflight = await importJadwalBaru(rows, semester, format, "preview", deps);
    if (!preflight.siapEksekusi) {
      return { ...preflight, preview: false, jadwalBaru: 0, kelasBaru: [], mapelBaru: [], waliKelas: [] };
    }
  }

  for (let idx = 0; idx < rows.length; idx++) {
    const cells = rows[idx];
    const barisKe = idx + 2;
    let guruRaw: string, kodeRaw: string, hariRaw: string, jamKeRaw: string, mapelRaw: string, kelasRaw: string;
    if (format === "terpisah") {
      [guruRaw = "", kodeRaw = "", hariRaw = "", jamKeRaw = "", , mapelRaw = "", kelasRaw = ""] = cells;
    } else {
      [guruRaw = "", hariRaw = "", jamKeRaw = "", , mapelRaw = "", kelasRaw = ""] = cells;
      kodeRaw = "";
    }
    const hari = HARI_ALIAS[hariRaw.trim()];
    const mapelNama = mapelKanonik(mapelRaw.trim());
    const rowLabel = `${hariRaw} jam ${jamKeRaw} ${kelasRaw} ${mapelNama}`.trim();
    // Catat status baris ini untuk tabel ringkasan per-baris di UI.
    const catatBaris = (status: BarisJadwalItem["status"], teks: string = rowLabel) => {
      plan.barisJadwal.push({ barisKe, teks, status });
    };

    if (!hari || !guruRaw || !kelasRaw || !mapelRaw) {
      plan.error.push(`Baris "${rowLabel}": guru/hari/kelas/mapel wajib diisi.`);
      plan.dilewati++;
      catatBaris("blokir");
      continue;
    }

    const kode = (kodeRaw.trim() || kodeDariNamaGuru(guruRaw) || "").toUpperCase() || null;
    const nama = namaTanpaKodeGuru(guruRaw);
    if (kode && nama) {
      const nk = namaKodeFile.get(normText(nama)) ?? { nama, kode: new Set<string>() };
      nk.kode.add(kode);
      namaKodeFile.set(normText(nama), nk);
    }
    viaCocok = false;
    const guru = resolveGuru(kode, nama, barisKe);
    if (!guru) {
      plan.dilewati++;
      catatBaris("blokir");
      continue;
    }

    if (normText(mapelRaw) === "walikelas") {
      const kelasItem = await prosesKelas(kelasRaw);
      if (!kelasItem) {
        plan.dilewati++;
        catatBaris("blokir");
        continue;
      }
      plan.waliKelas.push(`${kelasItem.nama} → ${guru.nama}`);
      if (mode === "exec" && kelasItem.waliKelasId !== guru.id) {
        await db.kelas.update({ where: { id: kelasItem.id }, data: { waliKelasId: guru.id } });
        kelasItem.waliKelasId = guru.id;
        await catatRiwayatWaliKelas(kelasItem.id, guru.id, semester.id);
      }
      catatBaris("wali");
      continue;
    }

    const kelasItem = await prosesKelas(kelasRaw);
    if (!kelasItem) {
      plan.dilewati++;
      catatBaris("blokir");
      continue;
    }

    const mapel = await prosesMapel(mapelNama);
    if (!mapel) {
      plan.dilewati++;
      catatBaris("blokir");
      continue;
    }

    let mulai: number, selesai: number;
    if (/^\d+$/.test(jamKeRaw)) {
      mulai = selesai = Number(jamKeRaw);
    } else if (jamKeRaw.includes("-")) {
      const [a, b] = jamKeRaw.split("-").map((s) => Number(s.trim()));
      mulai = a;
      selesai = b;
    } else {
      plan.error.push(`Baris "${rowLabel}": jam ke tidak valid ("${jamKeRaw}").`);
      plan.dilewati++;
      catatBaris("blokir");
      continue;
    }
    // Bentrok dengan baris lain DALAM FILE yang sama (guru atau kelas dobel pada
    // hari & jam yang sama) — dicek di preview maupun exec agar konsisten.
    const bentrokInFile = fileSchedules.some(
      (s) => s.hari === hari && (s.kelasId === kelasItem.id || s.guruId === guru.id) && intervalsOverlap(mulai, selesai, s.mulai, s.selesai)
    );
    if (bentrokInFile) {
      plan.bentrok++;
      plan.dilewati++;
      plan.error.push(
        `Baris "${rowLabel}": Bentrok — ${HARI_LABEL[hari]} jam ke-${mulai}–${selesai} sudah terisi guru/kelas yang sama oleh baris lain di file ini.`
      );
      catatBaris("bentrok");
      continue;
    }

    {
      const jadwalExistingForCheck = await db.jadwal.findMany({ where: { semesterId: semester.id, hari }, select: { id: true, guruId: true, kelasId: true, hari: true, jamKeMulai: true, jamKeSelesai: true, semesterId: true } });
      const v = await validasiJadwal(
        { guruId: guru.id, kelasId: kelasItem.id, mapelId: mapel.id, hari, jamKeMulai: mulai, jamKeSelesai: selesai, semesterId: semester.id },
        jadwalExistingForCheck as never
      );
      if (!v.ok) {
        if (v.error.includes("Bentrok")) plan.bentrok++;
        plan.dilewati++;
        plan.error.push(`Baris "${rowLabel}": ${v.error}`);
        catatBaris(v.error.includes("Bentrok") ? "bentrok" : "blokir");
        continue;
      }
    }

    const key = `${kelasItem.id}|${hari}|${mulai}-${selesai}|${mapel.id}`;
    if (createdJadwal.has(key)) {
      plan.dilewati++;
      catatBaris("dilewati");
      continue;
    }
    const duplikat = (jadwalDb as { kelasId: string; hari: Hari; jamKeMulai: number; jamKeSelesai: number; mapelId: string }[]).find(
      (j) => j.kelasId === kelasItem.id && j.hari === hari && j.jamKeMulai === mulai && j.jamKeSelesai === selesai && j.mapelId === mapel.id
    );
    if (duplikat) {
      plan.dilewati++;
      catatBaris("dilewati");
      continue;
    }
    createdJadwal.add(key);
    fileSchedules.push({ guruId: guru.id, kelasId: kelasItem.id, hari, mulai, selesai });
    plan.jadwalBaru++;
    catatBaris(viaCocok ? "cocok" : "baru");
    if (mode === "exec") {
      await db.jadwal.create({
        data: { guruId: guru.id, kelasId: kelasItem.id, mapelId: mapel.id, semesterId: semester.id, hari, jamKeMulai: mulai, jamKeSelesai: selesai },
      });
    }
  }

  for (const { nama, kode } of namaKodeFile.values()) {
    const kodeList = [...kode];
    if (kodeList.length > 1) {
      const msg = `${nama} → kode ${kodeList.join(", ")}`;
      plan.duplikatNama.push(msg);
      plan.error.push(`Nama "${nama}" muncul dengan kode berbeda (${kodeList.join(", ")}) — periksa typo kode.`);
    }
  }

  plan.siapEksekusi = plan.error.length === 0 && plan.guruTidakDitemukan.length === 0 && plan.duplikatNama.length === 0;

  return plan;
}
