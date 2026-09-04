import { Download, FileBarChart } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { PertemuanBadge, JurnalBadge } from "@/components/status-badge";
import { TombolCetak } from "@/components/tombol-cetak";
import { SelectNavigasi } from "@/components/select-navigasi";
import { STATUS_ABSENSI_LABEL } from "@/lib/constants";
import { hitungKelengkapanPerGuru, namaGuruPertemuan, wherePertemuanGuruAkun } from "@/lib/laporan";
import { formatTanggal, persen } from "@/lib/utils";
import { mulaiHari } from "@/lib/utils";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

function bulanOptions() {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("id-ID", { month: "long", year: "numeric" }) });
  }
  return out;
}

export default async function LaporanPage({ searchParams }: { searchParams: { bulan?: string; kelas?: string; t?: string; semua?: string } }) {
  const user = await getCurrentUser();
  const isGuru = user?.role === "GURU";
  const isKamad = user?.role === "KEPALA";
  // Absensi belum jadi absensi resmi madrasah — rekap kehadiran hanya tampil
  // untuk Guru (catatan kelas sendiri) dan Admin. Kamad & Waka tidak melihatnya.
  const bisaAbsensi = isGuru || ["ADMIN", "SUPERADMIN"].includes(user?.role ?? "");
  const bulan = searchParams.bulan ?? new Date().toISOString().slice(0, 7);
  const [tahun, bulanNum] = bulan.split("-").map(Number);

  const start = mulaiHari(new Date(Date.UTC(tahun, bulanNum - 1, 1)));
  const endInclusive = (() => { const e = mulaiHari(new Date(Date.UTC(tahun, bulanNum, 0))); const n = new Date(e); n.setUTCDate(n.getUTCDate() + 1); n.setUTCMilliseconds(-1); return n; })();
  const end = endInclusive;
  const kelasFilter = searchParams.kelas;

  const tabDefault = isGuru ? "jurnal" : "kelengkapan";
  const tabs = [
    { id: "jurnal", label: "Jurnal" },
    ...(bisaAbsensi ? [{ id: "absensi", label: "Absensi" }] : []),
    ...(isGuru
      ? [{ id: "ringkasan", label: "Ringkasan" }]
      : [{ id: "kelengkapan", label: "Kelengkapan Guru" }]),
  ];
  // Param t hanya diterima bila tab itu tersedia untuk peran tsb (mis. sisa
  // bookmark ?t=ringkasan milik Guru tidak berlaku utk Kamad) — selain itu
  // dipaksa ke tab default agar tab selalu tersorot benar.
  const tabKandidat = searchParams.t === "absensi" && !bisaAbsensi ? undefined : searchParams.t;
  const tab = tabKandidat && tabs.some((t) => t.id === tabKandidat) ? tabKandidat : tabDefault;

  // ---- Data jurnal ----
  const whereP: Prisma.PertemuanWhereInput = { tanggal: { gte: start, lte: end } };
  if (isGuru && user?.guruId && user?.id) {
    whereP.OR = wherePertemuanGuruAkun(user.guruId, user.id).OR;
  }
  const pertemuan = await prisma.pertemuan.findMany({
    where: whereP,
    include: { jadwal: { include: { kelas: true, mapel: true, guru: true } }, kelas: true, mapel: true, dibuatOleh: { select: { id: true, nama: true, guruId: true } }, jurnal: true },
    orderBy: { tanggal: "asc" },
  });
  const totalP = pertemuan.length;
  const lengkapP = pertemuan.filter((p) => p.status === "LENGKAP").length;

  // ---- Data absensi harian per kelas (satu data, mengikuti filter bulan) ----
  const kelasList = await prisma.kelas.findMany({ orderBy: [{ tingkat: "asc" }, { nama: "asc" }] });
  const filterAbsensiHarian: Record<string, unknown> = {
    tanggal: { gte: start, lte: end },
    ...(isGuru && user?.guruId
      ? {
          OR: [
            { pengisiId: user.id },
            { kelas: { jadwal: { some: { guruId: user.guruId } } } },
          ],
        }
      : {}),
    ...(kelasFilter ? { kelasId: kelasFilter } : {}),
  };
  const absensi = await prisma.absensiHarianItem.findMany({
    where: { absensiHarian: filterAbsensiHarian },
    include: { siswa: { include: { kelas: true } }, absensiHarian: { include: { kelas: true, pengisi: true } } },
    take: 3000,
  });
  const rekapAbs = { HADIR: 0, SAKIT: 0, IZIN: 0, ALPA: 0, TERLAMBAT: 0, DISPENSASI: 0 } as Record<string, number>;
  for (const a of absensi) rekapAbs[a.status]++;

  // ---- Kelengkapan per guru (periodik — mengikuti filter bulan yang dipilih) ----
  // Guru hanya melihat baris miliknya sendiri; Waka/Kamad/Admin melihat semua guru.
  const filterKelengkapanGuru: Prisma.PertemuanWhereInput =
  isGuru && user?.guruId && user?.id ? wherePertemuanGuruAkun(user.guruId, user.id) : {};
  const semuaPertemuan = await prisma.pertemuan.findMany({
    where: {
      tanggal: { gte: start, lte: end },
      ...filterKelengkapanGuru,
    },
    include: { jadwal: { include: { guru: true } }, dibuatOleh: { select: { id: true, nama: true, guruId: true } }, jurnal: true },
  });
  const guruList = isGuru && user?.guruId
    ? await prisma.guru.findMany({ where: { id: user.guruId, status: true, deletedAt: null }, orderBy: { nama: "asc" } })
    : await prisma.guru.findMany({ where: { status: true, deletedAt: null }, orderBy: { nama: "asc" } });
  const perGuru = hitungKelengkapanPerGuru(
    semuaPertemuan,
    guruList.map((g) => ({ id: g.id, nama: g.nama }))
  );
  // Kelengkapan antar guru: sembunyikan guru tanpa pertemuan bulan itu agar
  // rekap tidak dipenuhi baris 0/0 (guru tidak mengajar = tidak ada kewajiban).
  // Tetap bisa menampilkan semua via ?semua=1.
  const tampilSemuaGuru = searchParams.semua === "1";
  const perGuruTampil = !isGuru && !tampilSemuaGuru ? perGuru.filter((g) => g.total > 0) : perGuru;

  return (
    <div className="fade-up">
      <PageHeader
        title="Laporan & Ekspor"
        subtitle="Laporan jurnal, absensi, dan kelengkapan — unduh Excel atau cetak PDF"
        icon={<FileBarChart className="h-6 w-6" />}
      />

      {/* Filter */}
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="w-full sm:w-auto">
          <label className="label">Bulan</label>
          <SelectNavigasi param="bulan" value={bulan} options={bulanOptions()} />
        </div>
        {tab === "absensi" && (
          <div className="w-full sm:w-auto">
            <label className="label">Kelas</label>
            <SelectNavigasi
              param="kelas"
              value={kelasFilter ?? ""}
              options={[{ value: "", label: "Semua kelas" }, ...kelasList.map((k) => ({ value: k.id, label: k.nama }))]}
            />
          </div>
        )}
        <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:flex-wrap">
          {tab === "jurnal" && (
            <a href={`/api/export?t=jurnal&bulan=${bulan}`} className="btn-primary btn-sm min-h-11 w-full justify-center sm:w-auto">
              <Download className="h-4 w-4" /> Unduh Excel
            </a>
          )}
          {tab === "absensi" && (
            <a href={`/api/export?t=absensi&bulan=${bulan}${kelasFilter ? `&kelas=${kelasFilter}` : ""}`} className="btn-primary btn-sm min-h-11 w-full justify-center sm:w-auto">
              <Download className="h-4 w-4" /> Unduh Excel
            </a>
          )}
          {(tab === "kelengkapan" || tab === "ringkasan") && (
            <a href={`/api/export?t=kelengkapan&bulan=${bulan}${!isGuru && tampilSemuaGuru ? "&semua=1" : ""}`} className="btn-primary btn-sm min-h-11 w-full justify-center sm:w-auto">
              <Download className="h-4 w-4" /> Unduh Excel
            </a>
          )}
          <div className="w-full sm:w-auto"><TombolCetak /></div>
        </div>
      </div>

      {/* Tab */}
      <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <a
            key={t.id}
            href={`/laporan?t=${t.id}&bulan=${bulan}`}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition ${tab === t.id ? "bg-emerald-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"}`}
          >
            {t.label}
          </a>
        ))}
      </div>

      <div className="print-area">
        {tab === "jurnal" && (
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 print:border-0">
              <h2 className="font-extrabold text-slate-900">Laporan Jurnal Mengajar</h2>
              <p className="text-xs text-slate-500">
                Periode: {bulanOptions().find((b) => b.value === bulan)?.label} · {totalP} pertemuan · {lengkapP} lengkap ({persen(lengkapP, totalP)}%)
              </p>
            </div>
            {totalP === 0 ? (
              <div className="p-5"><EmptyState title="Belum ada data pada periode ini" /></div>
            ) : (
              <div className="overflow-x-auto overscroll-x-contain">
                <table className="w-full min-w-[720px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="th">Tanggal</th>
                      <th className="th">Kelas</th>
                      <th className="th">Mapel</th>
                      {!isGuru && <th className="th">Guru</th>}
                      <th className="th">Materi</th>
                      <th className="th">Jurnal</th>
                      <th className="th">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pertemuan.map((p) => {
                      const kelas = p.kelas ?? p.jadwal?.kelas;
                      const mapel = p.mapel ?? p.jadwal?.mapel;
                      return (
                        <tr key={p.id} className="border-t border-slate-100">
                          <td className="td whitespace-nowrap font-semibold">{formatTanggal(p.tanggal)}</td>
                          <td className="td">{kelas?.nama ?? "-"}</td>
                          <td className="td">{mapel?.nama ?? "-"}</td>
                          {!isGuru && <td className="td">{namaGuruPertemuan(p)?.split(",")[0] ?? "-"}</td>}
                          <td className="td max-w-[280px]"><span className="line-clamp-2">{p.jurnal?.materi ?? <span className="text-rose-500">Belum diisi</span>}</span></td>
                          <td className="td">{p.jurnal ? <JurnalBadge status={p.jurnal.status} /> : <span className="chip bg-rose-100 text-rose-600">Belum</span>}</td>
                          <td className="td"><PertemuanBadge status={p.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {tab === "absensi" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="card-pad lg:col-span-1">
              <h2 className="font-extrabold text-slate-900">Rekap Kehadiran</h2>
              <p className="text-xs text-slate-500">{absensi.length} catatan absensi</p>
              <div className="mt-4 space-y-3">
                {Object.entries(rekapAbs).map(([s, n]) => (
                  <div key={s}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-bold text-slate-600">{STATUS_ABSENSI_LABEL[s as keyof typeof STATUS_ABSENSI_LABEL]}</span>
                      <span className="font-extrabold text-slate-800">{n}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${absensi.length ? (n / absensi.length) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="overflow-hidden lg:col-span-2">
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="font-extrabold text-slate-900">Detail Absensi</h2>
              </div>
              {absensi.length === 0 ? (
                <div className="p-5"><EmptyState title="Belum ada data absensi" /></div>
              ) : (
                <div className="max-h-[480px] overflow-auto">
                  <table className="w-full min-w-[560px]">
                    <thead className="sticky top-0">
                      <tr className="bg-slate-50">
                        <th className="th">Tanggal</th>
                        <th className="th">Siswa</th>
                        <th className="th">Kelas</th>
                        <th className="th">Diisi Oleh</th>
                        <th className="th">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {absensi.map((a) => (
                        <tr key={a.id} className="border-t border-slate-100">
                          <td className="td whitespace-nowrap">{formatTanggal(a.absensiHarian.tanggal)}</td>
                          <td className="td font-bold">{a.siswa.nama}</td>
                          <td className="td">{a.siswa.kelas?.nama ?? a.absensiHarian.kelas?.nama ?? "-"}</td>
                          <td className="td">{a.absensiHarian.pengisi?.nama ?? "-"}</td>
                          <td className="td">
                            <span className="chip bg-slate-100 text-slate-600">{STATUS_ABSENSI_LABEL[a.status]}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {(tab === "kelengkapan" || tab === "ringkasan") && (
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="break-words font-extrabold text-slate-900">
                {isGuru ? "Kelengkapan Jurnal Anda" : "Kelengkapan Jurnal per Guru"}
              </h2>
              <p className="break-words text-xs text-slate-500">
                Periode {bulanOptions().find((b) => b.value === bulan)?.label} · di luar pertemuan tidak terlaksana
                {!isGuru && (
                  <>
                    {" "}· menampilkan {perGuruTampil.length} dari {perGuru.length} guru
                  </>
                )}
              </p>
              {!isGuru && perGuru.some((g) => g.total === 0) && (
                <a
                  href={`/laporan?t=${tab}&bulan=${bulan}${tampilSemuaGuru ? "" : "&semua=1"}`}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
                >
                  {tampilSemuaGuru ? "Sembunyikan guru tanpa pertemuan" : "Tampilkan semua guru (termasuk 0 pertemuan)"}
                </a>
              )}
            </div>
            <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="th">Guru</th>
                  <th className="th">Total Pertemuan</th>
                  <th className="th">Lengkap</th>
                  <th className="th">Persentase</th>
                </tr>
              </thead>
              <tbody>
                {perGuruTampil.map((g) => (
                  <tr key={g.guruId} className="border-t border-slate-100">
                    <td className="td break-words font-bold">{g.nama}</td>
                    <td className="td">{g.total}</td>
                    <td className="td">{g.lengkap}</td>
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 shrink-0 rounded-full bg-slate-100 sm:w-24">
                          <div className={`h-full rounded-full ${g.persen >= 80 ? "bg-emerald-500" : g.persen >= 60 ? "bg-amber-400" : "bg-rose-500"}`} style={{ width: `${g.persen}%` }} />
                        </div>
                        <span className="font-extrabold text-slate-700">{g.persen}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {perGuruTampil.length === 0 && (
              <p className="px-4 py-3 text-sm text-slate-500">Tidak ada guru dengan pertemuan pada periode ini.</p>
            )}
            <p className="border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-[11px] font-semibold text-slate-500 sm:hidden">Geser untuk melihat kolom lain →</p>
          </Card>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-slate-400">
        Semua laporan dapat diekspor ke Excel (tombol Unduh) atau dicetak/disimpan sebagai PDF melalui tombol Cetak.
      </p>
    </div>
  );
}
