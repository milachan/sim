import Link from "next/link";
import { CalendarDays, CalendarRange, ClipboardCheck, Info } from "lucide-react";
import { format } from "date-fns";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, PageHeader, StatCard, TableRow, TableShell, Td, Th } from "@/components/ui";
import { SelectNavigasi } from "@/components/select-navigasi";
import { STATUS_ABSENSI_BADGE, STATUS_ABSENSI_LABEL } from "@/lib/constants";
import { formatTanggal, mulaiHari, persen } from "@/lib/utils";
import type { StatusAbsensi } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUSES: StatusAbsensi[] = ["HADIR", "SAKIT", "IZIN", "ALPA", "TERLAMBAT", "DISPENSASI"];

/** Mode: harian = satu tanggal; bulanan = rekap satu bulan. */
type Mode = "harian" | "bulanan";

export default async function KelolaAbsensiPage({
  searchParams,
}: {
  searchParams: { mode?: string; tanggal?: string; bulan?: string; kelas?: string };
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  // Khusus akun petugas piket (pengelola absensi harian) dan Admin sebagai pemantau.
  const isPiket = user.role === "GURU" && user.guru?.jenisGuru === "PIKET" && user.guru?.kode === "PIKET";
  const isAdmin = user.role === "ADMIN" || user.role === "SUPERADMIN";
  if (!isPiket && !isAdmin) {
    return (
      <div className="fade-up">
        <PageHeader
          title="Kelola Absensi"
          subtitle="Rekap keterangan siswa dari absensi harian"
          icon={<ClipboardCheck className="h-6 w-6" />}
        />
        <EmptyState
          title="Menu ini khusus petugas piket"
          desc="Kelola absensi menampilkan rekap keterangan siswa (hadir, sakit, izin, alpa, dan lainnya) untuk pemantauan harian atau bulanan."
        />
      </div>
    );
  }

  const mode: Mode = searchParams.mode === "bulanan" ? "bulanan" : "harian";
  const kelasFilter = searchParams.kelas ?? "";

  const [kelasList] = await Promise.all([
    prisma.kelas.findMany({ orderBy: [{ tingkat: "asc" }, { nama: "asc" }] }),
  ]);
  const optsKelas = [{ value: "", label: "Semua kelas" }, ...kelasList.map((k) => ({ value: k.id, label: k.nama }))];

  // ---------- Mode harian ----------
  let tanggal = mulaiHari(new Date());
  if (searchParams.tanggal) {
    const coba = mulaiHari(searchParams.tanggal);
    if (!Number.isNaN(coba.getTime()) && coba.getTime() <= mulaiHari(new Date()).getTime()) tanggal = coba;
  }
  // WIB-safe: mulaiHari sudah ternormalisasi UTC tengah malam
  const tanggalStr = format(tanggal, "yyyy-MM-dd");
  const filterTanggal: Record<string, unknown> = { absensiHarian: { tanggal } };
  if (kelasFilter) filterTanggal.absensiHarian = { tanggal, kelasId: kelasFilter };

  const itemsHarian = await prisma.absensiHarianItem.findMany({
    where: filterTanggal,
    include: { siswa: { include: { kelas: true } } },
    orderBy: [{ siswa: { kelas: { tingkat: "asc" } } }, { siswa: { nama: "asc" } }],
  });
  const rekapHarian: Record<string, number> = { HADIR: 0, SAKIT: 0, IZIN: 0, ALPA: 0, TERLAMBAT: 0, DISPENSASI: 0 };
  for (const a of itemsHarian) rekapHarian[a.status] = (rekapHarian[a.status] ?? 0) + 1;

  // ---------- Mode bulanan ----------
  const bulan = /^\d{4}-\d{2}$/.test(searchParams.bulan ?? "")
    ? searchParams.bulan!
    : format(new Date(), "yyyy-MM");
  const [tahun, bln] = bulan.split("-").map(Number);
  const start = mulaiHari(new Date(Date.UTC(tahun, bln - 1, 1)));
  const end = new Date(Date.UTC(tahun, bln, 0, 23, 59, 59, 999));
  const filterBulan: Record<string, unknown> = { absensiHarian: { tanggal: { gte: start, lte: end } } };
  if (kelasFilter) filterBulan.absensiHarian = { ...(filterBulan.absensiHarian as object), kelasId: kelasFilter };

  const itemsBulanan = await prisma.absensiHarianItem.findMany({
    where: filterBulan,
    include: { siswa: { include: { kelas: true } } },
    orderBy: [{ siswa: { kelas: { tingkat: "asc" } } }, { siswa: { nama: "asc" } }],
  });
  // Rekap per siswa untuk bulan berjalan.
  const perSiswa = new Map<string, { siswa: (typeof itemsBulanan)[number]["siswa"]; rekap: Record<string, number> }>();
  for (const a of itemsBulanan) {
    let rec = perSiswa.get(a.siswaId);
    if (!rec) {
      rec = { siswa: a.siswa, rekap: { HADIR: 0, SAKIT: 0, IZIN: 0, ALPA: 0, TERLAMBAT: 0, DISPENSASI: 0 } };
      perSiswa.set(a.siswaId, rec);
    }
    rec.rekap[a.status] = (rec.rekap[a.status] ?? 0) + 1;
  }
  const barisBulanan = [...perSiswa.values()].sort((a, b) =>
    `${a.siswa.kelas?.nama ?? ""} ${a.siswa.nama}`.localeCompare(`${b.siswa.kelas?.nama ?? ""} ${b.siswa.nama}`)
  );
  const rekapBulan: Record<string, number> = { HADIR: 0, SAKIT: 0, IZIN: 0, ALPA: 0, TERLAMBAT: 0, DISPENSASI: 0 };
  for (const a of itemsBulanan) rekapBulan[a.status] = (rekapBulan[a.status] ?? 0) + 1;
  const totalBulanan = barisBulanan.length;
  const hadirBulanan = barisBulanan.reduce((sum, r) => sum + (r.rekap.HADIR ?? 0), 0);
  const totalCatatanBulanan = barisBulanan.reduce((s, r) => s + STATUSES.reduce((x, st) => x + (r.rekap[st] ?? 0), 0), 0);

  return (
    <div className="fade-up">
      <PageHeader
        title="Kelola Absensi"
        subtitle="Rekap keterangan siswa dari absensi harian — mode harian & bulanan"
        icon={<ClipboardCheck className="h-6 w-6" />}
      />

      {/* Mode + filter — stacked full-width on mobile */}
      <Card className="card-pad mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div>
            <label className="label">Mode</label>
            <div className="flex gap-1.5">
              <Link
                href={`/kelola-absensi?mode=harian${kelasFilter ? `&kelas=${kelasFilter}` : ""}`}
                className={`flex min-h-11 flex-1 items-center justify-center rounded-xl px-4 py-2 text-sm font-bold transition sm:flex-none ${mode === "harian" ? "bg-blue-700 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                Harian
              </Link>
              <Link
                href={`/kelola-absensi?mode=bulanan${kelasFilter ? `&kelas=${kelasFilter}` : ""}`}
                className={`flex min-h-11 flex-1 items-center justify-center rounded-xl px-4 py-2 text-sm font-bold transition sm:flex-none ${mode === "bulanan" ? "bg-blue-700 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                Bulanan
              </Link>
            </div>
          </div>

          {mode === "harian" && (
            <form method="get" className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <input type="hidden" name="mode" value="harian" />
              {kelasFilter && <input type="hidden" name="kelas" value={kelasFilter} />}
              <div className="flex-1 sm:flex-none">
                <label className="label">Tanggal</label>
                <input
                  type="date"
                  name="tanggal"
                  className="input w-full"
                  defaultValue={tanggalStr}
                  max={format(new Date(), "yyyy-MM-dd")}
                />
              </div>
              <button className="btn-primary min-h-11 w-full sm:w-auto">Tampilkan</button>
            </form>
          )}
          {mode === "bulanan" && (
            <form method="get" className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <input type="hidden" name="mode" value="bulanan" />
              {kelasFilter && <input type="hidden" name="kelas" value={kelasFilter} />}
              <div className="flex-1 sm:flex-none">
                <label className="label">Bulan</label>
                <input
                  type="month"
                  name="bulan"
                  className="input w-full"
                  defaultValue={bulan}
                  max={format(new Date(), "yyyy-MM")}
                />
              </div>
              <button className="btn-primary min-h-11 w-full sm:w-auto">Tampilkan</button>
            </form>
          )}

          <div className="w-full sm:w-auto">
            <label className="label">Kelas</label>
            <SelectNavigasi param="kelas" value={kelasFilter} options={optsKelas} />
          </div>
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Data diambil dari satu absensi harian per kelas per hari (diisi guru jam pertama, wali kelas, atau guru piket).
        </p>
      </Card>

      {mode === "harian" ? (
        <>
          {/* Statistik harian */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            <StatCard label="Tanggal" value={formatTanggal(tanggal)} sub={kelasFilter ? kelasList.find((k) => k.id === kelasFilter)?.nama : "semua kelas"} icon={<CalendarDays className="h-6 w-6" />} />
            <StatCard label="Siswa Tercatat" value={itemsHarian.length} sub="catatan absensi hari ini" color="bg-teal-600" icon={<ClipboardCheck className="h-6 w-6" />} />
            <StatCard label="Kehadiran" value={itemsHarian.length ? `${persen(rekapHarian.HADIR ?? 0, itemsHarian.length)}%` : "-"} sub="hadir dari tercatat" color="bg-emerald-600" icon={<CalendarDays className="h-6 w-6" />} />
          </div>

          {/* Rincian status */}
          <Card className="card-pad mt-6">
            <h2 className="font-extrabold text-slate-900">Rincian Keterangan</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <span key={s} className={`chip ${STATUS_ABSENSI_BADGE[s]}`}>
                  {STATUS_ABSENSI_LABEL[s]}: {rekapHarian[s] ?? 0}
                </span>
              ))}
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              {STATUSES.map((s) => {
                const n = rekapHarian[s] ?? 0;
                return (
                  <div
                    key={s}
                    className="inline-block h-full align-top"
                    style={{
                      width: `${itemsHarian.length ? (n / itemsHarian.length) * 100 : 0}%`,
                      background: { HADIR: "#10b981", SAKIT: "#f59e0b", IZIN: "#0ea5e9", ALPA: "#f43f5e", TERLAMBAT: "#f97316", DISPENSASI: "#8b5cf6" }[s],
                    }}
                    title={`${STATUS_ABSENSI_LABEL[s]}: ${n}`}
                  />
                );
              })}
            </div>
          </Card>

          {/* Tabel harian */}
          <Card className="mt-6 overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-extrabold text-slate-900">Keterangan Siswa</h2>
              <p className="text-xs text-slate-500">{formatTanggal(tanggal)}</p>
            </div>
            {itemsHarian.length === 0 ? (
              <div className="p-5"><EmptyState title="Belum ada absensi pada tanggal ini" desc="Pilih tanggal lain atau tunggu absensi harian diisi." /></div>
            ) : (
              <TableShell>
                <thead>
                  <tr>
                    <Th>Siswa</Th>
                    <Th>Kelas</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Catatan</Th>
                  </tr>
                </thead>
                <tbody>
                  {itemsHarian.map((a) => (
                    <TableRow key={a.id}>
                      <Td className="font-bold text-slate-900">{a.siswa.nama}</Td>
                      <Td>{a.siswa.kelas?.nama ?? "-"}</Td>
                      <Td>
                        <span className={`chip ${STATUS_ABSENSI_BADGE[a.status]}`}>{STATUS_ABSENSI_LABEL[a.status]}</span>
                      </Td>
                      <Td className="text-right text-slate-500">{a.catatan ?? "—"}</Td>
                    </TableRow>
                  ))}
                </tbody>
              </TableShell>
            )}
          </Card>
        </>
      ) : (
        <>
          {/* Statistik bulanan */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Bulan" value={formatTanggal(start, "MMMM yyyy")} sub={kelasFilter ? kelasList.find((k) => k.id === kelasFilter)?.nama : "semua kelas"} icon={<CalendarRange className="h-6 w-6" />} />
            <StatCard label="Siswa Tercatat" value={totalBulanan} sub="siswa dengan catatan" color="bg-teal-600" icon={<ClipboardCheck className="h-6 w-6" />} />
            <StatCard label="Total Catatan" value={totalCatatanBulanan} sub="kehadiran sebulan" color="bg-violet-600" icon={<CalendarDays className="h-6 w-6" />} />
            <StatCard label="Kehadiran" value={totalCatatanBulanan ? `${persen(hadirBulanan, totalCatatanBulanan)}%` : "-"} sub="hadir dari total catatan" color="bg-emerald-600" icon={<CalendarDays className="h-6 w-6" />} />
          </div>

          {/* Rincian status */}
          <Card className="card-pad mt-6">
            <h2 className="font-extrabold text-slate-900">Rincian Keterangan</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <span key={s} className={`chip ${STATUS_ABSENSI_BADGE[s]}`}>
                  {STATUS_ABSENSI_LABEL[s]}: {rekapBulan[s] ?? 0}
                </span>
              ))}
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
              {STATUSES.map((s) => {
                const n = rekapBulan[s] ?? 0;
                return (
                  <div
                    key={s}
                    className="inline-block h-full align-top"
                    style={{
                      width: `${totalCatatanBulanan ? (n / totalCatatanBulanan) * 100 : 0}%`,
                      background: { HADIR: "#10b981", SAKIT: "#f59e0b", IZIN: "#0ea5e9", ALPA: "#f43f5e", TERLAMBAT: "#f97316", DISPENSASI: "#8b5cf6" }[s],
                    }}
                    title={`${STATUS_ABSENSI_LABEL[s]}: ${n}`}
                  />
                );
              })}
            </div>
          </Card>

          {/* Tabel bulanan per siswa */}
          <Card className="mt-6 overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-extrabold text-slate-900">Rekap per Siswa</h2>
              <p className="text-xs text-slate-500">{formatTanggal(start, "MMMM yyyy")}</p>
            </div>
            {barisBulanan.length === 0 ? (
              <div className="p-5"><EmptyState title="Belum ada data pada bulan ini" /></div>
            ) : (
              <TableShell>
                <thead>
                  <tr>
                    <Th>Siswa</Th>
                    <Th>Kelas</Th>
                    {STATUSES.map((s) => (
                      <Th key={s} className="text-center">{STATUS_ABSENSI_LABEL[s].slice(0, 3)}</Th>
                    ))}
                    <Th className="text-center">Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {barisBulanan.map((r) => (
                    <TableRow key={r.siswa.id}>
                      <Td className="font-bold text-slate-900">{r.siswa.nama}</Td>
                      <Td>{r.siswa.kelas?.nama ?? "-"}</Td>
                      {STATUSES.map((s) => (
                        <Td key={s} className="text-center">
                          <span className={r.rekap[s] ? "font-extrabold" : "text-slate-300"}>{r.rekap[s] ?? 0}</span>
                        </Td>
                      ))}
                      <Td className="text-center font-bold">{STATUSES.reduce((x, st) => x + (r.rekap[st] ?? 0), 0)}</Td>
                    </TableRow>
                  ))}
                </tbody>
              </TableShell>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
