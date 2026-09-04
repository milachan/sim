import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { apiAktif } from "@/lib/api-auth";
import { normText } from "@/lib/constants";
import { cariSemesterAktif } from "@/lib/semester";
import { validasiJadwal } from "@/lib/jadwal-validasi";
import { prosesSiswa } from "@/lib/import-siswa";
import { importJadwalBaru, type BarisJadwalItem } from "@/lib/import-jadwal";
import { susunBarisJadwal, type FormatJadwal } from "@/lib/kolom-jadwal";
import type { Hari } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HARI_ALIAS: Record<string, Hari> = {
  SENIN: "SENIN", SELASA: "SELASA", RABU: "RABU", KAMIS: "KAMIS", JUMAT: "JUMAT", SABTU: "SABTU",
  Senin: "SENIN", Selasa: "SELASA", Rabu: "RABU", Kamis: "KAMIS", Jumat: "JUMAT", Sabtu: "SABTU",
  senin: "SENIN", selasa: "SELASA", rabu: "RABU", kamis: "KAMIS", jumat: "JUMAT", sabtu: "SABTU",
};

async function parseXlsx(bytes: Uint8Array): Promise<{ format: FormatJadwal; rows: string[][] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("File Excel tidak memiliki sheet.");

  let header: string[] | null = null;
  const rows: string[][] = [];
  ws.eachRow((row) => {
    const values = row.values as unknown[];
    const cells = values.slice(1).map((v) => (v == null ? "" : String(v).trim()));
    if (cells.every((c) => !c)) return; // baris kosong
    if (!header) {
      header = cells;
      return;
    }
    rows.push(cells);
  });

  // Deteksi format & sesuaikan kolom (kolom Waktu opsional — isinya tidak
  // pernah dipakai; waktu tampil otomatis dari pengaturan jam pelajaran per
  // hari). Lihat lib/kolom-jadwal.ts untuk bentuk header tiap format.
  if (!header) return { format: "lama" as FormatJadwal, rows };
  return susunBarisJadwal(header, rows);
}

// ================= IMPORT JADWAL (format lama) =================
// HARI | JAM MULAI | JAM SELESAI | NAMA GURU | KELAS | MATA PELAJARAN
// Tetap didukung; nama guru/kelas/mapel harus persis dengan data yang ada.
// Mendukung mode preview → eksekusi, sama seperti format baru: preview tidak
// pernah menulis ke database.

type HasilImportJadwalLama = { dibuat: number; dilewati: number; bentrok: number; error: string[]; rows: BarisJadwalItem[] };

