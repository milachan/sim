import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileSpreadsheet,
  History,
  NotebookPen,
  School,
  Settings,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { persen } from "@/lib/utils";
import InfoWaktu from "@/components/info-waktu";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const user = await getCurrentUser();

  const [guru, siswa, kelas, mapel, jadwal, ta, pertemuan, riwayat] = await Promise.all([
    prisma.guru.count({ where: { deletedAt: null } }),
    prisma.siswa.count({ where: { status: "AKTIF", deletedAt: null } }),
    prisma.kelas.count(),
    prisma.mataPelajaran.count(),
    prisma.jadwal.count(),
    prisma.tahunAjaran.findFirst({ where: { aktif: true }, include: { semester: true } }),
    prisma.pertemuan.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.riwayatPerubahan.count(),
  ]);
  const totalPertemuan = pertemuan.reduce((total, item) => total + item._count._all, 0);
  const lengkap = pertemuan.find((item) => item.status === "LENGKAP")?._count._all ?? 0;

  const semesterAktif = ta?.semester.find((s) => s.aktif);

  const dataMaster = [
    { href: "/admin/guru", label: "Data Guru", icon: Users, color: "bg-blue-500", desc: `${guru} guru tercatat` },
    { href: "/admin/siswa", label: "Data Siswa", icon: User, color: "bg-blue-600", desc: `${siswa} siswa aktif` },
    { href: "/admin/kelas", label: "Kelas & Rombel", icon: School, color: "bg-blue-400", desc: `${kelas} rombel` },
    { href: "/admin/mapel", label: "Mata Pelajaran", icon: NotebookPen, color: "bg-blue-500", desc: `${mapel} mapel` },
    { href: "/admin/jadwal", label: "Jadwal Pelajaran", icon: CalendarDays, color: "bg-blue-600", desc: `${jadwal} slot` },
  ];

  const pengelolaan = [
    { href: "/admin/import", label: "Import Excel", icon: FileSpreadsheet, color: "bg-emerald-500", desc: "Import data guru, siswa & jadwal" },
    { href: "/laporan-bulanan", label: "Laporan Bulanan", icon: ClipboardCheck, color: "bg-emerald-600", desc: "Verifikasi & persetujuan" },
  ];

  const sistem = [
    { href: "/admin/users", label: "Hak Akses", icon: ShieldCheck, color: "bg-slate-500", desc: "Kelola akun pengguna" },
    { href: "/admin/riwayat", label: "Riwayat Perubahan", icon: History, color: "bg-slate-600", desc: `${riwayat} catatan audit` },
    { href: "/admin/kalender", label: "Kalender Akademik", icon: CalendarDays, color: "bg-slate-500", desc: "Jadwal kegiatan sekolah" },
    { href: "/admin/pengaturan", label: "Pengaturan", icon: Settings, color: "bg-slate-600", desc: "Konfigurasi sistem" },
  ];

  return (
    <div className="fade-up">
      <PageHeader
        title="Dashboard Admin"
        subtitle={`Selamat datang, ${user?.nama} — kelola data master & kelengkapan administrasi`}
        icon={<ShieldCheck className="h-6 w-6" />}
      />

      <InfoWaktu />

      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Guru Aktif" value={guru} icon={<Users className="h-6 w-6" />} />
        <StatCard label="Siswa Aktif" value={siswa} color="bg-violet-600" icon={<User className="h-6 w-6" />} />
        <StatCard label="Slot Jadwal" value={jadwal} color="bg-teal-600" icon={<CalendarDays className="h-6 w-6" />} />
        <StatCard
          label="Kelengkapan Pertemuan"
          value={totalPertemuan ? `${persen(lengkap, totalPertemuan)}%` : "-"}
          sub={`${lengkap} dari ${totalPertemuan} pertemuan lengkap`}
          color="bg-amber-500"
          icon={<ClipboardCheck className="h-6 w-6" />}
        />
      </div>

      {/* Tahun Ajaran Aktif */}
      {ta && (
        <Card className="card-pad mt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-extrabold text-slate-900">
                Tahun Ajaran {ta.nama}
                <span className="chip ml-2 bg-emerald-100 text-emerald-700">Aktif</span>
              </p>
              <p className="text-xs text-slate-500">
                {semesterAktif ? `${semesterAktif.nama}` : "Belum ada semester aktif"}
              </p>
            </div>
            <Link href="/admin/tahun-ajaran" className="btn-secondary btn-sm">Kelola</Link>
          </div>
        </Card>
      )}

      {/* Data Master */}
      <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-400">Data Master</h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dataMaster.map((m) => (
          <Link key={m.href} href={m.href} className="card group p-4 transition hover:border-blue-300 hover:shadow-md">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${m.color} text-white shadow-sm`}>
              <m.icon className="h-5 w-5" />
            </div>
            <p className="mt-2 font-extrabold text-slate-900 group-hover:text-blue-700">{m.label}</p>
            <p className="mt-0.5 text-xs text-slate-500">{m.desc}</p>
            <p className="mt-2 flex items-center gap-1 text-xs font-bold text-blue-600">
              Buka <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </p>
          </Link>
        ))}
      </div>

      {/* Pengelolaan */}
      <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-400">Pengelolaan</h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pengelolaan.map((m) => (
          <Link key={m.href} href={m.href} className="card group p-4 transition hover:border-emerald-300 hover:shadow-md">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${m.color} text-white shadow-sm`}>
              <m.icon className="h-5 w-5" />
            </div>
            <p className="mt-2 font-extrabold text-slate-900 group-hover:text-emerald-700">{m.label}</p>
            <p className="mt-0.5 text-xs text-slate-500">{m.desc}</p>
            <p className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-600">
              Buka <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </p>
          </Link>
        ))}
      </div>

      {/* Sistem */}
      <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-400">Sistem</h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {sistem.map((m) => (
          <Link key={m.href} href={m.href} className="card group p-4 transition hover:border-slate-300 hover:shadow-md">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${m.color} text-white shadow-sm`}>
              <m.icon className="h-5 w-5" />
            </div>
            <p className="mt-2 font-extrabold text-slate-900 group-hover:text-slate-700">{m.label}</p>
            <p className="mt-0.5 text-xs text-slate-500">{m.desc}</p>
            <p className="mt-2 flex items-center gap-1 text-xs font-bold text-slate-600">
              Buka <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
