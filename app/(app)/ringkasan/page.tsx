import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, ClipboardCheck, FileBarChart, GraduationCap, Target, TrendingUp } from "lucide-react";
import { startOfMonth, endOfMonth } from "date-fns";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { BarChartVertikal } from "@/components/charts";
import { formatTanggal, mulaiHari, persen } from "@/lib/utils";
import { hariDariTanggal } from "@/lib/absensi-harian";
import { sinkronkanPertemuan } from "@/lib/pertemuan";
import { wherePertemuanGuruAkun } from "@/lib/laporan";
import { cariSemesterAktif } from "@/lib/semester";

export const dynamic = "force-dynamic";

export default async function RingkasanPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "GURU" && !(user.role === "WAKA" && user.guruId)) redirect("/"); // halaman khusus guru

  const guruId = user.guruId!;
  const hariIni = mulaiHari();

  // Sinkronkan semester aktif bila ada pergantian otomatis berdasarkan tanggal
  await cariSemesterAktif();
  // Pastikan pertemuan dari jadwal sudah ada sampai hari ini agar statistik
  // bulan ini, tren, dan jurnal tertinggal tidak meleset (idempoten).
  await sinkronkanPertemuan({ guruId, sampai: hariIni });
  const awalMingguIni = new Date(hariIni);
  awalMingguIni.setDate(hariIni.getDate() - ((hariIni.getDay() + 6) % 7));

  // Pertemuan hari ini dibuat lazy oleh beranda — hitung dari jadwal agar akurat walau guru langsung ke halaman ini.
  // Minggu (null) → tidak ada jadwal hari ini (0), jangan diquery dengan hari hilang.
  const hariHariIni = hariDariTanggal(new Date());
  const jadwalHariIni = hariHariIni
    ? await prisma.jadwal.count({ where: { guruId, hari: hariHariIni, semester: { aktif: true } } })
    : 0;

  const [bulanIni, jurnalKurang, pertemuanTren, kegiatan] = await Promise.all([
    prisma.pertemuan.findMany({
      where: { AND: [wherePertemuanGuruAkun(guruId, user.id), { tanggal: { gte: startOfMonth(hariIni), lte: endOfMonth(hariIni) } }] },
      select: { status: true },
    }),
    prisma.pertemuan.count({
      where: { AND: [wherePertemuanGuruAkun(guruId, user.id), { tanggal: { lt: hariIni }, jurnal: null, status: { not: "TIDAK_TERLAKSANA" } }] },
    }),
    prisma.pertemuan.findMany({
      where: { AND: [wherePertemuanGuruAkun(guruId, user.id), { tanggal: { gte: new Date(hariIni.getTime() - 42 * 86400000) }, status: { not: "TIDAK_TERLAKSANA" } }] },
      select: { tanggal: true, status: true },
    }),
    prisma.penilaianKegiatan.findMany({
      where: { jadwal: { guruId } },
      include: { jadwal: { include: { kelas: true, mapel: true } } },
      orderBy: { tanggal: "desc" },
      take: 4,
    }),
  ]);
  const totalBulan = bulanIni.length;
  const lengkapBulan = bulanIni.filter((p) => p.status === "LENGKAP").length;

  // Tren kelengkapan 6 minggu terakhir
  const tren = ["-5", "-4", "-3", "-2", "-1", "ini"].map((_, i) => {
    const awal = new Date(awalMingguIni);
    awal.setDate(awal.getDate() + (i - 5) * 7);
    const akhir = new Date(awal);
    akhir.setDate(awal.getDate() + 7);
    const dalam = pertemuanTren.filter((p) => p.tanggal >= awal && p.tanggal < akhir);
    const selesai = dalam.filter((p) => p.status === "LENGKAP").length;
    const short = i === 5 ? "Kini" : `M-${5 - i}`;
    return { label: short, shortLabel: short, nilai: dalam.length ? Math.round((selesai / dalam.length) * 100) : 0 };
  });

  return (
    <div className="fade-up">
      <PageHeader
        title="Ringkasan & Statistik"
        subtitle="Gambaran umum administrasi mengajar Anda — terpisah dari halaman kerja harian"
        icon={<TrendingUp className="h-6 w-6" />}
      />

      {/* Statistik */}
      <div className="grid grid-cols-1 gap-3 [@media(min-width:340px)]:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Jadwal Hari Ini" value={jadwalHariIni} icon={<CalendarDays className="h-6 w-6" />} />
        <StatCard
          label="Kelengkapan Bulan Ini"
          value={totalBulan ? `${persen(lengkapBulan, totalBulan)}%` : "-"}
          sub={`${lengkapBulan} dari ${totalBulan} pertemuan lengkap`}
          color="bg-teal-600"
          icon={<Target className="h-6 w-6" />}
        />
        <StatCard
          label="Jurnal Tertinggal"
          value={jurnalKurang}
          sub={jurnalKurang ? "dari hari sebelumnya" : "semua beres, hebat!"}
          color={jurnalKurang ? "bg-amber-500" : "bg-emerald-600"}
          icon={<BookOpen className="h-6 w-6" />}
        />
        <StatCard
          label="Kegiatan Penilaian"
          value={kegiatan.length}
          sub="terbaru yang tercatat"
          color="bg-violet-600"
          icon={<GraduationCap className="h-6 w-6" />}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        {/* Tren kelengkapan */}
        <Card className="card-pad overflow-hidden lg:col-span-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-center gap-2 break-words font-extrabold text-slate-900">
              <TrendingUp className="h-5 w-5 shrink-0 text-emerald-600" /> Tren Kelengkapan
            </h2>
            <span className="chip self-start bg-emerald-50 text-emerald-700 sm:self-auto">{persen(lengkapBulan, totalBulan)}% bulan ini</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Pertemuan lengkap per minggu (6 minggu terakhir)</p>
          <div className="mt-4">
            <BarChartVertikal data={tren} format={(v) => `${v}%`} height={150} />
          </div>
        </Card>

        {/* Penilaian terbaru */}
        <Card className="overflow-hidden lg:col-span-2">
          <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="flex items-center gap-2 break-words font-extrabold text-slate-900">
              <GraduationCap className="h-5 w-5 shrink-0 text-violet-600" /> Penilaian Terbaru
            </h3>
            <Link href="/nilai" className="btn-ghost btn-sm min-h-11 self-start sm:self-auto">
              Kelola <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {kegiatan.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">Belum ada kegiatan penilaian.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {kegiatan.map((k) => (
                <Link key={k.id} href={`/nilai/${k.id}`} className="block px-5 py-3 transition hover:bg-violet-50/50">
                  <p className="break-words text-sm font-bold text-slate-900">{k.judul}</p>
                  <p className="break-words text-xs text-slate-500">
                    {k.jadwal.kelas.nama} · {formatTanggal(k.tanggal)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Cek cepat */}
      <Card className="card-pad mt-6">
        <h3 className="font-extrabold text-slate-900">Cek Cepat</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/jadwal", label: "Jadwal mingguan", icon: CalendarDays },
            { href: "/absensi", label: "Absensi Pribadi", icon: ClipboardCheck },
            { href: "/absensi-harian", label: "Absensi Harian", icon: ClipboardCheck },
            { href: "/laporan", label: "Laporan & ekspor Excel", icon: FileBarChart },
          ].map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50 hover:ring-emerald-300"
            >
              <c.icon className="h-5 w-5 text-emerald-600" /> {c.label}
              <ArrowRight className="ml-auto h-4 w-4 text-slate-300" />
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
