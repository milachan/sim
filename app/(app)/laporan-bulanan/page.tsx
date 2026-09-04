import Link from "next/link";
import { ArrowRight, CalendarRange, ClipboardCheck, FileCheck2, TrendingDown, TrendingUp } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, PageHeader, SuksesBanner, ErrorBanner } from "@/components/ui";
import { BarChartVertikal } from "@/components/charts";
import { STATUS_LAPORAN_BADGE, STATUS_LAPORAN_LABEL } from "@/lib/constants";
import { statistikBulanan } from "@/lib/laporan";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Daftar bulan yang punya aktivitas pertemuan (6 terakhir), urut terbaru. */
async function bulanTersedia(): Promise<string[]> {
  const rows = await prisma.pertemuan.findMany({
    select: { tanggal: true },
    orderBy: { tanggal: "desc" },
    take: 2000,
  });
  const set = new Set<string>();
  const now = new Date();
  set.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  for (const r of rows) {
    const d = r.tanggal;
    set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    if (set.size >= 6) break;
  }
  return [...set].sort().reverse().slice(0, 6);
}

function labelBulan(bulan: string) {
  const [tahun, bulanNum] = bulan.split("-").map(Number);
  return new Date(tahun, bulanNum - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

function labelBulanSingkat(bulan: string) {
  const [tahun, bulanNum] = bulan.split("-").map(Number);
  return new Date(tahun, bulanNum - 1, 1).toLocaleDateString("id-ID", { month: "short" });
}

export default async function LaporanBulananPage({ searchParams }: { searchParams: { sukses?: string; error?: string; s?: string } }) {
  const user = await getCurrentUser();
  const isVerifikator = ["WAKA", "ADMIN", "SUPERADMIN"].includes(user?.role ?? "");
  const isKamad = user?.role === "KEPALA";
  // Tab filter status — untuk Kamad difokuskan pada bulan yang siap ia setujui.
  const filter = searchParams.s ?? "semua";
  const tabTersedia = isKamad
    ? [
        { id: "semua", label: "Semua" },
        { id: "menunggu", label: "Menunggu persetujuan" },
        { id: "disetujui", label: "Disetujui" },
      ]
    : [
        { id: "semua", label: "Semua" },
        { id: "belum", label: "Belum dibuat" },
        { id: "konsep", label: "Konsep" },
        { id: "diperiksa", label: "Sudah Diperiksa" },
        { id: "disetujui", label: "Disetujui" },
      ];
  const filterAktif = tabTersedia.some((t) => t.id === filter) ? filter : "semua";

  const [bulanList, laporanList] = await Promise.all([bulanTersedia(), prisma.laporanBulanan.findMany()]);
  const statusByBulan = new Map(laporanList.map((l) => [l.bulan, l.status]));

  const baris = await Promise.all(
    bulanList.map(async (bulan) => {
      const stat = await statistikBulanan(bulan);
      return { bulan, label: labelBulan(bulan), ...stat, status: statusByBulan.get(bulan) ?? null };
    })
  );

  const barisFilter = baris.filter((b) => {
    if (filterAktif === "semua") return true;
    if (filterAktif === "belum") return !b.status;
    if (filterAktif === "konsep") return b.status === "DRAFT";
    if (filterAktif === "menunggu" || filterAktif === "diperiksa") return b.status === "DIPERIKSA";
    if (filterAktif === "disetujui") return b.status === "DISETUJUI";
    return true;
  });

  // Tren kelengkapan: urut dari bulan tertua ke terbaru agar grafik mengalir.
  // Bulan tanpa pertemuan ditandai agar tidak disalahartikan sebagai kelengkapan 0%.
  const tren = [...baris].reverse().map((b) => {
    const [th, mo] = b.bulan.split("-").map(Number);
    const short = new Date(th, mo - 1, 1).toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
    return {
      label: short,
      shortLabel: short,
      nilai: b.persenLengkap,
      sub: b.totalPertemuan === 0 ? "belum ada data" : `${b.lengkap}/${b.totalPertemuan} pertemuan`,
    };
  });

  // Insight perbandingan
  const tertinggi = [...baris].filter((b) => b.totalPertemuan > 0).sort((a, b) => b.persenLengkap - a.persenLengkap)[0];
  const terendah = [...baris].filter((b) => b.totalPertemuan > 0).sort((a, b) => a.persenLengkap - b.persenLengkap)[0];
  const delta =
    baris.length >= 2 && baris[0].totalPertemuan > 0 && baris[1].totalPertemuan > 0
      ? baris[0].persenLengkap - baris[1].persenLengkap
      : null;

  return (
    <div className="fade-up">
      <PageHeader
        title="Laporan Bulanan"
        subtitle="Verifikasi sampling Waka → persetujuan Kepala Madrasah, untuk setiap bulan mengajar"
        icon={<CalendarRange className="h-6 w-6" />}
      />
      <SuksesBanner message={searchParams.sukses} />
      <ErrorBanner message={searchParams.error} />

      <Card className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
        <span className="flex items-center gap-2 font-bold text-slate-700">
          <FileCheck2 className="h-4 w-4 text-emerald-600" /> Alur verifikasi
        </span>
        <span className="flex items-center gap-1.5 text-slate-600">
          <span className="chip bg-slate-100 text-slate-600">1 · Konsep</span>
          <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
          <span className="chip bg-amber-100 text-amber-700">2 · Sampling Waka</span>
          <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
          <span className="chip bg-emerald-100 text-emerald-700">3 · Disetujui Kamad</span>
        </span>
      </Card>

      {/* Tren kelengkapan antar bulan */}
      {tren.length > 0 && (
        <Card className="card-pad mb-6 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-extrabold text-slate-900">
                <TrendingUp className="h-5 w-5 text-emerald-600" /> Tren Kelengkapan Bulanan
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">Persentase pertemuan lengkap per bulan — untuk perbandingan antar periode</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {tertinggi && (
                <span className="chip bg-emerald-100 text-emerald-700">
                  Terbaik: {labelBulanSingkat(tertinggi.bulan)} · {tertinggi.persenLengkap}%
                </span>
              )}
              {terendah && tertinggi?.bulan !== terendah.bulan && (
                <span className="chip bg-rose-100 text-rose-600">
                  Terendah: {labelBulanSingkat(terendah.bulan)} · {terendah.persenLengkap}%
                </span>
              )}
              {delta !== null && (
                <span className={cn("chip", delta >= 0 ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700")}>
                  {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {delta >= 0 ? "+" : ""}{delta}% vs bulan lalu
                </span>
              )}
            </div>
          </div>
          <div className="mt-5">
            <BarChartVertikal data={tren} height={190} format={(v) => `${v}%`} />
          </div>
        </Card>
      )}

      {/* Tab filter status */}
      <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
        {tabTersedia.map((t) => (
          <Link
            key={t.id}
            href={`/laporan-bulanan?s=${t.id}`}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition ${
              filterAktif === t.id ? "bg-emerald-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {baris.length === 0 ? (
        <EmptyState
          title="Belum ada bulan dengan aktivitas"
          desc="Laporan muncul untuk bulan yang memiliki pertemuan mengajar."
        />
      ) : barisFilter.length === 0 ? (
        <EmptyState
          title="Tidak ada laporan pada filter ini"
          desc="Coba pilih tab filter lain."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {barisFilter.map((b) => (
            <Link
              key={b.bulan}
              href={`/laporan-bulanan/${b.bulan}${filterAktif !== "semua" ? `?s=${filterAktif}` : ""}`}
              className="card card-pad group transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-extrabold text-slate-900">{b.label}</p>
                  <p className="text-xs text-slate-500">{b.totalPertemuan} pertemuan · {b.persenLengkap}% lengkap</p>
                </div>
                {b.status ? (
                  <span className={`chip ${STATUS_LAPORAN_BADGE[b.status]}`}>{STATUS_LAPORAN_LABEL[b.status]}</span>
                ) : (
                  <span className="chip bg-slate-100 text-slate-500">Belum dibuat</span>
                )}
              </div>

              <div className="mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Jurnal lengkap</span>
                  <span className="font-bold">{b.lengkap}/{b.totalPertemuan}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Jurnal kosong</span>
                  <span className={b.tanpaJurnal ? "font-bold text-rose-600" : "font-bold"}>{b.tanpaJurnal}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Manual / batal</span>
                  <span className="font-bold">{b.manual} / {b.tidakTerlaksana}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs font-semibold text-slate-400">
                  {!b.status
                    ? (isVerifikator ? "Belum dibuat — klik untuk buat" : "Menunggu Waka membuat laporan")
                    : b.status === "DRAFT"
                      ? (isVerifikator ? "Klik untuk verifikasi sampling" : "Menunggu verifikasi Waka")
                      : b.status === "DIPERIKSA"
                        ? (isKamad ? "Siap disetujui Kamad" : "Sudah diperiksa — klik untuk tinjau")
                        : "✓ Selesai"}
                </span>
                <span className="btn-secondary btn-sm group-hover:border-emerald-400 group-hover:text-emerald-700">
                  {!b.status && isVerifikator ? <ClipboardCheck className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                  {!b.status && isVerifikator ? "Buat Laporan" : "Buka"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
