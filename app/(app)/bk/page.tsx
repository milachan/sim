import Link from "next/link";
import { ClipboardCheck, HeartHandshake, StickyNote } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { mulaiHari } from "@/lib/utils";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { getBkAppUrl } from "@/lib/bk-config";

export const dynamic = "force-dynamic";

function parseDate(w: string | null, fallback: Date): Date {
  if (!w) return fallback;
  const d = mulaiHari(w);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function validateSemId(v: string | null): string | null { return v?.trim() ? v.trim() : null; }

export default async function BkPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const isBK = user.role === "GURU" && user.guru?.jenisGuru === "BK";
  const isAdmin = user.role === "ADMIN" || user.role === "SUPERADMIN";
  if (!isBK && !isAdmin) {
    return (
      <div className="fade-up">
        <PageHeader title="Bimbingan Konseling" subtitle="Halaman khusus guru BK" icon={<HeartHandshake className="h-6 w-6" />} />
        <EmptyState title="Menu ini khusus Guru BK" desc="Hanya tersedia untuk guru dengan jenis Guru BK (diatur di Data Guru)." />
      </div>
    );
  }

  const rawKelasId = searchParams.kelasId?.trim() || null;
  const rawSiswaId = searchParams.siswaId?.trim() || null;
  const rawSemesterId = validateSemId(searchParams.semesterId ?? null);
  let dari = parseDate(searchParams.dari ?? null, new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  let sampai = parseDate(searchParams.sampai ?? null, mulaiHari(new Date()));
  if (dari.getTime() > sampai.getTime()) { const t = dari; dari = sampai; sampai = t; }
  const dariKey = dari.toISOString().slice(0,10);
  const sampaiKey = sampai.toISOString().slice(0,10);

  const kelasValid = rawKelasId ? await prisma.kelas.findUnique({ where: { id: rawKelasId }, select: { id: true } }) : null;
  const siswaValid = rawSiswaId ? await prisma.siswa.findUnique({ where: { id: rawSiswaId }, select: { id: true, kelasId: true } }) : null;
  const kelasId = kelasValid ? rawKelasId : null;
  const siswaId = siswaValid ? rawSiswaId : null;

  const semesters = await prisma.semester.findMany({ where: { deletedAt: null }, include: { tahunAjaran: true }, orderBy: { mulai: "desc" } });
  const semesterAktif = semesters.find((s) => s.aktif) ?? semesters[0] ?? null;
  const semesterId = rawSemesterId && semesters.some((s) => s.id === rawSemesterId) ? rawSemesterId : (semesterAktif?.id ?? null);
  const semester = semesters.find((s) => s.id === semesterId) ?? semesterAktif;

  const siswaFilter: Record<string, unknown> = { status: "AKTIF", deletedAt: null };
  if (kelasId) siswaFilter.kelasId = kelasId;
  if (siswaId) siswaFilter.id = siswaId;
  const siswaList = await prisma.siswa.findMany({ where: siswaFilter as never, select: { id: true, nama: true, kelasId: true, kelas: { select: { nama: true } } }, orderBy: { nama: "asc" }, take: 500 });
  const kelasList = await prisma.kelas.findMany({ orderBy: [{ tingkat: "asc" }, { nama: "asc" }], select: { id: true, nama: true } });

  const absenWhere: Record<string, unknown> = {
    tanggal: { gte: mulaiHari(dari), lte: mulaiHari(sampai) },
  };
  if (semesterId) {
    const s = semester;
    if (s?.mulai && s?.selesai) {
      absenWhere.tanggal = { gte: mulaiHari(s.mulai as Date) < mulaiHari(dari) ? mulaiHari(dari) : mulaiHari(s.mulai as Date), lte: mulaiHari(s.selesai as Date) > mulaiHari(sampai) ? mulaiHari(sampai) : mulaiHari(s.selesai as Date) };
    }
  }
  const absenItems = await prisma.absensiHarianItem.findMany({
    where: {
      siswaId: siswaId ? siswaId : undefined,
      absensiHarian: {
        tanggal: absenWhere.tanggal as never,
        ...(kelasId ? { kelasId } : {}),
      },
      siswa: siswaId ? undefined : (kelasId ? { kelasId } : undefined),
    },
    include: { absensiHarian: { include: { kelas: { select: { nama: true } }, pengisi: { select: { nama: true } } } }, siswa: { select: { id: true, nama: true, kelas: { select: { nama: true } } } } },
    orderBy: [{ absensiHarian: { tanggal: "desc" } }],
    take: 800,
  });

  const seen = new Set<string>();
  const dedup: typeof absenItems = [];
  for (const it of absenItems) { const k = `${it.absensiHarian.kelasId}|${it.absensiHarian.tanggal.toISOString().slice(0,10)}|${it.siswaId}`; if (!seen.has(k)) { seen.add(k); dedup.push(it); } }

  const kejadian = await prisma.catatanKejadian.findMany({
    where: {
      siswaId: siswaId ? siswaId : undefined,
      siswa: kelasId ? { kelasId } : undefined,
      pertemuan: { tanggal: { gte: mulaiHari(dari), lte: mulaiHari(sampai) } },
    },
    include: { pertemuan: { include: { jadwal: { include: { guru: { select: { nama: true } }, kelas: { select: { nama: true } } } }, kelas: { select: { nama: true } }, mapel: { select: { nama: true } } } }, siswa: { select: { nama: true, kelas: { select: { nama: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const kejadianFiltered = kejadian.filter((c) => c.siswaId && c.pertemuanId);

  const rekap = { SAKIT: 0, IZIN: 0, ALPA: 0, TERLAMBAT: 0, DISPENSASI: 0, HADIR: 0 } as Record<string, number>;
  for (const it of dedup) rekap[it.status] = (rekap[it.status] ?? 0) + 1;
  const totalTidakHadir = (rekap.SAKIT ?? 0) + (rekap.IZIN ?? 0) + (rekap.ALPA ?? 0) + (rekap.TERLAMBAT ?? 0) + (rekap.DISPENSASI ?? 0);

  const kelasIdsForCheck = kelasId ? [kelasId] : kelasList.map((k) => k.id).slice(0, 40);
  const existingAH = await prisma.absensiHarian.findMany({ where: { tanggal: absenWhere.tanggal as never, ...(kelasId ? { kelasId } : { kelasId: { in: kelasIdsForCheck } }) }, select: { kelasId: true, tanggal: true } });
  const days = Math.min(31, Math.max(1, Math.ceil((sampai.getTime() - dari.getTime()) / 86400000) + 1));
  const totalSlot = kelasIdsForCheck.length * days;
  const belum = Math.max(0, totalSlot - existingAH.length);

  const bkUrl = getBkAppUrl();

  return (
    <div className="fade-up">
      <PageHeader title="Bimbingan Konseling" subtitle={`Pantauan read-only · semester ${semester?.nama ?? "-"} · sumber: Absensi Harian resmi`} icon={<HeartHandshake className="h-6 w-6" />} />
      <form method="get" className="card card-pad mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-slate-700">Semester</span>
            <select name="semesterId" defaultValue={semesterId ?? ""} className="input"><option value="">— Semua —</option>{semesters.map((s) => <option key={s.id} value={s.id}>{s.nama} ({s.tahunAjaran?.nama ?? ""})</option>)}</select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-slate-700">Kelas</span>
            <select name="kelasId" defaultValue={kelasId ?? ""} className="input"><option value="">Semua</option>{kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}</select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-slate-700">Siswa</span>
            <select name="siswaId" defaultValue={siswaId ?? ""} className="input"><option value="">Semua</option>{siswaList.slice(0, 200).map((s) => <option key={s.id} value={s.id}>{s.nama}</option>)}</select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-slate-700">Dari</span>
            <input type="date" name="dari" defaultValue={dariKey} className="input" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-slate-700">Sampai</span>
            <input type="date" name="sampai" defaultValue={sampaiKey} className="input" />
          </label>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
            <button className="btn-primary min-h-11 flex-1">Terapkan</button>
            <Link href="/bk" className="btn-ghost min-h-11">Reset</Link>
          </div>
        </div>
      </form>

      <div className="grid grid-cols-1 gap-3 [@media(min-width:340px)]:grid-cols-2 sm:grid-cols-3 sm:gap-4">
        <Card className="card-pad"><p className="text-xs font-bold text-slate-500">Tidak hadir (SAKIT/IZIN/ALPA/DISPENSASI/TERLAMBAT)</p><p className="mt-1 text-2xl font-extrabold">{totalTidakHadir}</p><p className="mt-1 break-words text-xs leading-snug text-slate-400">Sumber: Absensi Harian resmi</p></Card>
        <Card className="card-pad"><p className="text-xs font-bold text-slate-500">Belum diisi</p><p className="mt-1 text-2xl font-extrabold">{belum}</p><p className="mt-1 break-words text-xs leading-snug text-slate-400">Kelas × tanggal tanpa Absensi Harian — tidak dianggap alpa</p></Card>
        <Card className="card-pad [@media(min-width:340px)]:col-span-2 sm:col-span-1"><p className="text-xs font-bold text-slate-500">Catatan siswa (jurnal)</p><p className="mt-1 text-2xl font-extrabold">{kejadianFiltered.length}</p><p className="mt-1 break-words text-xs leading-snug text-slate-400">Sumber: Catatan Kejadian jurnal Guru</p></Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 break-words font-extrabold"><ClipboardCheck className="h-4 w-4 shrink-0" /> Ketidakhadiran (dari Absensi Harian)</h2>
          <span className="text-xs text-slate-400">{dedup.length} baris · dedup kelas/tanggal/siswa</span>
        </div>
        {dedup.length === 0 ? <div className="p-6"><EmptyState title="Tidak ada catatan ketidakhadiran pada filter ini" desc="Absensi yang belum diisi tidak dianggap alpa. Ubah filter atau rentang tanggal." /></div> : (
          <>
            <div className="hidden overflow-x-auto overscroll-x-contain sm:block">
              <table className="w-full min-w-[640px] text-sm"><thead className="bg-slate-50"><tr><th className="th">Tanggal</th><th className="th">Kelas</th><th className="th">Siswa</th><th className="th">Status</th><th className="th">Keterangan</th><th className="th">Sumber</th></tr></thead>
                <tbody>{dedup.slice(0, 120).map((it) => (
                  <tr key={it.id} className="border-t border-slate-100">
                    <td className="td whitespace-nowrap">{it.absensiHarian.tanggal.toISOString().slice(0,10)}</td>
                    <td className="td">{it.absensiHarian.kelas?.nama ?? "-"}</td>
                    <td className="td font-semibold">{it.siswa.nama}</td>
                    <td className="td">{it.status}</td>
                    <td className="td max-w-[28ch] truncate" title={it.catatan ?? undefined}>{it.catatan ?? "-"}</td>
                    <td className="td text-xs text-slate-500">{it.absensiHarian.pengisi?.nama ?? "-"} · Absensi Harian</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="divide-y divide-slate-100 sm:hidden">
              {dedup.slice(0, 60).map((it) => (
                <div key={it.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">{it.absensiHarian.tanggal.toISOString().slice(0,10)}</span>
                    <span className="chip bg-slate-100 text-slate-600">{it.absensiHarian.kelas?.nama ?? "-"}</span>
                    <span className="chip bg-amber-100 text-amber-700">{it.status}</span>
                  </div>
                  <p className="mt-1 break-words text-sm font-bold text-slate-900">{it.siswa.nama}</p>
                  {it.catatan && <p className="mt-1 break-words text-xs text-slate-500">{it.catatan}</p>}
                  <p className="mt-1 text-xs text-slate-400">{it.absensiHarian.pengisi?.nama ?? "-"} · Absensi Harian</p>
                </div>
              ))}
            </div>
            <p className="border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-[11px] font-semibold text-slate-500 sm:hidden">Geser atau lihat kartu — tabel lengkap tersedia di desktop</p>
          </>
        )}
      </Card>

      <Card className="mt-6 overflow-hidden">
        <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 break-words font-extrabold"><StickyNote className="h-4 w-4 shrink-0" /> Catatan siswa dari jurnal Guru</h2>
          <span className="text-xs text-slate-400">{kejadianFiltered.length} catatan</span>
        </div>
        {kejadianFiltered.length === 0 ? <div className="p-6"><EmptyState title="Belum ada catatan" desc="Menampilkan Catatan Kejadian yang punya relasi siswa valid." /></div> : (
          <div className="divide-y divide-slate-100">{kejadianFiltered.slice(0, 40).map((c) => (
            <div key={c.id} className="px-5 py-3">
              <p className="break-words text-sm"><span className="font-bold">{c.siswa.nama}</span> · {c.jenis} {c.keterangan ? `— ${c.keterangan}` : ""}</p>
              <p className="mt-1 break-words text-xs leading-snug text-slate-500">{c.pertemuan?.tanggal ? new Date(c.pertemuan.tanggal).toISOString().slice(0,10) : "-"} · {c.pertemuan?.kelas?.nama ?? c.pertemuan?.jadwal?.kelas?.nama ?? "-"} · {c.pertemuan?.jadwal?.guru?.nama ?? "-"} · pertemuan {c.pertemuan?.id?.slice(0,6) ?? "-"}</p>
            </div>
          ))}</div>
        )}
      </Card>

      {bkUrl ? (
        <Card className="card-pad mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="break-words text-sm text-slate-600">Kelola pelanggaran/poin/konseling di aplikasi BK khusus.</p>
          <a href={bkUrl} target="_blank" rel="noopener noreferrer" className="btn-primary min-h-11 w-full shrink-0 sm:w-auto">Buka Aplikasi BK</a>
        </Card>
      ) : (
        <Card className="card-pad mt-6"><p className="break-words text-sm text-slate-500">Tautan aplikasi BK belum dikonfigurasi. Atur <code>BK_APP_URL</code> di environment.</p></Card>
      )}
    </div>
  );
}