async function importJadwalLama(
  rows: string[][],
  semester: { id: string },
  mode: "preview" | "exec"
): Promise<HasilImportJadwalLama> {
  const [gurus, kelasList, mapelList] = await Promise.all([
    prisma.guru.findMany({ where: { deletedAt: null } }),
    prisma.kelas.findMany(),
    prisma.mataPelajaran.findMany(),
  ]);
  const kelasByNama = new Map(kelasList.map((k) => [normText(k.nama), k]));
  const mapelByNama = new Map(mapelList.map((m) => [normText(m.nama), m]));
  // Format lama tidak punya kolom Kode — kalau ada dua guru senama di database,
  // jangan diam-diam memilih guru terakhir yang dimuat.
  const guruByNama = new Map<string, (typeof gurus)[number]>();
  const namaGuruCount = new Map<string, number>();
  for (const g of gurus) {
    const n = normText(g.nama);
    namaGuruCount.set(n, (namaGuruCount.get(n) ?? 0) + 1);
    guruByNama.set(n, g);
  }

  // Eksekusi menjalankan pratinjau dulu — jika ada error, nol write (konsisten
  // dengan format baru).
  if (mode === "exec") {
    const preflight = await importJadwalLama(rows, semester, "preview");
    if (preflight.error.length > 0) {
      return { dibuat: 0, dilewati: preflight.dilewati, bentrok: preflight.bentrok, error: preflight.error, rows: preflight.rows };
    }
  }

  let dibuat = 0;
  let dilewati = 0;
  let bentrok = 0;
  const error: string[] = [];
  const rowsDetail: BarisJadwalItem[] = [];
  // Jadwal yang sudah diterima dari file ini — agar bentrok antar-baris dalam
  // file yang sama terdeteksi di preview maupun exec secara konsisten.
  const fileSchedules: { guruId: string; kelasId: string; hari: Hari; mulai: number; selesai: number }[] = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const cells = rows[idx];
    const barisKe = idx + 2;
    const [hariRaw = "", mulaiRaw = "", selesaiRaw = "", guruNama = "", kelasNama = "", mapelNama = ""] = cells;
    const hari = HARI_ALIAS[hariRaw.trim()];
    const mulai = Number(mulaiRaw);
    const selesai = Number(selesaiRaw);
    const rowLabel = `${hariRaw} ${mulaiRaw}-${selesaiRaw} ${kelasNama} ${mapelNama}`.trim();
    const catatBaris = (status: BarisJadwalItem["status"]) => rowsDetail.push({ barisKe, teks: rowLabel, status });

    if (!hari || !guruNama || !kelasNama || !mapelNama) {
      error.push(`Baris "${rowLabel}": hari/guru/kelas/mapel wajib diisi.`);
      dilewati++;
      catatBaris("blokir");
      continue;
    }
    const guru = guruByNama.get(normText(guruNama));
    const kelas = kelasByNama.get(normText(kelasNama));
    const mapel = mapelByNama.get(normText(mapelNama));
    if (!guru) {
      error.push(`Baris "${rowLabel}": guru "${guruNama}" tidak ditemukan.`);
      dilewati++;
      catatBaris("blokir");
      continue;
    }
    if ((namaGuruCount.get(normText(guruNama)) ?? 1) > 1) {
      const kodeLain = gurus
        .filter((g) => normText(g.nama) === normText(guruNama) && g.kode)
        .map((g) => g.kode)
        .join(", ");
      error.push(
        `Baris "${rowLabel}": nama "${guruNama}" cocok dengan beberapa guru di database${kodeLain ? ` (kode ${kodeLain})` : ""} — format lama tidak bisa membedakannya. Gunakan template baru yang memakai kolom Kode.`
      );
      dilewati++;
      catatBaris("blokir");
      continue;
    }
    if (!kelas) {
      error.push(`Baris "${rowLabel}": kelas "${kelasNama}" tidak ditemukan.`);
      dilewati++;
      catatBaris("blokir");
      continue;
    }
    if (!mapel) {
      error.push(`Baris "${rowLabel}": mapel "${mapelNama}" tidak ditemukan.`);
      dilewati++;
      catatBaris("blokir");
      continue;
    }

    const bentrokInFile = fileSchedules.some(
      (s) => s.hari === hari && (s.kelasId === kelas.id || s.guruId === guru.id) && s.mulai <= selesai && s.selesai >= mulai
    );
    if (bentrokInFile) {
      error.push(`Baris "${rowLabel}": Bentrok — ${hariRaw} jam ke-${mulai}–${selesai} sudah terisi guru/kelas yang sama oleh baris lain di file ini.`);
      bentrok++;
      dilewati++;
      catatBaris("bentrok");
      continue;
    }

    {
      const existing = await prisma.jadwal.findMany({ where: { semesterId: semester.id, hari }, select: { id: true, guruId: true, kelasId: true, hari: true, jamKeMulai: true, jamKeSelesai: true, semesterId: true } });
      const v = await validasiJadwal(
        { guruId: guru.id, kelasId: kelas.id, mapelId: mapel.id, hari, jamKeMulai: mulai, jamKeSelesai: selesai, semesterId: semester.id },
        existing
      );
      if (!v.ok) {
        if (v.error.includes("Bentrok")) bentrok++;
        error.push(`Baris "${rowLabel}": ${v.error}`);
        dilewati++;
        catatBaris(v.error.includes("Bentrok") ? "bentrok" : "blokir");
        continue;
      }
    }

    {
      const duplikat = await prisma.jadwal.findFirst({
        where: { semesterId: semester.id, kelasId: kelas.id, hari, jamKeMulai: mulai, jamKeSelesai: selesai, mapelId: mapel.id },
      });
      if (duplikat) {
        error.push(`Baris "${rowLabel}": sudah ada jadwal identik.`);
        dilewati++;
        catatBaris("dilewati");
        continue;
      }
    }

    fileSchedules.push({ guruId: guru.id, kelasId: kelas.id, hari, mulai, selesai });
    dibuat++;
    catatBaris("baru");
    if (mode === "exec") {
      await prisma.jadwal.create({
        data: { guruId: guru.id, kelasId: kelas.id, mapelId: mapel.id, semesterId: semester.id, hari, jamKeMulai: mulai, jamKeSelesai: selesai },
      });
    }
  }

  return { dibuat, dilewati, bentrok, error, rows: rowsDetail };
}



