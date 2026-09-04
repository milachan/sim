import Link from "next/link";
import { ClipboardCheck, Info, PenLine, UserCheck, UserRound } from "lucide-react";
import { format } from "date-fns";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { jamPembukaHari, STATUS_ABSENSI_HARIAN_BADGE, STATUS_ABSENSI_HARIAN_LABEL, type StatusAbsensiHarian } from "@/lib/constants";
import { formatTanggalPanjang, mulaiHari } from "@/lib/utils";
import { hariDariTanggal, validasiKelengkapanAbsensiHarian } from "@/lib/absensi-harian";
import { cariSemesterUntukTanggal } from "@/lib/semester";
import { petaWaliKelasPadaTanggal } from "@/lib/wali-kelas";

export const dynamic = "force-dynamic";

/**
 * Menu khusus petugas piket: untuk setiap kelas yang berjalan pada tanggal
 * terpilih, tampilkan siapa PENGISI ABSENSI (guru jam pertama) dan siapa WALI
 * KELAS periode tersebut — supaya piket tahu harus mengingatkan siapa bila
 * absensi kelas belum diisi, dan siapa wali yang juga bisa dihubungi.
 */
export default async function PenanggungJawabPage({
  searchParams,
}: {
  searchParams: { tanggal?: string };
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const isPiket = user.role === "GURU" && user.guru?.jenisGuru === "PIKET" && user.guru?.kode === "PIKET";
  const isAdmin = user.role === "ADMIN" || user.role === "SUPERADMIN";
  if (!isPiket && !isAdmin) {
    return (
      <div className="fade-up">
        <PageHeader
          title="Penanggung Jawab Kelas"
          subtitle="Pengisi absensi & wali kelas per kelas"
          icon={<ClipboardCheck className="h-6 w-6" />}
        />
        <EmptyState
          title="Menu ini khusus petugas piket"
          desc="Menu ini membantu petugas piket mengetahui guru jam pertama (pengisi absensi) dan wali kelas tiap kelas pada suatu tanggal."
        />
      </div>
    );
  }

  let tanggal = mulaiHari();
  if (searchParams.tanggal) {
    const coba = mulaiHari(searchParams.tanggal);
    if (!Number.isNaN(coba.getTime())) tanggal = coba;
  }
  const hari = hariDariTanggal(tanggal);
  const tanggalStr = format(tanggal, "yyyy-MM-dd");

  // Semester berlaku pada tanggal tsb (read-only; tidak mengubah flag aktif).
  const resolusi = await cariSemesterUntukTanggal(tanggal);
  const semesterId = resolusi.semester?.id ?? null;
  const masalahSemester = resolusi.ambigu
    ? "Konfigurasi periode bermasalah: beberapa semester berlaku pada tanggal yang sama."
    : resolusi.tanpaRentang.length > 0
      ? "Rentang tanggal periode (semester) belum dilengkapi admin untuk tanggal ini."
      : null;

  const [kelasList, absensiList] = await Promise.all([
    prisma.kelas.findMany({
      where: { siswa: { some: { status: "AKTIF", deletedAt: null } } },
      include: {
        siswa: { where: { status: "AKTIF", deletedAt: null }, select: { id: true } },
        jadwal: {
          where: hari && semesterId ? { hari, semesterId } : hari ? { id: "__TIDAK_ADA__" } : undefined,
          orderBy: [{ jamKeMulai: "asc" }, { id: "asc" }],
          include: { guru: true, mapel: true },
        },
      },
      orderBy: [{ tingkat: "asc" }, { nama: "asc" }],
    }),
    prisma.absensiHarian.findMany({
      where: { tanggal },
      include: { pengisi: true, item: { select: { siswaId: true, status: true } } },
    }),
  ]);

  // Peta wali kelas historis per tanggal (bukan wali saat ini).
  const petaWali = await petaWaliKelasPadaTanggal(
    kelasList.map((k) => k.id),
    tanggal,
    { semesterId }
  );
  const waliGuruIds = [...new Set(petaWali.values())];
  const waliGurus = waliGuruIds.length
    ? await prisma.guru.findMany({ where: { id: { in: waliGuruIds } }, select: { id: true, nama: true } })
    : [];
  const namaWaliById = new Map(waliGurus.map((g) => [g.id, g.nama]));

  const byKelas = new Map(absensiList.map((a) => [a.kelasId, a]));

  type Baris = {
    id: string;
    nama: string;
    tingkat: number;
    jp: (typeof kelasList)[number]["jadwal"][number] | undefined;
    status: StatusAbsensiHarian;
    pengisiNama: string | null;
    waliNama: string | null;
  };

  // Kelas yang "berjalan" hari itu = minimal punya satu jadwal.
  const barisKelas = (k: (typeof kelasList)[number]): Baris => {
    // Guru jam pertama = pemegang jadwal pada jam pembuka hari (jam ke-1;
    // Senin jam ke-2 karena upacara). Tanpa jadwal di jam itu → tak ada pembuka.
    const jp = hari ? k.jadwal.find((j) => j.jamKeMulai === jamPembukaHari(hari)) : undefined;
    const record = byKelas.get(k.id);
    let status: StatusAbsensiHarian = record ? record.peranPengisi : "BELUM_DIISI";
    if (record) {
      const v = validasiKelengkapanAbsensiHarian(
        (record.item as { siswaId: string; status: string }[]).map((it) => ({ siswaId: it.siswaId, status: it.status })),
        (k.siswa as { id: string }[]).map((s) => s.id)
      );
      if (!v.ok) status = "BELUM_DIISI";
    }
    return {
      id: k.id,
      nama: k.nama,
      tingkat: k.tingkat,
      jp,
      status,
      pengisiNama: record?.pengisi.nama ?? null,
      waliNama: (petaWali.get(k.id) && namaWaliById.get(petaWali.get(k.id)!)) ?? null,
    };
  };

  const rows: Baris[] = hari
    ? kelasList.filter((k) => k.jadwal.length > 0).map(barisKelas)
    : [];
  // Kelas yang absensinya belum diisi tampil paling atas (fokus piket).
  rows.sort(
    (a, b) =>
      Number(a.status !== "BELUM_DIISI") - Number(b.status !== "BELUM_DIISI") ||
      a.tingkat - b.tingkat ||
      a.nama.localeCompare(b.nama)
  );
  const jumlahBelum = rows.filter((r) => r.status === "BELUM_DIISI").length;

  return (
    <div className="fade-up">
      <PageHeader
        title="Penanggung Jawab Kelas"
        subtitle={`Siapa pengisi absensi & wali kelas · ${formatTanggalPanjang(tanggal)}`}
        icon={<ClipboardCheck className="h-6 w-6" />}
      />

      {masalahSemester && (
        <Card className="card-pad mb-6 !border-amber-200 !bg-amber-50">
          <EmptyState title="Periode semester tidak dapat ditentukan" desc={masalahSemester} />
        </Card>
      )}

      {/* Pilih tanggal */}
      <Card className="card-pad mb-6">
        <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
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
          <button className="btn-primary btn-sm min-h-11 w-full sm:w-auto">Tampilkan</button>
        </form>
        <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Pengisi absensi = guru jam pertama kelas. Bila belum mengisi, ingatkan beliau — atau isi sebagai backup piket. Wali kelas juga boleh mengisi/mengoreksi.
        </p>
      </Card>

      {!hari && (
        <Card className="card-pad">
          <EmptyState title="Tidak ada kegiatan pada tanggal ini" desc="Pilih tanggal lain untuk melihat penanggung jawab kelas." />
        </Card>
      )}

      {hari && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <h2 className="font-extrabold text-slate-900">Kelas Hari Ini</h2>
            <span className="chip bg-blue-50 text-blue-700">
              {rows.length - jumlahBelum}/{rows.length} terisi
            </span>
          </div>

          {rows.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Tidak ada kelas berjalan pada tanggal ini"
                desc="Tidak ada jadwal pelajaran untuk kelas mana pun pada tanggal ini."
              />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.map((r) => {
                const belum = r.status === "BELUM_DIISI";
                const subJp = r.jp
                  ? `${r.jp.mapel.nama} · jam ke-${r.jp.jamKeMulai}${r.jp.jamKeSelesai > r.jp.jamKeMulai ? `–${r.jp.jamKeSelesai}` : ""}`
                  : null;
                return (
                  <Link
                    key={r.id}
                    href={`/absensi-harian/${r.id}?tanggal=${tanggalStr}`}
                    className="group flex flex-col gap-3 px-5 py-4 transition hover:bg-emerald-50/50 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words font-extrabold text-slate-900 group-hover:text-emerald-700">{r.nama}</p>
                        {belum && (
                          <span className="chip bg-amber-100 text-amber-700">Belum diisi — perlu tindakan</span>
                        )}
                      </div>

                      <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-5 text-slate-600">
                        <UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                        <span className="min-w-0 break-words">
                          <b className="font-bold text-slate-700">Pengisi absensi (guru jam pertama):</b>{" "}
                          {r.jp ? `${r.jp.guru.nama} (${subJp})` : "— (tanpa jadwal jam pembuka — backup piket/wali)"}
                        </span>
                      </p>

                      <p className="mt-0.5 flex items-start gap-1.5 text-xs leading-5 text-slate-600">
                        <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden="true" />
                        <span className="min-w-0 break-words">
                          <b className="font-bold text-slate-700">Wali kelas:</b> {r.waliNama ?? "—"}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-row items-center justify-between gap-2 sm:flex-col sm:items-end">
                      <span className={`chip ${STATUS_ABSENSI_HARIAN_BADGE[r.status]}`}>
                        {STATUS_ABSENSI_HARIAN_LABEL[r.status]}
                      </span>
                      <span className={`btn btn-sm min-h-11 ${belum ? "btn-primary group-hover:bg-emerald-700" : "btn-secondary"}`}>
                        <PenLine className="h-3.5 w-3.5" /> {belum ? "Isi" : "Koreksi"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
