import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, FileBarChart, FolderOpen, GraduationCap, School, TrendingUp } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { DonutChart } from "@/components/charts";
import { persen } from "@/lib/utils";
import { mulaiHari } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { STATUS_ABSENSI_LABEL } from "@/lib/constants";
import { statistikBulanan } from "@/lib/laporan";
import InfoWaktu from "@/components/info-waktu";

export const dynamic = "force-dynamic";

export default async function KamadPage() {
  await getCurrentUser();

  const hariIniWib = mulaiHari(new Date());
  const bulanIni = `${hariIniWib.getUTCFullYear()}-${String(hariIniWib.getUTCMonth() + 1).padStart(2, "0")}`;

  const [guruAktif, siswaAktif, stat, pertemuanDonutRaw, absensi, menungguPemeriksaan] = await Promise.all([
    prisma.guru.count({ where: { status: true, deletedAt: null } }),
    prisma.siswa.count({ where: { status: "AKTIF", deletedAt: null } }),
    statistikBulanan(bulanIni),
    prisma.pertemuan.findMany({
      where: {
        tanggal: {
          gte: mulaiHari(new Date(Date.UTC(hariIniWib.getUTCFullYear(), hariIniWib.getUTCMonth(), 1))),
          lte: hariIniWib,
        },
      },
      select: { status: true },
    }),
    prisma.absensiHarianItem.groupBy({ by: ["status"], _count: { _all: true } }),
    // Kartu "Persetujuan Administrasi" — hitung langsung dari database, tanpa
    // mengubah statistik/query Jurnal. DRAFT dikecualikan agar kartu konsisten
    // dengan antrean lembaga.
    prisma.dokumen.count({ where: { status: "DIKIRIM" } }),
  ]);

  const total = stat.totalPertemuan;
  const lengkap = stat.lengkap;
  const jmlTerkirim = lengkap;
  const bulanIniCount = total;

  const absensiPerKelas = await prisma.absensiHarianItem.groupBy({
    by: ["absensiHarianId"],
    where: { status: { not: "HADIR" } },
    _count: { _all: true },
  });
  const ahIds = absensiPerKelas.map((a) => a.absensiHarianId);
  const ahKelas = await prisma.absensiHarian.findMany({
    where: { id: { in: ahIds } },
    select: { id: true, kelas: { select: { nama: true } } },
  });
  const ahKelasById = new Map(ahKelas.map((p) => [p.id, p.kelas?.nama ?? ""]));
  const byKelas = new Map<string, number>();
  for (const a of absensiPerKelas) {
    const kelas = ahKelasById.get(a.absensiHarianId);
    if (kelas) byKelas.set(kelas, (byKelas.get(kelas) ?? 0) + a._count._all);
  }
  const kelasTertinggi = [...byKelas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const perGuruData = stat.perGuru;
  const butuh = perGuruData
    .filter((x) => x.total > 0 && persen(x.lengkap, x.total) < 60)
    .sort((a, b) => persen(a.lengkap, a.total) - persen(b.lengkap, b.total))
    .slice(0, 5);

  const absensiCount = new Map(absensi.map((a) => [a.status, a._count._all]));
  const totalAbsensi = absensi.reduce((a, x) => a + x._count._all, 0);

  const belumSlot = stat.slotBelumTerbentuk;
  const countByStatus = new Map<string, number>();
  for (const p of pertemuanDonutRaw) countByStatus.set(p.status, (countByStatus.get(p.status) ?? 0) + 1);
  const belumDimulaiPlusSlot = (countByStatus.get("BELUM_DIMULAI") ?? 0) + belumSlot;
  const donut = [
    { label: "Lengkap", nilai: countByStatus.get("LENGKAP") ?? 0, warna: "#059669" },
    { label: "Absensi", nilai: countByStatus.get("ABSENSI_TERISI") ?? 0, warna: "#f59e0b" },
    { label: "Jurnal", nilai: countByStatus.get("JURNAL_TERISI") ?? 0, warna: "#0ea5e9" },
    { label: "Belum", nilai: belumDimulaiPlusSlot, warna: "#94a3b8" },
    { label: "Batal", nilai: countByStatus.get("TIDAK_TERLAKSANA") ?? 0, warna: "#f43f5e" },
  ];

  const kartuRuangKerja = [
    {
      href: "/kamad",
      label: "Pemantauan Jurnal",
      deskripsi: "Kelengkapan jurnal & absensi pembelajaran.",
      icon: BookOpen,
      warna: "bg-blue-100 text-blue-700",
      // Data: statistikBulanan sudah menghitung pertemuan bulan ini.
      // Tampilkan chip jujur sesuai ketersediaan, tanpa angka palsu.
      chip: total
        ? { teks: `${jmlTerkirim}/${total} jurnal lengkap`, tonal: "bg-emerald-50 text-emerald-700" }
        : { teks: "Belum ada pertemuan bulan ini", tonal: "bg-slate-100 text-slate-500" },
    },
    {
      href: "/administrasi",
      label: "Persetujuan Administrasi",
      deskripsi: "Dokumen & pengajuan administrasi madrasah.",
      icon: FolderOpen,
      warna: "bg-amber-100 text-amber-700",
      chip:
        menungguPemeriksaan > 0
          ? { teks: `${menungguPemeriksaan} menunggu pemeriksaan`, tonal: "bg-amber-50 text-amber-700" }
          : { teks: "Tidak ada antrean", tonal: "bg-slate-100 text-slate-500" },
    },
    {
      href: "/analisis-nilai",
      label: "Analisis Nilai",
      deskripsi: "Capaian nilai siswa antar kelas & mapel.",
      icon: FileBarChart,
      warna: "bg-violet-100 text-violet-700",
      // Integrasi AIP belum tersedia di rilis ini; gunakan label jujur
      // tanpa angka palsu.
      chip: { teks: "Integrasi AIP belum tersedia", tonal: "bg-slate-100 text-slate-500" },
    },
  ];

  return (
    <div className="fade-up">
      <PageHeader
        title="Ringkasan Kepala Madrasah"
        subtitle={`Pantauan ringkas kelengkapan administrasi pembelajaran (read-only) · ${bulanIni} · WIB`}
        icon={<GraduationCap className="h-6 w-6" />}
      />

      {/* Keterangan waktu — seragam dengan beranda lain */}
      <InfoWaktu />

      {/* Jalan pintas lintas rumah — UI saja, tanpa query tambahan. */}
      <section aria-label="Ruang Kerja Kamad" className="mt-4">
        <h2 className="px-1 pb-2 text-xs font-extrabold uppercase tracking-widest text-slate-400">Ruang Kerja Kamad</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {kartuRuangKerja.map((k) => (
            <Link
              key={k.href}
              href={k.href}
              className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", k.warna)}>
                <k.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 font-extrabold text-slate-900">
                  <span className="truncate">{k.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">{k.deskripsi}</span>
                <span className={cn("chip mt-1.5", k.chip.tonal)}>{k.chip.teks}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-4 grid grid-cols-1 gap-3 [@media(min-width:340px)]:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Guru Aktif" value={guruAktif} icon={<BookOpen className="h-6 w-6" />} />
        <StatCard label="Siswa Aktif" value={siswaAktif} color="bg-violet-600" icon={<School className="h-6 w-6" />} />
        <StatCard label="Kelengkapan Jurnal" value={total ? `${persen(lengkap, total)}%` : "-"} sub={`${jmlTerkirim} jurnal lengkap dari ${total} pertemuan`} color="bg-teal-600" icon={<TrendingUp className="h-6 w-6" />} />
        <StatCard label="Pertemuan Bulan Ini" value={bulanIniCount} sub={belumSlot ? `${belumSlot} slot belum terbentuk` : "termasuk slot belum terbentuk"} color="bg-amber-500" icon={<CalendarDays className="h-6 w-6" />} />
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Card className="card-pad overflow-hidden">
          <h2 className="break-words font-extrabold text-slate-900">Status Administrasi Pertemuan</h2>
          <p className="mt-1 break-words text-xs text-slate-500">Lengkap, parsial, hingga belum diisi — termasuk slot yang seharusnya ada</p>
          <div className="mt-4">
            <DonutChart data={donut} size={170} />
          </div>
        </Card>

        <Card className="card-pad overflow-hidden">
          <h2 className="font-extrabold text-slate-900">Distribusi Kehadiran Siswa</h2>
          <div className="mt-4 space-y-3">
            {(["HADIR", "SAKIT", "IZIN", "ALPA", "TERLAMBAT", "DISPENSASI"] as const).map((s) => {
              const n = absensiCount.get(s) ?? 0;
              const p = totalAbsensi ? (n / totalAbsensi) * 100 : 0;
              return (
                <div key={s}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-bold text-slate-600">{STATUS_ABSENSI_LABEL[s]}</span>
                    <span className="font-extrabold text-slate-500">{n} ({p.toFixed(1)}%)</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        s === "HADIR" ? "bg-emerald-500" : s === "SAKIT" ? "bg-amber-400" : s === "IZIN" ? "bg-sky-400" : s === "ALPA" ? "bg-rose-500" : s === "TERLAMBAT" ? "bg-orange-400" : "bg-violet-400"
                      )}
                      style={{ width: `${p}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="card-pad">
          <h2 className="font-extrabold text-slate-900">Kelas Absensi Tidak Hadir Terbanyak</h2>
          {kelasTertinggi.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Belum ada data absensi.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {kelasTertinggi.map(([kelas, n], i) => (
                <div key={kelas} className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${i === 0 ? "bg-rose-500 text-white" : "bg-slate-200 text-slate-600"}`}>{i + 1}</span>
                  <p className="min-w-0 flex-1 break-words font-bold text-slate-800">{kelas}</p>
                  <span className="shrink-0 font-extrabold text-rose-600">{n}x</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="card-pad">
          <h2 className="font-extrabold text-slate-900">Guru Butuh Pendampingan</h2>
          <p className="mt-1 text-xs text-slate-500">Kelengkapan jurnal di bawah 60% — termasuk jurnal manual</p>
          {butuh.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Semua guru di atas 60% kelengkapan.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {butuh.map((g) => (
                <div key={g.guruId} className="flex items-start justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3">
                  <p className="min-w-0 flex-1 break-words font-bold text-slate-800">{g.nama}</p>
                  <span className="chip shrink-0 bg-rose-100 text-rose-700">{g.persen}%</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="card-pad mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="break-words text-sm text-slate-500">
          Laporan bulanan & ekspor tersedia untuk tinjauan lebih lengkap.
        </p>
        <Link href="/laporan" className="btn-primary min-h-11 shrink-0">
          Buka Laporan <ArrowRight className="h-4 w-4" />
        </Link>
      </Card>
    </div>
  );
}