// ================= ROUTE =================

export async function POST(req: NextRequest) {
  const auth = await apiAktif(["ADMIN", "SUPERADMIN"] as const);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const form = await req.formData();
    const tipe = String(form.get("tipe") ?? "siswa");
    const preview = form.get("preview") === "1";
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".xlsx") && !file.name.toLowerCase().endsWith(".xls")) {
      return NextResponse.json({ error: "Format harus .xlsx atau .xls." }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { format, rows } = await parseXlsx(bytes);
    if (rows.length === 0) {
      return NextResponse.json({ error: "File kosong — tidak ada baris data." }, { status: 400 });
    }

    // ---------- Siswa ----------
    // Kunci sinkron = NISN. Selalu lewat pratinjau dulu (preview=1) sebelum
    // dieksekusi (preview=0) — perubahan data lama butuh konfirmasi admin.
    if (tipe !== "jadwal") {
      const hasil = await prosesSiswa(bytes, preview ? "preview" : "exec");
      if (hasil.dilewati > 0 && hasil.baru.length === 0 && hasil.update.length === 0 && hasil.konflik.length === 0 && hasil.sama === 0) {
        return NextResponse.json({ ok: false, teks: "Tidak ada baris yang bisa diproses — periksa pesan kesalahan di bawah.", ...hasil }, { status: 200 });
      }
      return NextResponse.json({
        ok: true,
        tipe: "siswa",
        preview,
        ...hasil,
        teks:
          hasil.baru.length === 0 && hasil.update.length === 0 && hasil.konflik.length === 0 && hasil.sama > 0
            ? "Semua data sudah sama — tidak ada perubahan."
            : undefined,
      });
    }

    // ---------- Jadwal ----------
    if (format === "terpisah" || format === "gabung") {
      const semesterId = String(form.get("semesterId") ?? "").trim();
      if (!semesterId) {
        return NextResponse.json(
          { error: "Pilih tahun ajaran & periode tujuan dulu — jadwal yang diupload harus masuk ke periode tertentu." },
          { status: 400 }
        );
      }
      const semester = await prisma.semester.findFirst({ where: { id: semesterId, deletedAt: null }, include: { tahunAjaran: true } });
      if (!semester) {
        return NextResponse.json({ error: "Periode tujuan tidak ditemukan." }, { status: 400 });
      }
      const hasil = await importJadwalBaru(
        rows,
        { id: semester.id, nama: `${semester.nama} (${semester.tahunAjaran.nama})` },
        format,
        preview ? "preview" : "exec"
      );
      return NextResponse.json({ ok: true, tipe: "jadwal", ...hasil });
    }

    // Format lama: pakai semester aktif (kompatibilitas). Sama seperti format
    // baru, pratinjau TIDAK menulis ke database — eksekusi hanya setelah
    // admin mengonfirmasi.
    const semester = await cariSemesterAktif();
    if (!semester) {
      return NextResponse.json(
        { error: "Belum ada semester aktif. Atur tahun ajaran & semester dulu." },
        { status: 400 }
      );
    }
    const hasil = await importJadwalLama(rows, semester, preview ? "preview" : "exec");
    const jadwalSebelumnya = await prisma.jadwal.count({ where: { semesterId: semester.id } });
    return NextResponse.json({
      ok: true,
      tipe: "jadwal",
      format: "lama",
      preview,
      siapEksekusi: hasil.error.length === 0,
      jadwalSebelumnya,
      jadwalBaru: hasil.dibuat,
      dilewati: hasil.dilewati,
      bentrok: hasil.bentrok,
      barisJadwal: hasil.rows,
      error: hasil.error,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Gagal membaca file Excel. Pastikan format sesuai template." },
      { status: 400 }
    );
  }
}
