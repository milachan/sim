import Link from "next/link";
import { ArrowRight, BookOpen, FileWarning, PenLine, Radar, Target, TrendingUp } from "lucide-react";
import { startOfWeek } from "date-fns";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { BarChartVertikal, DonutChart } from "@/components/charts";
import { cn, formatTanggal, mulaiHari, persen } from "@/lib/utils";
import { statistikBulanan } from "@/lib/laporan";
import { hitungRingkasanWaka } from "@/lib/waka-stats";
import InfoWaktu from "@/components/info-waktu";

export const dynamic = "force-dynamic";

export default async function WakaPage() {
  const user = await getCurrentUser();
  const bisaKelola = !!user && ["ADMIN", "SUPERADMIN"].includes(user.role);
  const sekarang = mulaiHari(new Date());
  const bulanIni = `${sekarang.getUTCFullYear()}-${String(sekarang.getUTCMonth() + 1).padStart(2, "0")}`;
  const stat = await statistikBulanan(bulanIni);
  const ringkas = await hitungRingkasanWaka(bulanIni);

  const total = stat.totalPertemuan;
  const lengkap = stat.lengkap;
  const jurnalKosong = stat.tanpaJurnal;
  const manual = stat.manual;

  const awalMingguIni = startOfWeek(sekarang, { weekStartsOn: 1 });
  const trenRows = await prisma.pertemuan.findMany({
    where: { tanggal: { gte: new Date(awalMingguIni.getTime() - 35 * 86400000), lte: sekarang }, status: { not: "TIDAK_TERLAKSANA" } },
    select: { tanggal: true, status: true },
  });

  const guruSummary = ringkas.perGuru;

  const mingguLabels = ["-5", "-4", "-3", "-2", "-1", "ini"];
  const tren = mingguLabels.map((_, i) => {
    const awal = new Date(awalMingguIni);
    awal.setDate(awal.getDate() + (i - 5) * 7);
    const akhir = new Date(awal);
    akhir.setDate(awal.getDate() + 7);
    const dalamMinggu = trenRows.filter((p) => p.tanggal >= awal && p.tanggal < akhir);
    const selesai = dalamMinggu.filter((p) => p.status === "LENGKAP").length;
    const short = i === 5 ? "Kini" : `M-${5 - i}`;
    return { label: short, shortLabel: short, nilai: dalamMinggu.length ? Math.round((selesai / dalamMinggu.length) * 100) : 0 };
  });

  const trendNaik = tren.length >= 2 && tren[tren.length - 1].nilai >= tren[tren.length - 2].nilai;

  const sorted = [...guruSummary].sort((a, b) => a.persen - b.persen);

  const tanpaJurnal = ringkas.tanpaJurnalDetail.slice(0, 10);

  return (
    <div className="fade-up">
      <PageHeader
        title="Beranda Pemantauan"
        subtitle={`Kelengkapan administrasi jurnal seluruh guru — sampling verifikasi oleh Waka Kurikulum · ${bulanIni}`}
        icon={<Radar className="h-6 w-6" />}
      />

      <InfoWaktu />

      <div className="mt-4 grid grid-cols-1 gap-3 [@media(min-width:340px)]:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total Pertemuan" value={total} sub="bulan ini (termasuk belum terbentuk)" icon={<BookOpen className="h-6 w-6" />} />
        <StatCard label="Pertemuan Lengkap" value={total ? `${persen(lengkap, total)}%` : "-"} sub={`${lengkap} dari ${total} pertemuan`} color="bg-teal-600" icon={<Target className="h-6 w-6" />} />
        <StatCard label="Jurnal Kosong" value={jurnalKosong} sub="pertemuan tanpa jurnal (termasuk slot)" color={jurnalKosong ? "bg-amber-500" : "bg-emerald-600"} icon={<FileWarning className="h-6 w-6" />} />
        <StatCard label="Jurnal Manual" value={manual} sub="pengganti/remedial" color="bg-violet-600" icon={<PenLine className="h-6 w-6" />} />
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-5">
        <Card className="card-pad lg:col-span-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center gap-2 font-extrabold text-slate-900">
              <TrendingUp className="h-5 w-5 text-emerald-600" /> Tren Pertemuan Lengkap
            </h2>
            <span className={cn("chip self-start sm:self-auto", trendNaik ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600")}>
              {trendNaik ? "↑" : "↓"} vs minggu lalu
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Persentase pertemuan lengkap per minggu (6 minggu terakhir)</p>
          <div className="mt-4">
            <BarChartVertikal data={tren} format={(v) => `${v}%`} />
          </div>
        </Card>

        <Card className="card-pad lg:col-span-2">
          <h2 className="font-extrabold text-slate-900">Distribusi Status Pertemuan</h2>
          <p className="mt-1 text-xs text-slate-500">Bulan {bulanIni} — termasuk slot belum terbentuk sebagai Belum</p>
          <div className="mt-4">
            <DonutChart data={[{ label: "Lengkap", nilai: lengkap, warna: "#059669" }, { label: "Belum", nilai: total - lengkap, warna: "#94a3b8" }]} />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-extrabold text-slate-900">Kelengkapan Pertemuan per Guru</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Bulan {bulanIni} · urut dari terendah
              </p>
            </div>
            <Link href="/jurnal" className="btn-ghost btn-sm min-h-11 self-start sm:self-auto">Detail <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="space-y-3 p-5">
            {sorted.filter((x) => x.total > 0).length === 0 && <EmptyState title="Belum ada data pertemuan" />}
            {sorted
              .filter((x) => x.total > 0)
              .map((x) => (
                <div key={x.guruId}>
                  <div className="mb-1 flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <span className="break-words font-bold text-slate-700">{x.nama.split(",")[0]}</span>
                    <span className="flex flex-wrap items-center gap-2">
                      {x.persen < 60 && <span className="chip bg-amber-100 text-amber-700">Butuh pendampingan</span>}
                      <span className="font-extrabold text-slate-500">{x.persen}%</span>
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn("h-full rounded-full transition-all", x.persen >= 80 ? "bg-emerald-500" : x.persen >= 60 ? "bg-amber-400" : "bg-rose-500")}
                      style={{ width: `${x.persen}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">{x.lengkap}/{x.total} pertemuan lengkap</p>
                </div>
              ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-extrabold text-slate-900">Pertemuan Tanpa Jurnal (terbaru)</h2>
            <span className="chip self-start bg-amber-100 text-amber-700 sm:self-auto">{jurnalKosong} belum diisi</span>
          </div>
          {tanpaJurnal.length === 0 ? (
            <div className="p-5">
              <EmptyState title="Semua jurnal terisi" desc="Tidak ada pertemuan yang kelewat." />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {tanpaJurnal.map((p) => (
                <Link key={p.id} href={`/pertemuan/${p.id}`} className="group flex flex-col gap-2 px-5 py-3.5 transition hover:bg-amber-50/50 sm:flex-row sm:items-center sm:gap-4">
                  <p className="text-sm font-bold text-slate-700 sm:w-28 sm:shrink-0">{formatTanggal(p.tanggal)}</p>
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-bold text-slate-900">
                      {(p as { guruNama?: string }).guruNama ?? "-"} — {(p as { mapelNama?: string }).mapelNama ?? "-"}
                    </p>
                    <p className="break-words text-xs text-slate-500">{(p as { kelasNama?: string }).kelasNama ?? "-"} · {p.pertemuanKe > 0 ? `Pertemuan ke-${p.pertemuanKe}` : "Pertemuan manual"}</p>
                  </div>
                  <span className="btn-secondary btn-sm min-h-11 self-start group-hover:border-amber-300 sm:self-auto">{bisaKelola ? "Lengkapi" : "Lihat"}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
