import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { apiAktif } from "@/lib/api-auth";
import { HARI_LABEL, STATUS_ABSENSI_LABEL, STATUS_PERTEMUAN_LABEL, STATUS_JURNAL_LABEL } from "@/lib/constants";
import { formatTanggal } from "@/lib/utils";
import { hitungKelengkapanPerGuru, namaGuruPertemuan, wherePertemuanGuruAkun } from "@/lib/laporan";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

function res(xlsx: ExcelJS.Workbook, namaFile: string) {
  return xlsx.xlsx.writeBuffer().then((buffer) =>
    new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${namaFile}.xlsx"`,
      },
    })
  );
}

const HEAD = { font: { bold: true }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } }, color: { argb: "FFFFFFFF" } } as const;

export async function GET(req: NextRequest) {
  const auth = await apiAktif();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const user = auth.user;
  const t = req.nextUrl.searchParams.get("t") ?? "jurnal";
  const bulan = req.nextUrl.searchParams.get("bulan") ?? new Date().toISOString().slice(0, 7);
  const kelasId = req.nextUrl.searchParams.get("kelas") ?? "";

  // Scope sama seperti halaman /laporan: hanya peran GURU yang melihat/mengekspor
  // jurnal & kelengkapan miliknya sendiri. Waka/Kamad (walau terhubung ke data
  // guru) melihat semua guru — tombol export harus konsisten dgn tabel layar.
  const isGuru = user.role === "GURU";
  const guruId = user.guruId ?? "";

  // Absensi belum jadi absensi resmi madrasah — ekspor rekap kehadiran hanya
  // untuk Guru (catatan kelas sendiri) dan Admin. Kamad & Waka ditolak.
  const bisaAbsensi = isGuru || ["ADMIN", "SUPERADMIN"].includes(user.role);
  if (t === "absensi" && !bisaAbsensi) {
    return NextResponse.json({ error: "Rekap absensi belum tersedia untuk peran ini." }, { status: 403 });
  }

  const tanggalFilter = /^\d{4}-\d{2}-\d{2}$/.test(req.nextUrl.searchParams.get("tanggal") ?? "")
    ? req.nextUrl.searchParams.get("tanggal")!
    : "";
  let start: Date, end: Date;
  if (tanggalFilter) {
    const base = new Date(tanggalFilter);
    const y = base.getUTCFullYear(), m = base.getUTCMonth(), d = base.getUTCDate();
    start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
    end = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
  } else {
    const [tahunBulan, bulanNum] = bulan.split("-").map(Number);
    start = new Date(Date.UTC(tahunBulan, bulanNum - 1, 1, 0, 0, 0, 0));
    const endDay = new Date(Date.UTC(tahunBulan, bulanNum, 0));
    end = new Date(Date.UTC(endDay.getUTCFullYear(), endDay.getUTCMonth(), endDay.getUTCDate(), 23, 59, 59, 999));
  }
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistem Administrasi Guru";

  // ---------- Laporan jurnal ----------
  if (t === "jurnal") {
    const ws = wb.addWorksheet("Jurnal");
    const whereP: Prisma.PertemuanWhereInput = { tanggal: { gte: start, lte: end } };
    if (isGuru && guruId && user?.id) {
      whereP.OR = wherePertemuanGuruAkun(guruId, user.id).OR;
    }
    if (kelasId && !isGuru) whereP.OR = [{ kelasId }, { jadwal: { kelasId } }];
    const pertemuan = await prisma.pertemuan.findMany({
      where: whereP,
      include: { jadwal: { include: { kelas: true, mapel: true, guru: true } }, kelas: true, mapel: true, dibuatOleh: { select: { id: true, nama: true, guruId: true } }, jurnal: true, _count: { select: { absensi: true } } },
      orderBy: { tanggal: "asc" },
    });
    ws.columns = [
      { header: "Tanggal", key: "tgl", width: 14 },
      { header: "Hari", key: "hari", width: 10 },
      { header: "Kelas", key: "kelas", width: 8 },
      { header: "Mapel", key: "mapel", width: 24 },
      { header: "Guru", key: "guru", width: 26 },
      { header: "Pertemuan", key: "ke", width: 10 },
      { header: "Sumber", key: "sumber", width: 10 },
      { header: "Alasan Manual", key: "alasan", width: 26 },
      { header: "Materi", key: "materi", width: 32 },
      { header: "Kegiatan", key: "kegiatan", width: 40 },
      { header: "Metode", key: "metode", width: 22 },
      { header: "Kendala", key: "kendala", width: 30 },
      { header: "Tindak Lanjut", key: "tindak", width: 32 },
      { header: "Status Jurnal", key: "statusJurnal", width: 12 },
      { header: "Status Pertemuan", key: "statusP", width: 14 },
      { header: "Jml Absensi", key: "absensi", width: 10 },
    ];
    ws.getRow(1).eachCell((c) => { c.style = HEAD; });
    for (const p of pertemuan) {
      const kelas = p.kelas ?? p.jadwal?.kelas;
      const mapel = p.mapel ?? p.jadwal?.mapel;
      ws.addRow({
        tgl: formatTanggal(p.tanggal, "yyyy-MM-dd"),
        hari: p.jadwal ? HARI_LABEL[p.jadwal.hari] : "-",
        kelas: kelas?.nama ?? "-",
        mapel: mapel?.nama ?? "-",
        guru: namaGuruPertemuan(p) ?? "-",
        ke: p.pertemuanKe,
        sumber: p.sumber === "MANUAL" ? "Manual" : "Otomatis",
        alasan: p.sumber === "MANUAL" ? (p.alasanManual ?? "") : "",
        materi: p.jurnal?.materi ?? "",
        kegiatan: p.jurnal?.kegiatan ?? "",
        metode: p.jurnal?.metode ?? "",
        kendala: p.jurnal?.kendala ?? "",
        tindak: p.jurnal?.tindakLanjut ?? "",
        statusJurnal: p.jurnal ? STATUS_JURNAL_LABEL[p.jurnal.status] : "Belum diisi",
        statusP: STATUS_PERTEMUAN_LABEL[p.status],
        absensi: p._count.absensi,
      });
    }
    return res(wb, `laporan-jurnal-${bulan}`);
  }

  // ---------- Laporan absensi harian per kelas (satu data per kelas per hari) ----------
  if (t === "absensi") {
    const ws = wb.addWorksheet("Absensi");
    const filterAH: Record<string, unknown> = {
      tanggal: { gte: start, lte: end },
      ...(isGuru && guruId
        ? {
            OR: [
              { pengisiId: user.id },
              { kelas: { jadwal: { some: { guruId } } } },
            ],
          }
        : {}),
      ...(!isGuru && kelasId ? { kelasId } : {}),
    };
    const items = await prisma.absensiHarianItem.findMany({
      where: { absensiHarian: filterAH },
      include: { siswa: { include: { kelas: true } }, absensiHarian: { include: { kelas: true, pengisi: true } } },
      orderBy: [{ siswa: { nama: "asc" } }, { absensiHarian: { tanggal: "asc" } }],
      take: 20000,
    });
    ws.columns = [
      { header: "Tanggal", key: "tgl", width: 14 },
      { header: "Kelas", key: "kelas", width: 8 },
      { header: "Nama Siswa", key: "nama", width: 30 },
      { header: "NIS", key: "nis", width: 12 },
      { header: "Diisi Oleh", key: "pengisi", width: 26 },
      { header: "Status", key: "status", width: 14 },
      { header: "Catatan", key: "catatan", width: 26 },
    ];
    ws.getRow(1).eachCell((c) => { c.style = HEAD; });
    for (const a of items) {
      ws.addRow({
        tgl: formatTanggal(a.absensiHarian.tanggal, "yyyy-MM-dd"),
        kelas: a.siswa.kelas?.nama ?? a.absensiHarian.kelas?.nama ?? "-",
        nama: a.siswa.nama,
        nis: a.siswa.nis ?? "",
        pengisi: a.absensiHarian.pengisi?.nama ?? "-",
        status: STATUS_ABSENSI_LABEL[a.status],
        catatan: a.catatan ?? "",
      });
    }
    return res(wb, `laporan-absensi-${bulan}`);
  }

  // ---------- Laporan kelengkapan (periodik mengikuti bulan — waka/admin/kamad semua guru; guru hanya dirinya) ----------
  // Guru tanpa pertemuan bulan itu (0/0) disembunyikan secara default agar hasil
  // export konsisten dgn tabel; beri &semua=1 untuk menyertakan seluruh guru.
  const tampilSemuaGuru = req.nextUrl.searchParams.get("semua") === "1";
  const ws = wb.addWorksheet("Kelengkapan");
  const whereKelengkapan: Prisma.PertemuanWhereInput = { tanggal: { gte: start, lte: end } };
  if (isGuru && guruId && user?.id) {
    whereKelengkapan.OR = wherePertemuanGuruAkun(guruId, user.id).OR;
  }
  const pertemuan = await prisma.pertemuan.findMany({
    where: whereKelengkapan,
    include: { jadwal: { include: { guru: true } }, dibuatOleh: { select: { id: true, nama: true, guruId: true } }, jurnal: true },
  });
  const gurus = isGuru && guruId
    ? await prisma.guru.findMany({ where: { id: guruId, status: true, deletedAt: null }, orderBy: { nama: "asc" } })
    : await prisma.guru.findMany({ where: { status: true, deletedAt: null }, orderBy: { nama: "asc" } });
  ws.columns = [
    { header: "Guru", key: "guru", width: 30 },
    { header: "Total Pertemuan", key: "total", width: 16 },
    { header: "Lengkap", key: "lengkap", width: 12 },
    { header: "Jurnal Manual", key: "manual", width: 14 },
    { header: "Persentase", key: "persen", width: 12 },
  ];
  ws.getRow(1).eachCell((c) => { c.style = HEAD; });
  const perGuru = hitungKelengkapanPerGuru(
    pertemuan,
    gurus.map((g) => ({ id: g.id, nama: g.nama }))
  );
  const perGuruTampil = !isGuru && !tampilSemuaGuru ? perGuru.filter((g) => g.total > 0) : perGuru;
  for (const g of perGuruTampil) {
    ws.addRow({
      guru: g.nama,
      total: g.total,
      lengkap: g.lengkap,
      manual: g.manual,
      persen: g.total ? `${Math.round((g.lengkap / g.total) * 100)}%` : "0%",
    });
  }
  return res(wb, `laporan-kelengkapan-jurnal-${bulan}`);
}
