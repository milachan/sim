import { ClipboardCheck } from "lucide-react";
import { format } from "date-fns";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { EmptyState, PageHeader, SuksesBanner } from "@/components/ui";
import { STATUS_ABSENSI_HARIAN_BADGE, STATUS_ABSENSI_HARIAN_LABEL, type StatusAbsensiHarian } from "@/lib/constants";
import { formatTanggalPanjang, mulaiHari } from "@/lib/utils";
import { cariGuruJamPertama, validasiKelengkapanAbsensiHarian, tentukanPeranPengisi } from "@/lib/absensi-harian";
import { cariSemesterUntukTanggal } from "@/lib/semester";
import FormAbsensiHarian from "@/components/absensi-harian/form-absensi-harian";

export const dynamic = "force-dynamic";

export default async function AbsensiHarianDetailPage({
  params,
  searchParams,
}: {
  params: { kelasId: string };
  searchParams: { tanggal?: string; sukses?: string; pertemuan?: string };
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  let tanggal = mulaiHari();
  if (searchParams.tanggal) {
    const coba = mulaiHari(searchParams.tanggal);
    if (!Number.isNaN(coba.getTime())) tanggal = coba;
  }
  const tanggalStr = format(tanggal, "yyyy-MM-dd");

  // Semester berlaku pada tanggal tsb (read-only; tidak mengubah flag aktif).
  const resolusiSemester = await cariSemesterUntukTanggal(tanggal);
  const semesterId = resolusiSemester.semester?.id ?? null;
  const masalahSemester = resolusiSemester.ambigu
    ? "Konfigurasi periode bermasalah: beberapa semester berlaku pada tanggal yang sama."
    : resolusiSemester.tanpaRentang.length > 0
      ? "Rentang tanggal periode (semester) belum dilengkapi admin untuk tanggal ini."
      : null;

  const [kelas, guruJP] = await Promise.all([
    prisma.kelas.findUnique({
      where: { id: params.kelasId },
      include: {
        siswa: {
          where: { status: "AKTIF", deletedAt: null },
          orderBy: { nama: "asc" },
          select: { id: true, nama: true, nis: true },
        },
      },
    }),
    cariGuruJamPertama(params.kelasId, tanggal, { semesterId }),
  ]);

  if (!kelas) {
    return (
      <div className="fade-up">
        <PageHeader title="Absensi Harian Kelas" icon={<ClipboardCheck className="h-6 w-6" />} />
        <EmptyState title="Kelas tidak ditemukan" desc="Kelas mungkin telah dihapus." />
      </div>
    );
  }

  // Peran pengguna pada kelas & tanggal ini — SATU sumber keputusan yang sama
  // dengan server action (tentukanPeranPengisi): guru jam pertama kala itu =
  // pengisi utama, wali kelas PERIODE TERSEBUT (riwayat) = boleh mengisi &
  // mengubah, guru piket / admin = backup. WAKA terhubung memperoleh hak
  // melalui user.guruId-nya sendiri (bukan karena role WAKA); KEPALA dan akun
  // tanpa relasi guru selalu ditolak.
  const peranUser = await tentukanPeranPengisi(user, params.kelasId, tanggal, { semesterId });

  if (!peranUser) {
    return (
      <div className="fade-up">
        <PageHeader title="Absensi Harian Kelas" icon={<ClipboardCheck className="h-6 w-6" />} />
        <EmptyState
          title="Anda tidak berhak mengisi kelas ini"
          desc="Hanya guru jam pertama periode tersebut, wali kelasnya kala itu, atau guru piket yang boleh mengisi absensi harian."
        />
      </div>
    );
  }

  const record = await prisma.absensiHarian.findUnique({
    where: { kelasId_tanggal: { kelasId: params.kelasId, tanggal } },
    include: { pengisi: true, item: true },
  });

  const validasi = record
    ? validasiKelengkapanAbsensiHarian(
        record.item.map((it) => ({ siswaId: it.siswaId, status: it.status as string })),
        kelas.siswa.map((s) => s.id)
      )
    : validasiKelengkapanAbsensiHarian([], kelas.siswa.map((s) => s.id));
  const lengkap = validasi.ok;
  const status: StatusAbsensiHarian = !record ? "BELUM_DIISI" : !lengkap ? "BELUM_DIISI" : record.peranPengisi;

  const siswa = kelas.siswa.map((s) => {
    const it = record?.item.find((x) => x.siswaId === s.id);
    return {
      id: s.id,
      nama: s.nama,
      nis: s.nis,
      status: it?.status ?? null,
      catatan: it?.catatan ?? "",
    };
  });

  // Gerbang jurnal (beranda): bila URL membawa ?pertemuan=..., pastikan pertemuan itu
  // benar-benar milik kelas & tanggal ini sebelum dijadikan tujuan lanjut setelah simpan
  // (langsung ke pengisian jurnal pertemuan tersebut). Id asing/curian diabaikan.
  let lanjutPertemuanId: string | null = null;
  if (searchParams.pertemuan) {
    const p = await prisma.pertemuan.findUnique({
      where: { id: searchParams.pertemuan },
      select: { id: true, kelasId: true, tanggal: true, jadwal: { select: { kelasId: true } } },
    });
    const kelasPertemuan = p?.kelasId ?? p?.jadwal?.kelasId;
    if (p && kelasPertemuan === params.kelasId && p.tanggal.getTime() === tanggal.getTime()) {
      lanjutPertemuanId = p.id;
    }
  }

  // Status, pengisi, dan rekap dirangkum ke dalam satu kartu utama di form.
  const sudahDiisi = !!record && lengkap;
  const statusText = STATUS_ABSENSI_HARIAN_LABEL[status];
  const statusChipClass = STATUS_ABSENSI_HARIAN_BADGE[status];
  const pengisiInfo = record
    ? `Terakhir diisi: ${record.pengisi.nama}`
    : guruJP
      ? `Pengisi utama: ${guruJP.guru.nama} (${guruJP.mapel.nama})`
      : null;
  const instruksi =
    peranUser === "GURU_JAM_PERTAMA"
      ? "Anda pengisi utama kelas ini — tandai seluruh siswa, lalu simpan."
      : sudahDiisi
        ? "Absensi sudah diisi — koreksi hanya bila ada perubahan."
        : peranUser === "WALI_KELAS"
          ? "Anda wali kelas — boleh mengisi atau mengoreksi."
          : "Anda backup — boleh mengisi bila kelas masih kosong.";

  return (
    <div className="fade-up">
      <PageHeader
        title={`Absensi Harian — ${kelas.nama}`}
        subtitle={formatTanggalPanjang(tanggal)}
        icon={<ClipboardCheck className="h-6 w-6" />}
      />
      <SuksesBanner message={searchParams.sukses} />

      {masalahSemester && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {masalahSemester}
        </div>
      )}

      <FormAbsensiHarian
        kelasId={kelas.id}
        tanggal={tanggalStr}
        namaKelas={kelas.nama}
        statusText={statusText}
        statusChipClass={statusChipClass}
        pengisiInfo={pengisiInfo}
        instruksi={instruksi}
        siswa={siswa}
        sudahAda={!!record}
        // Asal halaman menentukan tujuan "Kembali"/setelah simpan: daftar absensi
        // memakai ?tanggal= → kembali ke daftar tanggal itu; beranda/gerbang jurnal
        // tanpa ?tanggal= → kembali ke beranda, bukan nyasar ke daftar absensi.
        backUrl={searchParams.tanggal ? `/absensi-harian?tanggal=${tanggalStr}` : "/"}
        lanjutUrl={lanjutPertemuanId ? `/pertemuan/${lanjutPertemuanId}` : null}
      />
    </div>
  );
}
