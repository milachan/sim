import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarRange, ClipboardCheck, Download, FileCheck2, ShieldCheck, Stamp } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, PageHeader, StatCard, SuksesBanner, ErrorBanner } from "@/components/ui";
import { STATUS_LAPORAN_BADGE, STATUS_LAPORAN_LABEL } from "@/lib/constants";
import { statistikBulanan } from "@/lib/laporan";
import { formatTanggal } from "@/lib/utils";
import { buatLaporanBulanan } from "@/lib/actions/laporan-bulanan";
import FormSampling from "@/components/laporan/form-sampling";
import FormPersetujuan from "@/components/laporan/form-persetujuan";
import { TombolCetak } from "@/components/tombol-cetak";
import type { StatusLaporan } from "@prisma/client";

export const dynamic = "force-dynamic";

function labelBulan(bulan: string) {
  const [tahun, bulanNum] = bulan.split("-").map(Number);
  return new Date(tahun, bulanNum - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

export default async function DetailLaporanBulanan({
  params,
  searchParams,
}: {
  params: { bulan: string };
  searchParams: { sukses?: string; error?: string; s?: string; semua?: string };
}) {
  const user = await getCurrentUser();
  const { bulan } = params;
  if (!/^\d{4}-\d{2}$/.test(bulan)) notFound();

  const isWaka = user?.role === "WAKA";
  const isVerifikator = ["WAKA", "ADMIN", "SUPERADMIN"].includes(user?.role ?? "");
  const isPenyetuju = ["KEPALA", "ADMIN", "SUPERADMIN"].includes(user?.role ?? "");

  // Bawa kembali tab filter (s) ke halaman daftar laporan bulanan.
  const hrefDaftar = searchParams.s ? `/laporan-bulanan?s=${encodeURIComponent(searchParams.s)}` : "/laporan-bulanan";

  const [laporan, stat] = await Promise.all([
    prisma.laporanBulanan.findUnique({
      where: { bulan },
      include: { diperiksaOleh: { select: { nama: true } }, disetujuiOleh: { select: { nama: true } } },
    }),
    statistikBulanan(bulan),
  ]);
  const status: StatusLaporan = laporan?.status ?? "DRAFT";
  const adaLaporan = !!laporan;

  // Rekonstruksi sampling tersimpan (Json dari DB)
  const samplingTersimpan: { guruId?: string; terverifikasi?: boolean; catatan?: string }[] = Array.isArray(laporan?.sampling)
    ? (laporan!.sampling as unknown as { guruId?: string; terverifikasi?: boolean; catatan?: string }[])
    : [];
  const sampling = stat.perGuru.map((g) => {
    const lama = samplingTersimpan.find((x) => x.guruId === g.guruId);
    return {
      ...g,
      terverifikasi: lama?.terverifikasi ?? false,
      catatan: lama?.catatan ?? "",
    };
  });
  // Sampling & daftar verifikasi hanya menampilkan guru yang PUNYA pertemuan
  // bulan itu (guru tanpa jadwal = tidak ada yang perlu diverifikasi). Guru
  // 0/0 tetap bisa dilihat lewat ?semua=1.
  const tampilSemuaGuru = searchParams.semua === "1";
  const samplingTampil = tampilSemuaGuru ? sampling : sampling.filter((x) => x.total > 0);
  const adaGuruTanpaPertemuan = sampling.some((x) => x.total === 0);
  const jumlahTerverifikasi = samplingTampil.filter((x) => x.terverifikasi).length;

  const exportUrl = `/api/export?t=kelengkapan&bulan=${bulan}${tampilSemuaGuru ? "&semua=1" : ""}`;

  return (
    <div className="fade-up">
      <Link href={hrefDaftar} className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 transition hover:text-emerald-700">
        <ArrowLeft className="h-4 w-4" /> Semua laporan bulanan
      </Link>

      <PageHeader
        title={`Laporan ${labelBulan(bulan)}`}
        subtitle="Statistik live dari pertemuan — verifikasi sampling & persetujuan"
        icon={<CalendarRange className="h-6 w-6" />}
        actions={
          <span className={`chip text-sm ${STATUS_LAPORAN_BADGE[status]}`}>
            {STATUS_LAPORAN_LABEL[status]}
          </span>
        }
      />
      <SuksesBanner message={searchParams.sukses} />
      <ErrorBanner message={searchParams.error} />

      {!adaLaporan && (
        <Card className="card-pad mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold text-slate-800">Belum ada laporan untuk bulan ini</p>
            <p className="text-sm text-slate-500">
              {isVerifikator
                ? "Klik tombol untuk membuat konsep laporan, lalu lakukan sampling verifikasi."
                : "Laporan akan dibuat dan diverifikasi oleh Waka Kurikulum. Anda dapat menyetujuinya setelah statusnya 'Sudah Diperiksa'."}
            </p>
          </div>
          {isVerifikator && (
            <form action={buatLaporanBulanan.bind(null, bulan)}>
              <button className="btn-primary"><ClipboardCheck className="h-4 w-4" /> Buat Laporan Bulanan</button>
            </form>
          )}
        </Card>
      )}

      {/* Ringkasan statistik — Catatan/Rekap Absensi disembunyikan sementara
          sampai alur absensi jam pertama & backup guru piket benar-benar stabil. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Pertemuan" value={stat.totalPertemuan} sub="tidak termasuk batal" icon={<CalendarRange className="h-6 w-6" />} />
        <StatCard label="Kelengkapan" value={`${stat.persenLengkap}%`} sub={`${stat.lengkap} dari ${stat.totalPertemuan} lengkap`} color="bg-teal-600" icon={<FileCheck2 className="h-6 w-6" />} />
        <StatCard label="Jurnal Kosong" value={stat.tanpaJurnal} sub={stat.tanpaJurnal ? "butuh tindak lanjut" : "semua terisi"} color={stat.tanpaJurnal ? "bg-amber-500" : "bg-emerald-600"} icon={<ClipboardCheck className="h-6 w-6" />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Sampling Waka */}
        <Card className="card-pad">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-extrabold text-slate-900">
                <ShieldCheck className="h-5 w-5 text-emerald-600" /> Sampling Verifikasi Waka
              </h2>
              <p className="text-xs text-slate-500">
                {isWaka ? "Anda memverifikasi kelengkapan administrasi guru" : "Dilakukan oleh Waka Kurikulum"}
              </p>
            </div>
            {adaLaporan && status !== "DRAFT" && (
              <span className="chip bg-emerald-50 text-emerald-700">{jumlahTerverifikasi} guru terverifikasi</span>
            )}
          </div>

          {isVerifikator && adaLaporan ? (
            samplingTampil.length === 0 ? (
              <EmptyState title="Belum ada guru dengan pertemuan" desc="Guru baru muncul di sampling setelah punya pertemuan pada bulan ini." />
            ) : (
              <FormSampling bulan={bulan} items={samplingTampil} catatanAwal={laporan?.catatanWaka ?? ""} />
            )
          ) : (
            <div className="space-y-2">
              {samplingTampil.length === 0 ? (
                <EmptyState title="Belum ada guru dengan pertemuan" />
              ) : (
                samplingTampil.map((g) => (
                  <div key={g.guruId} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-800">{g.nama}</p>
                      <p className="text-xs text-slate-500">{g.lengkap}/{g.total} lengkap · {g.persen}%</p>
                    </div>
                    <span className={g.terverifikasi ? "chip bg-emerald-100 text-emerald-700" : "chip bg-slate-100 text-slate-500"}>
                      {g.terverifikasi ? "✓ Terverifikasi" : "Belum"}
                    </span>
                  </div>
                ))
              )}
              {!isWaka && <p className="mt-3 text-xs text-slate-400">Verifikasi hanya dapat dilakukan Waka/Admin.</p>}
            </div>
          )}

          {adaGuruTanpaPertemuan && (
            <a
              href={`/laporan-bulanan/${bulan}?semua=${tampilSemuaGuru ? "0" : "1"}${searchParams.s ? `&s=${encodeURIComponent(searchParams.s)}` : ""}`}
              className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
            >
              {tampilSemuaGuru ? "Sembunyikan guru tanpa pertemuan" : `Tampilkan semua guru (${sampling.length - samplingTampil.length} tanpa pertemuan)`}
            </a>
          )}

          {laporan?.catatanWaka && (
            <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Catatan Waka</p>
              <p className="mt-1 text-sm text-slate-700">{laporan.catatanWaka}</p>
              {laporan.diperiksaPada && <p className="mt-1 text-xs text-slate-400">Diperiksa {formatTanggal(laporan.diperiksaPada, "d MMM yyyy HH:mm")} oleh {laporan.diperiksaOleh?.nama ?? "-"}</p>}
            </div>
          )}
        </Card>

        {/* Persetujuan Kamad */}
        <Card className="card-pad">
          <div className="mb-4">
            <h2 className="flex items-center gap-2 font-extrabold text-slate-900">
              <Stamp className="h-5 w-5 text-violet-600" /> Persetujuan Kepala Madrasah
            </h2>
            <p className="text-xs text-slate-500">Laporan harus diperiksa Waka sebelum disetujui</p>
          </div>

          {isPenyetuju && adaLaporan ? (
            <FormPersetujuan bulan={bulan} status={status} catatanAwal={laporan?.catatanKamad ?? ""} />
          ) : (
            <div className="text-sm text-slate-500">
              {!adaLaporan
                ? "Laporan belum dibuat."
                : status === "DRAFT"
                  ? "Menunggu sampling verifikasi Waka."
                  : status === "DIPERIKSA"
                    ? "Menunggu persetujuan Kepala Madrasah."
                    : "Laporan telah disetujui."}
            </div>
          )}

          {laporan?.catatanKamad && (
            <div className="mt-4 rounded-xl bg-violet-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-violet-700">Catatan Kamad</p>
              <p className="mt-1 text-sm text-slate-700">{laporan.catatanKamad}</p>
              {laporan.disetujuiPada && <p className="mt-1 text-xs text-slate-400">Disetujui {formatTanggal(laporan.disetujuiPada, "d MMM yyyy HH:mm")} oleh {laporan.disetujuiOleh?.nama ?? "-"}</p>}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <a href={exportUrl} className="btn-primary btn-sm">
              <Download className="h-4 w-4" /> Unduh Excel Kelengkapan
            </a>
            <TombolCetak label="Cetak" />
          </div>
        </Card>
      </div>
    </div>
  );
}
