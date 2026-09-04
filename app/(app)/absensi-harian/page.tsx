import { ClipboardCheck, Info } from "lucide-react";
import { format } from "date-fns";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, PageHeader, SuksesBanner } from "@/components/ui";
import { jamPembukaHari, type StatusAbsensiHarian } from "@/lib/constants";
import { formatTanggalPanjang, mulaiHari } from "@/lib/utils";
import { hariDariTanggal, daftarGuruPiketIds, validasiKelengkapanAbsensiHarian } from "@/lib/absensi-harian";
import { cariSemesterUntukTanggal } from "@/lib/semester";
import { petaWaliKelasPadaTanggal } from "@/lib/wali-kelas";
import BarisKelasAbsensi from "@/components/absensi-harian/baris-kelas-absensi";
import DaftarKelasPiket, { type BarisKelasPiket } from "@/components/absensi-harian/daftar-kelas-piket";

export const dynamic = "force-dynamic";

export default async function AbsensiHarianPage({
  searchParams,
}: {
  searchParams: { tanggal?: string; sukses?: string };
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  // Alur ini untuk guru jam pertama & guru piket (plus admin), termasuk WAKA
  // yang juga mengajar (punya guruId). Waka/Kamad tanpa relasi guru ditolak.
  if (user.role === "KEPALA" || (user.role === "WAKA" && !user.guruId)) {
    return (
      <div className="fade-up">
        <PageHeader
          title="Absensi Harian Kelas"
          subtitle="Kehadiran siswa per kelas"
          icon={<ClipboardCheck className="h-6 w-6" />}
        />
        <EmptyState
          title="Menu belum tersedia untuk akun ini"
          desc="Menu rekap & pemantauan absensi akan diaktifkan setelah sistem siap digunakan secara resmi."
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

  // Akun khusus petugas piket menangani SEMUA kelas sebagai backup — jangan
  // diperlakukan sebagai guru biasa: seksi "Kelas Anda"/"Kelas Wali Anda"
  // tidak relevan (piket tidak punya jadwal), cukup daftar "Semua Kelas".
  const isAkunPiket = user.role === "GURU" && user.guru?.jenisGuru === "PIKET" && user.guru?.kode === "PIKET";
  const isGuru = !isAkunPiket && !!user.guruId && (user.role === "GURU" || user.role === "WAKA");
  const isAdmin = user.role === "ADMIN" || user.role === "SUPERADMIN";
  const piketIds = isGuru || isAkunPiket ? await daftarGuruPiketIds() : new Set<string>();
  const isPiket = isAkunPiket || (isGuru && !!user.guruId && piketIds.has(user.guruId));

  // Semester berlaku pada tanggal yang dipilih (read-only, tidak mengubah flag aktif).
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
          where:
            hari && semesterId
              ? { hari, semesterId }
              : hari
                ? { id: "__TIDAK_ADA__" }
                : undefined,
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

  // Peta wali kelas historis (riwayat per tanggal), bukan wali saat ini.
  const kelasBerjalanKunci = kelasList.map((k) => k.id);
  const petaWali = await petaWaliKelasPadaTanggal(kelasBerjalanKunci, tanggal, { semesterId });

  const byKelas = new Map(absensiList.map((a) => [a.kelasId, a]));
  // Kelas yang "berjalan" hari itu = minimal punya satu jadwal.
  const kelasBerjalan = hari ? kelasList.filter((k) => k.jadwal.length > 0) : [];

  // Guru jam pertama = pemegang jadwal pada JAM PEMBUKA hari (jam ke-1; Senin
  // jam ke-2 karena upacara). Kelas yang berjalan tapi tanpa jadwal di jam itu
  // tidak punya guru jam pertama (piket/wali menjadi backup).
  const jadwalPembuka = (k: (typeof kelasBerjalan)[number]) =>
    hari ? k.jadwal.find((j) => j.jamKeMulai === jamPembukaHari(hari)) : undefined;

  type BarisKelas = {
    id: string;
    nama: string;
    tingkat: number;
    jp: (typeof kelasBerjalan)[number]["jadwal"][number] | undefined;
    status: StatusAbsensiHarian;
    record: (typeof absensiList)[number] | undefined;
  };

  const barisKelas = (k: (typeof kelasBerjalan)[number]): BarisKelas => {
    const jp = jadwalPembuka(k);
    const record = byKelas.get(k.id);
    let status: StatusAbsensiHarian = record ? record.peranPengisi : "BELUM_DIISI";
    if (record) {
      const v = validasiKelengkapanAbsensiHarian(
        (record.item as { siswaId: string; status: string }[]).map((it) => ({ siswaId: it.siswaId, status: it.status })),
        (k.siswa as { id: string }[]).map((s) => s.id)
      );
      if (!v.ok) status = "BELUM_DIISI";
    }
    return { id: k.id, nama: k.nama, tingkat: k.tingkat, jp, status, record };
  };

  // Guru jam pertama: kelas yang guru ini pegang jadwal jam pembuka hari itu.
  const kelasSaya = isGuru
    ? kelasBerjalan.filter((k) => jadwalPembuka(k)?.guruId === user.guruId).map(barisKelas)
    : [];
  // Wali kelas: kelas yang diwalikannya PADA TANGGAL ITU (riwayat historis).
  const kelasWali = isGuru
    ? kelasBerjalan.filter((k) => petaWali.get(k.id) === user.guruId).map(barisKelas)
    : [];
  // Guru piket / admin: seluruh kelas hari itu (tidak perlu input ulang yang sudah diisi).
  const kelasPiket = isAdmin || isPiket ? kelasBerjalan.map(barisKelas) : [];

  return (
    <div className="fade-up">
      <PageHeader
        title="Absensi Harian Kelas"
        subtitle={`Kehadiran siswa per kelas · ${formatTanggalPanjang(tanggal)}`}
        icon={<ClipboardCheck className="h-6 w-6" />}
      />
      <SuksesBanner message={searchParams.sukses} />

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
          Guru jam pertama mengisi lebih dulu; bila kelas masih kosong, guru piket mengisi sebagai backup.
        </p>
      </Card>

      {!hari && (
        <Card className="card-pad">
          <EmptyState title="Tidak ada kegiatan pada tanggal ini" desc="Pilih tanggal lain untuk melihat status absensi harian kelas." />
        </Card>
      )}

      {hari && (
        <div className="space-y-6">
          {isGuru && (
            <SeksiKelas
              judul="Kelas Anda — Guru Jam Pertama"
              rows={kelasSaya}
              tanggalStr={tanggalStr}
              kosong={{
                title: "Anda bukan guru jam pertama hari ini",
                desc: "Tidak ada kelas dengan jadwal di jam pembuka (jam ke-1; Senin jam ke-2) yang Anda pegang pada tanggal ini.",
              }}
            />
          )}

          {isGuru && kelasWali.length > 0 && (
            <SeksiKelas
              judul="Kelas Wali Anda"
              deskripsi="Kelas wali Anda boleh diisi/dikoreksi kapan pun."
              rows={kelasWali}
              tanggalStr={tanggalStr}
              kosong={{
                title: "Kelas wali Anda tidak berjalan hari ini",
                desc: "Tidak ada jadwal pelajaran pada kelas wali Anda di tanggal ini.",
              }}
            />
          )}

          {isPiket && (
            <DaftarKelasPiket
              rows={kelasPiket.map((r): BarisKelasPiket => ({
                id: r.id,
                nama: r.nama,
                tingkat: r.tingkat,
                mapelNama: r.jp?.mapel.nama ?? null,
                guruJPNama: r.jp?.guru.nama ?? null,
                status: r.status,
                pengisiNama: r.record?.pengisi.nama ?? null,
              }))}
              tanggalStr={tanggalStr}
            />
          )}

          {isAdmin && (
            <SeksiKelas
              judul="Semua Kelas"
              rows={kelasPiket}
              tanggalStr={tanggalStr}
              guruJp
              kosong={{
                title: "Tidak ada kelas berjalan pada tanggal ini",
                desc: "Tidak ada jadwal pelajaran untuk kelas mana pun pada tanggal ini.",
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SeksiKelas({
  judul,
  deskripsi,
  rows,
  tanggalStr,
  kosong,
  guruJp = false,
}: {
  judul: string;
  deskripsi?: string;
  rows: {
    id: string;
    nama: string;
    jp: { guru: { nama: string }; mapel: { nama: string } } | undefined;
    status: StatusAbsensiHarian;
  }[];
  tanggalStr: string;
  kosong: { title: string; desc: string };
  /** Tampilkan nama guru jam pertama pada baris (butuh untuk piket/admin). */
  guruJp?: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="font-extrabold text-slate-900">{judul}</h2>
        {deskripsi && <p className="mt-0.5 text-xs text-slate-500">{deskripsi}</p>}
      </div>
      {rows.length === 0 ? (
        <div className="p-5">
          <EmptyState title={kosong.title} desc={kosong.desc} />
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {rows.map((r) => {
            const sub = r.jp
              ? guruJp
                ? `${r.jp.mapel.nama} · ${r.jp.guru.nama}`
                : r.jp.mapel.nama
              : "Tanpa guru jam pertama (backup piket/wali)";
            return (
              <BarisKelasAbsensi
                key={r.id}
                href={`/absensi-harian/${r.id}?tanggal=${tanggalStr}`}
                nama={r.nama}
                sub={sub}
                status={r.status}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}
