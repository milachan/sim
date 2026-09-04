import Link from "next/link";
import { Activity, BookOpenCheck, ClipboardCheck, Info, TrendingDown, UserCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import RiwayatAbsensiPribadi from "@/components/riwayat-absensi-pribadi";
import { STATUS_ABSENSI_BADGE, STATUS_ABSENSI_LABEL } from "@/lib/constants";
import { persen } from "@/lib/utils";
import type { StatusAbsensi } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUSES: StatusAbsensi[] = ["HADIR", "SAKIT", "IZIN", "ALPA", "TERLAMBAT", "DISPENSASI"];

export default async function AbsensiPribadiPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  // Absensi Pribadi khusus pengajar (GURU/WAKA dengan guruId) — Waka tanpa guruId / Kamad ditolak.
  if (user.role === "KEPALA" || (user.role === "WAKA" && !user.guruId)) {
    return (
      <div className="fade-up">
        <PageHeader
          title="Absensi Pribadi"
          subtitle="Catatan kehadiran yang Anda isi di tiap pertemuan"
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

  // Absensi pribadi = catatan per pertemuan (AbsensiItem) yang guru isi secara
  // opsional saat melengkapi jurnal — BUKAN absensi harian resmi kelas. Guru
  // melihat catatannya sendiri; Admin melihat seluruh kelas sebagai pemantau.
  const wherePertemuan = isGuru && user.guruId ? { OR: [{ jadwal: { guruId: user.guruId } }, { dibuatOlehId: user.id }] } : {};

  // Ambil SEMUA pertemuan berabsensi (tanpa batas) agar rekap & statistik
  // akurat; riwayat yang tampil dibatasi di komponen (muat bertahap).
  const [pertemuan, siswa] = await Promise.all([
    prisma.pertemuan.findMany({
      where: { ...wherePertemuan, absensi: { some: {} } },
      select: {
        id: true,
        tanggal: true,
        pertemuanKe: true,
        jadwal: { select: { kelas: { select: { nama: true } }, mapel: { select: { nama: true } } } },
        kelas: { select: { nama: true } },
        mapel: { select: { nama: true } },
        absensi: { select: { siswaId: true, status: true } },
      },
      orderBy: { tanggal: "desc" },
    }),
    prisma.siswa.findMany({
      where: { status: "AKTIF", deletedAt: null },
      include: { kelas: true },
      orderBy: { nama: "asc" },
    }),
  ]);

  // Rekap per siswa dari catatan pribadi tiap pertemuan.
  const perSiswa = new Map<string, Record<string, number>>();
  for (const p of pertemuan) {
    for (const a of p.absensi) {
      const m = perSiswa.get(a.siswaId) ?? {};
      m[a.status] = (m[a.status] ?? 0) + 1;
      perSiswa.set(a.siswaId, m);
    }
  }
  const rows = siswa
    .map((s) => {
      const m = perSiswa.get(s.id) ?? {};
      const total = STATUSES.reduce((a, st) => a + (m[st] ?? 0), 0);
      const hadir = m.HADIR ?? 0;
      const absen = (m.ALPA ?? 0) + (m.SAKIT ?? 0) + (m.IZIN ?? 0);
      return { siswa: s, m, total, hadir, absen };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.absen - a.absen);

  const totalCatatan = rows.reduce((a, r) => a + r.total, 0);
  const totalHadir = rows.reduce((a, r) => a + r.hadir, 0);
  const palingAbsen = rows.slice(0, 5);

  // Baris riwayat ringkas (tanpa membawa data siswa) — dikirim ke komponen client.
  const riwayat = pertemuan.map((p) => {
    const total = p.absensi.length;
    const hadir = p.absensi.filter((a) => a.status === "HADIR").length;
    const jadwal = p.jadwal;
    return {
      id: p.id,
      tanggal: p.tanggal.toISOString().slice(0, 10),
      mapel: jadwal?.mapel?.nama ?? p.mapel?.nama ?? "Mapel",
      kelas: jadwal?.kelas?.nama ?? p.kelas?.nama ?? "Kelas",
      pertemuanKe: p.pertemuanKe,
      hadir,
      total,
    };
  });

  return (
    <div className="fade-up">
      <PageHeader
        title="Absensi Pribadi"
        subtitle={isGuru ? "Rekap kehadiran yang Anda catat per pertemuan" : "Pemantauan catatan absensi pertemuan seluruh kelas"}
        icon={<ClipboardCheck className="h-6 w-6" />}
      />

      {/* Catatan pembeda — sekali saja, ringkas */}
      <p className="mb-5 flex items-start gap-1.5 rounded-xl bg-sky-50 px-3.5 py-2.5 text-xs font-semibold leading-snug text-sky-800 ring-1 ring-inset ring-sky-100">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-500" />
        Catatan pribadi dari tab Absensi pertemuan — terpisah dari{" "}
        <Link href="/absensi-harian" className="font-bold underline decoration-sky-300 underline-offset-2 hover:text-sky-600">
          Absensi Harian
        </Link>{" "}
        resmi kelas.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Pertemuan Tercatat" value={pertemuan.length} sub="dengan catatan absensi" icon={<BookOpenCheck className="h-6 w-6" />} />
        <StatCard label="Total Catatan" value={totalCatatan} sub="kehadiran siswa" icon={<Activity className="h-6 w-6" />} />
        <StatCard label="Tingkat Hadir" value={totalCatatan ? `${persen(totalHadir, totalCatatan)}%` : "-"} sub="dari catatan Anda" color="bg-teal-600" icon={<UserCheck className="h-6 w-6" />} />
        <StatCard label="Perlu Perhatian" value={palingAbsen.length} sub="paling sering tidak hadir" color="bg-rose-500" icon={<TrendingDown className="h-6 w-6" />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Rekap per siswa + riwayat */}
        <div className="space-y-6 lg:col-span-2">
          <section>
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 className="font-extrabold text-slate-900">Rekap per Siswa</h2>
              <span className="text-xs font-semibold text-slate-400">{rows.length} siswa tercatat</span>
            </div>
            {rows.length === 0 ? (
              <EmptyState
                title="Belum ada catatan pribadi"
                desc="Mulai dari tab Absensi pada halaman pertemuan yang Anda lengkapi."
              />
            ) : (
              <Card className="overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <div key={r.siswa.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-bold text-slate-900">{r.siswa.nama}</p>
                        <p className="text-xs text-slate-400">{r.siswa.kelas?.nama ?? "—"}</p>
                        {/* Hanya status yang punya catatan — tanpa tabel lebar */}
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {STATUSES.map((s) =>
                            (r.m[s] ?? 0) > 0 ? (
                              <span key={s} className={"chip !px-2 text-[10px] " + STATUS_ABSENSI_BADGE[s]}>
                                {STATUS_ABSENSI_LABEL[s]} {r.m[s]}
                              </span>
                            ) : null
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-base font-extrabold leading-tight text-emerald-600">{persen(r.hadir, r.total)}%</p>
                        <p className="text-[10px] font-semibold text-slate-400">{r.total} catatan</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </section>

          <RiwayatAbsensiPribadi items={riwayat} />
        </div>

        {/* Siswa paling sering tidak hadir */}
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="font-extrabold text-slate-900">Sering Tidak Hadir</h2>
            <span className="text-xs font-semibold text-slate-400">top 5</span>
          </div>
          <Card className="overflow-hidden">
            {palingAbsen.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">Belum ada data.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {palingAbsen.map((r, i) => (
                  <div key={r.siswa.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                        i === 0 ? "bg-rose-500 text-white" : i === 1 ? "bg-orange-400 text-white" : i === 2 ? "bg-amber-400 text-white" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-bold text-slate-800">{r.siswa.nama}</p>
                      <p className="break-words text-xs text-slate-400">{r.siswa.kelas?.nama ?? "—"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-rose-600">{r.absen}x</p>
                      <p className="text-[10px] text-slate-400">tidak hadir</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}
