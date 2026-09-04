import { redirect } from "next/navigation";
import { ClipboardCheck, Info, School, UserCheck, Activity, TrendingDown } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, PageHeader, StatCard, TableRow, TableShell, Td, Th } from "@/components/ui";
import { STATUS_ABSENSI_LABEL } from "@/lib/constants";
import { formatTanggal, mulaiHari, persen } from "@/lib/utils";
import { cariKelasWaliGuruPadaSemester } from "@/lib/wali-kelas";
import type { StatusAbsensi } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUSES: StatusAbsensi[] = ["HADIR", "SAKIT", "IZIN", "ALPA", "TERLAMBAT", "DISPENSASI"];

export default async function RekapKelasPage({
  searchParams,
}: {
  searchParams: { semester?: string; kelas?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Rekap ini masih menunggu sistem siap digunakan resmi — Waka tanpa guruId/Kamad belum
  // diaktifkan (menu pun disembunyikan). Waka yang mengajar tetap bisa melihat kelasnya.
  if (user.role === "KEPALA" || (user.role === "WAKA" && !user.guruId)) {
    return (
      <div className="fade-up">
        <PageHeader
          title="Rekap Kehadiran Kelas"
          subtitle="Analisis kehadiran siswa per kelas"
          icon={<ClipboardCheck className="h-6 w-6" />}
        />
        <EmptyState
          title="Menu belum tersedia untuk akun ini"
          desc="Menu rekap & pemantauan absensi akan diaktifkan setelah sistem siap digunakan secara resmi."
        />
      </div>
    );
  }

  const isGuru = !!user.guruId && (user.role === "GURU" || user.role === "WAKA");

  const [semesters, kelasSaya] = await Promise.all([
    prisma.semester.findMany({
      where: { deletedAt: null },
      include: { tahunAjaran: true },
      orderBy: [{ aktif: "desc" }, { tahunAjaran: { aktif: "desc" } }, { nama: "asc" }],
    }),
    isGuru && user.guruId
      ? prisma.kelas.findMany({ where: { waliKelasId: user.guruId }, orderBy: [{ tingkat: "asc" }, { nama: "asc" }] })
      : Promise.resolve([]),
  ]);

  // Default semester: pilihan eksplisit, semester aktif (read-only — `cariSemesterAktif`
  // mengubah flag, tidak dipakai di sini), atau periode pertama.
  const semester =
    semesters.find((s) => s.id === searchParams.semester) ??
    semesters.find((s) => s.aktif) ??
    semesters[0] ??
    null;

  // Kelas untuk guru = kelas yang ia walikan PADA SEMESTER TERSEBUT (riwayat),
  // bukan hanya kelas wali saat ini. Data lama tanpa riwayat memakai fallback.
  const kelasList =
    isGuru && user.guruId
      ? await (async () => {
          const ids = await cariKelasWaliGuruPadaSemester(user.guruId!, semester ? { id: semester.id, mulai: semester.mulai, selesai: semester.selesai } : null);
          const dariIds = ids.length
            ? await prisma.kelas.findMany({ where: { id: { in: ids } }, orderBy: [{ tingkat: "asc" }, { nama: "asc" }] })
            : [];
          return dariIds.length > 0 ? dariIds : kelasSaya;
        })()
      : await prisma.kelas.findMany({ orderBy: [{ tingkat: "asc" }, { nama: "asc" }] });

  const kelas = kelasList.find((k) => k.id === searchParams.kelas) ?? kelasList[0] ?? null;

  // Guru non-wali kelas (atau belum ada kelas/wali) → tampilkan penjelasan.
  if (isGuru && kelasList.length === 0) {
    return (
      <div className="fade-up">
        <PageHeader
          title="Rekap Kehadiran Kelas"
          subtitle="Analisis kehadiran siswa di kelas yang Anda walikan"
          icon={<ClipboardCheck className="h-6 w-6" />}
        />
        <EmptyState
          title="Anda belum menjadi wali kelas"
          desc="Fitur ini menampilkan rekap kehadiran kelas yang Anda walikan. Bila wali kelas diatur di menu Kelas & Rombel, halaman ini otomatis menampilkan kelas Anda."
        />
      </div>
    );
  }

  if (!semester || !kelas) {
    return (
      <div className="fade-up">
        <PageHeader
          title="Rekap Kehadiran Kelas"
          subtitle="Analisis kehadiran siswa per kelas"
          icon={<ClipboardCheck className="h-6 w-6" />}
        />
        <EmptyState
          title="Belum ada periode atau kelas"
          desc="Atur tahun ajaran & periode, lalu buat kelas dan jadwal terlebih dahulu."
        />
      </div>
    );
  }

  // AbsensiHarian tidak punya semesterId — periode dibatasi lewat rentang
  // tanggal semester bila tersedia; tanpa rentang, seluruh riwayat kelas tampil.
  const filterTanggal: Record<string, Date> = {};
  if (semester.mulai) filterTanggal.gte = mulaiHari(semester.mulai);
  if (semester.selesai) filterTanggal.lte = mulaiHari(semester.selesai);

  const [siswaKelas, items] = await Promise.all([
    prisma.siswa.findMany({
      where: { kelasId: kelas.id, status: "AKTIF", deletedAt: null },
      select: { id: true, nama: true, nis: true },
      orderBy: { nama: "asc" },
    }),
    prisma.absensiHarianItem.findMany({
      where: {
        absensiHarian: {
          kelasId: kelas.id,
          ...(Object.keys(filterTanggal).length ? { tanggal: filterTanggal } : {}),
        },
      },
      select: { siswaId: true, status: true, absensiHarian: { select: { tanggal: true } } },
    }),
  ]);

  // Daftar siswa = siswa aktif kelas saat ini + siswa yang pernah tercatat pada
  // AbsensiHarian kelas ini di periode tsb (menangani siswa yang sudah pindah
  // kelas: data lama tetap tampil, tidak dicampur dengan kelas lain).
  const siswaTambahan = await prisma.siswa.findMany({
    where: { id: { in: [...new Set(items.map((i) => i.siswaId))] } },
    select: { id: true, nama: true, nis: true },
  });
  const siswaList = [...siswaKelas, ...siswaTambahan.filter((t) => !siswaKelas.some((x) => x.id === t.id))].sort(
    (a, b) => (a.nama < b.nama ? -1 : 1)
  );

  const perSiswa = new Map<string, Record<string, number>>();
  const perBulan = new Map<string, Record<string, number>>();
  for (const it of items) {
    const sm = perSiswa.get(it.siswaId) ?? {};
    sm[it.status] = (sm[it.status] ?? 0) + 1;
    perSiswa.set(it.siswaId, sm);

    const t = it.absensiHarian.tanggal;
    const kunci = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
    const bm = perBulan.get(kunci) ?? {};
    bm[it.status] = (bm[it.status] ?? 0) + 1;
    perBulan.set(kunci, bm);
  }

  const rows = siswaList.map((s) => {
    const m = perSiswa.get(s.id) ?? {};
    const total = STATUSES.reduce((a, st) => a + (m[st] ?? 0), 0);
    const hadir = m.HADIR ?? 0;
    return { siswa: s, m, total, hadir };
  });
  const jumlahHariTercatat = new Set(items.map((i) => i.absensiHarian.tanggal.toISOString())).size;
  const totalSeharusnya = siswaKelas.length * jumlahHariTercatat;
  const totalCatatan = items.length;
  const totalHadir = rows.reduce((a, r) => a + r.hadir, 0);
  const palingTidakHadir = rows
    .map((r) => ({ ...r, tidakHadir: (r.m.SAKIT ?? 0) + (r.m.IZIN ?? 0) + (r.m.ALPA ?? 0) }))
    .filter((r) => r.tidakHadir > 0)
    .sort((a, b) => b.tidakHadir - a.tidakHadir)
    .slice(0, 5);

  const bulanRows = [...perBulan.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([kunci, m]) => {
      const [tahun, bulan] = kunci.split("-").map(Number);
      const label = format(new Date(Date.UTC(tahun, bulan - 1, 1)), "MMMM yyyy", { locale: localeId });
      const total = STATUSES.reduce((a, st) => a + (m[st] ?? 0), 0);
      return { kunci, label, m, total, hadir: m.HADIR ?? 0 };
    });

  return (
    <div className="fade-up">
      <PageHeader
        title="Rekap Kehadiran Kelas"
        subtitle={isGuru ? "Analisis kehadiran siswa di kelas yang Anda walikan" : "Analisis kehadiran siswa per kelas — pemantauan Waka & Kepala Madrasah"}
        icon={<ClipboardCheck className="h-6 w-6" />}
      />

      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 p-3.5 text-sm text-sky-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Rekap ini memakai <strong>satu data absensi harian kelas</strong> yang diisi guru jam pertama (guru piket sebagai
          backup). Periode dibatasi sesuai rentang tanggal <strong>{semester.nama} — {semester.tahunAjaran.nama}</strong>
          {semester.mulai && semester.selesai
            ? ` (${formatTanggal(semester.mulai, "d MMM yyyy")} – ${formatTanggal(semester.selesai, "d MMM yyyy")})`
            : semester.mulai
              ? ` (mulai ${formatTanggal(semester.mulai, "d MMM yyyy")})`
              : semester.selesai
                ? ` (sampai ${formatTanggal(semester.selesai, "d MMM yyyy")})`
                : " (tanpa rentang tanggal — seluruh riwayat kelas ditampilkan)"}.
        </p>
      </div>

      {/* Filter periode & kelas */}
      <Card className="card-pad mb-6">
        <form method="get" className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Periode</label>
            <select name="semester" className="input" defaultValue={semester.id}>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama} — {s.tahunAjaran.nama}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Kelas</label>
            <select name="kelas" className="input" defaultValue={kelas.id}>
              {kelasList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <button className="btn-primary btn-sm">Tampilkan</button>
          </div>
        </form>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Siswa" value={rows.length} sub={`kelas ${kelas.nama}`} icon={<School className="h-6 w-6" />} />
        <StatCard label="Total Catatan" value={totalCatatan} sub="absensi tercatat" icon={<Activity className="h-6 w-6" />} />
        <StatCard
          label="Tingkat Kehadiran"
          value={totalSeharusnya ? `${persen(totalHadir, totalSeharusnya)}%` : totalCatatan ? `${persen(totalHadir, totalCatatan)}%` : "-"}
          sub={totalSeharusnya ? `${totalHadir} hadir dari ${totalSeharusnya} seharusnya` : "dari seluruh catatan"}
          color="bg-teal-600"
          icon={<UserCheck className="h-6 w-6" />}
        />
        <StatCard
          label="Perlu Perhatian"
          value={palingTidakHadir.length}
          sub="siswa sering tidak hadir"
          color="bg-rose-500"
          icon={<TrendingDown className="h-6 w-6" />}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Rekap per siswa */}
        <div className="lg:col-span-2">
          <h2 className="mb-3 flex items-center gap-2 font-extrabold text-slate-900">
            Rekap per Siswa <span className="chip bg-slate-100 text-slate-500">{kelas.nama}</span>
          </h2>
          {totalCatatan === 0 ? (
            <EmptyState title="Belum ada catatan absensi" desc="Absensi harian muncul setelah guru jam pertama atau guru piket mengisi kelas ini." />
          ) : (
            <TableShell>
              <thead>
                <tr>
                  <Th>Siswa</Th>
                  <Th>NIS</Th>
                  {STATUSES.map((s) => (
                    <Th key={s} className="!px-2 text-center">{STATUS_ABSENSI_LABEL[s]}</Th>
                  ))}
                  <Th className="text-center">Total</Th>
                  <Th className="text-center">Hadir %</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <TableRow key={r.siswa.id}>
                    <Td className="font-bold text-slate-900">{r.siswa.nama}</Td>
                    <Td className="text-slate-400">{r.siswa.nis ?? "-"}</Td>
                    {STATUSES.map((s) => (
                      <Td key={s} className="text-center">
                        <span className={r.m[s] ? "font-extrabold" : "text-slate-300"}>{r.m[s] ?? 0}</span>
                      </Td>
                    ))}
                    <Td className="text-center font-bold">{r.total}</Td>
                    <Td className="text-center font-extrabold text-emerald-600">{persen(r.hadir, r.total)}%</Td>
                  </TableRow>
                ))}
              </tbody>
            </TableShell>
          )}

          {/* Rekap per bulan */}
          <h2 className="mb-3 mt-8 font-extrabold text-slate-900">Rekap per Bulan</h2>
          {bulanRows.length === 0 ? (
            <EmptyState title="Belum ada data bulanan" />
          ) : (
            <TableShell>
              <thead>
                <tr>
                  <Th>Bulan</Th>
                  {STATUSES.map((s) => (
                    <Th key={s} className="!px-2 text-center">{STATUS_ABSENSI_LABEL[s].slice(0, 4)}</Th>
                  ))}
                  <Th className="text-center">Total</Th>
                  <Th className="text-center">Hadir %</Th>
                </tr>
              </thead>
              <tbody>
                {bulanRows.map((b) => (
                  <TableRow key={b.kunci}>
                    <Td className="font-bold text-slate-900">{b.label}</Td>
                    {STATUSES.map((s) => (
                      <Td key={s} className="text-center">
                        <span className={b.m[s] ? "font-bold" : "text-slate-300"}>{b.m[s] ?? 0}</span>
                      </Td>
                    ))}
                    <Td className="text-center font-bold">{b.total}</Td>
                    <Td className="text-center font-extrabold text-emerald-600">{persen(b.hadir, b.total)}%</Td>
                  </TableRow>
                ))}
              </tbody>
            </TableShell>
          )}
        </div>

        {/* Siswa paling sering tidak hadir */}
        <div>
          <h2 className="mb-3 font-extrabold text-slate-900">Siswa Paling Sering Tidak Hadir</h2>
          <Card className="overflow-hidden">
            {palingTidakHadir.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">Tidak ada catatan ketidakhadiran di periode ini.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {palingTidakHadir.map((r, i) => (
                  <div key={r.siswa.id} className="flex items-center gap-3 px-4 py-3">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                        i === 0 ? "bg-rose-500 text-white" : i === 1 ? "bg-orange-400 text-white" : i === 2 ? "bg-amber-400 text-white" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800">{r.siswa.nama}</p>
                      <p className="text-xs text-slate-400">NIS {r.siswa.nis ?? "-"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-rose-600">{r.tidakHadir}x</p>
                      <p className="text-[10px] text-slate-400">tidak hadir</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {!isGuru && (
            <div className="mt-6">
              <h2 className="mb-3 font-extrabold text-slate-900">Semua Kelas</h2>
              <Card className="card-pad">
                <div className="flex flex-wrap gap-2">
                  {kelasList.map((k) => (
                    <a
                      key={k.id}
                      href={`/rekap-kelas?semester=${semester.id}&kelas=${k.id}`}
                      className={`chip transition ${k.id === kelas.id ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                    >
                      {k.nama}
                    </a>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
