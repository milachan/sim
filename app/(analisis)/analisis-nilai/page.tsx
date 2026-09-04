import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileBarChart, SearchX, Users } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { bolehBacaKegiatanNilai } from "@/lib/otorisasi";
import { whereScopeKegiatan } from "@/lib/analisis-nilai/scope";
import {
  distribusiRentang,
  hitungStatusPengumpulan,
  normalisasiPersen,
  ringkasNilai,
  susunTrenKegiatan,
} from "@/lib/analisis-nilai/statistik";
import PageHeader from "@/components/ds/page-header";
import SectionHeader from "@/components/ds/section-header";
import Card, { CardHeader } from "@/components/ds/card";
import StatCard from "@/components/ds/stat-card";
import Alert from "@/components/ds/alert";
import EmptyState from "@/components/ds/empty-state";
import { SelectNavigasi } from "@/components/select-navigasi";
import TabelHasilSiswa, { type BarisHasilSiswa } from "@/components/analisis-nilai/tabel-hasil-siswa";
import { BarChartVertikal } from "@/components/charts";
import { formatAngka, formatTanggal } from "@/lib/utils";

export const dynamic = "force-dynamic";

const BATAS_KEGIATAN = 200;

type Opsi = { value: string; label: string };

/** Parameter searchParams hanya dipakai bila cocok dengan pilihan nyata milik scope pengguna. */
function paramValid(raw: string | undefined, opsi: Opsi[]): string | undefined {
  if (!raw) return undefined;
  return opsi.some((o) => o.value === raw) ? raw : undefined;
}

function InfoBaris({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="min-w-0 break-words text-right text-sm font-extrabold text-slate-800">{value}</span>
    </div>
  );
}

export default async function AnalisisNilaiPage({
  searchParams,
}: {
  searchParams: { kelas?: string; mapel?: string; kegiatan?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Scope terikat server (turunan aturan existing bolehBacaKegiatanNilai):
  // GURU hanya kegiatan pada jadwal miliknya; ADMIN/SUPERADMIN/WAKA/KEPALA semua.
  // null = akun tidak berhak membaca data penilaian sama sekali.
  const where = whereScopeKegiatan(user);

  const daftar = where
    ? await prisma.penilaianKegiatan.findMany({
        where: where as unknown as Prisma.PenilaianKegiatanWhereInput,
        include: { jadwal: { include: { kelas: true, mapel: true } } },
        orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
        take: BATAS_KEGIATAN,
      })
    : [];

  const kelasOpsi: Opsi[] = [];
  const mapelOpsi: Opsi[] = [];
  for (const k of daftar) {
    if (!kelasOpsi.some((o) => o.value === k.jadwal.kelasId)) {
      kelasOpsi.push({ value: k.jadwal.kelasId, label: k.jadwal.kelas.nama });
    }
    if (!mapelOpsi.some((o) => o.value === k.jadwal.mapelId)) {
      mapelOpsi.push({ value: k.jadwal.mapelId, label: k.jadwal.mapel.nama });
    }
  }
  kelasOpsi.sort((a, b) => a.label.localeCompare(b.label, "id"));
  mapelOpsi.sort((a, b) => a.label.localeCompare(b.label, "id"));

  const kelasId = paramValid(searchParams.kelas, kelasOpsi);
  const mapelId = paramValid(searchParams.mapel, mapelOpsi);
  const tersaring = daftar.filter(
    (k) => (!kelasId || k.jadwal.kelasId === kelasId) && (!mapelId || k.jadwal.mapelId === mapelId)
  );

  const kegiatanOpsi: Opsi[] = tersaring.map((k) => ({
    value: k.id,
    label: `${k.judul} · ${formatTanggal(k.tanggal, "d MMM yyyy")}`,
  }));
  const kegiatanId = paramValid(searchParams.kegiatan, kegiatanOpsi);
  const terpilihMeta = tersaring.find((k) => k.id === kegiatanId) ?? tersaring[0] ?? null;

  // Rata-rata nilai mentah per kegiatan untuk tren (satu query grup, tanpa N+1).
  const rataPerKegiatan = new Map<string, number>();
  if (tersaring.length) {
    const agg = await prisma.nilaiSiswa.groupBy({
      by: ["kegiatanId"],
      where: { kegiatanId: { in: tersaring.map((k) => k.id) }, nilai: { not: null } },
      _avg: { nilai: true },
    });
    for (const a of agg) {
      if (a._avg.nilai !== null) rataPerKegiatan.set(a.kegiatanId, a._avg.nilai);
    }
  }

  const trenData = susunTrenKegiatan(
    tersaring.map((k) => ({
      id: k.id,
      judul: k.judul,
      tanggal: k.tanggal,
      nilaiMaksimal: k.nilaiMaksimal,
      rataNilai: rataPerKegiatan.get(k.id) ?? null,
    }))
  );

  // Detail kegiatan terpilih: siswa aktif pada kelas jadwal + baris nilainya.
  // Pemeriksaan otorisasi ulang sebelum ambil detail (jaga-jaga atas race data).
  const kegiatan =
    terpilihMeta && bolehBacaKegiatanNilai(user, terpilihMeta.jadwal.guruId)
      ? await prisma.penilaianKegiatan.findUnique({
          where: { id: terpilihMeta.id },
          include: {
            jadwal: {
              include: {
                kelas: {
                  include: {
                    siswa: { where: { status: "AKTIF", deletedAt: null }, orderBy: { nama: "asc" } },
                  },
                },
                mapel: true,
              },
            },
            nilai: { select: { siswaId: true, nilai: true, statusKumpul: true, catatan: true } },
          },
        })
      : null;

  const nilaiMap = new Map((kegiatan?.nilai ?? []).map((n) => [n.siswaId, n]));
  const siswaAktif = kegiatan?.jadwal.kelas.siswa ?? [];
  const rows: BarisHasilSiswa[] = siswaAktif.map((s) => {
    const n = nilaiMap.get(s.id);
    return {
      siswaId: s.id,
      nama: s.nama,
      nis: s.nis,
      nilai: n?.nilai ?? null,
      persen: normalisasiPersen(n?.nilai ?? null, kegiatan?.nilaiMaksimal),
      statusKumpul: n?.statusKumpul ?? "BELUM",
      catatan: n?.catatan ?? null,
    };
  });

  const ringkasan = ringkasNilai(rows.map((r) => r.nilai));
  const statusHitung = hitungStatusPengumpulan(rows.map((r) => r.statusKumpul));
  const distribusi = distribusiRentang(
    rows.flatMap((r) => (r.persen !== null ? [r.persen] : []))
  );

  const statistikItems: Array<{ label: string; nilai: number | null }> = [
    { label: "Rata-rata", nilai: ringkasan.rata },
    { label: "Median", nilai: ringkasan.median },
    { label: "Tertinggi", nilai: ringkasan.tertinggi },
    { label: "Terendah", nilai: ringkasan.terendah },
  ];

  return (
    <div className="fade-up space-y-6">
      <PageHeader
        eyebrow="Rumah Analisis Nilai"
        title="Analisis Nilai"
        icon={FileBarChart}
        subtitle="Merangkum hasil penilaian siswa dari data penilaian yang sudah ada: statistik, distribusi rentang nilai, dan tren kegiatan terbaru."
      />

      <Alert variant="info" title="Sumber data penilaian manual">
        Saat ini analisis bersumber dari penilaian manual. Integrasi CBT belum aktif.
      </Alert>

      {!where && (
        <EmptyState
          icon={SearchX}
          title="Tidak memiliki akses data penilaian"
          description="Akun Anda tidak terhubung dengan data penilaian yang dapat dianalisis."
        />
      )}

      {where && daftar.length === 0 && (
        <EmptyState
          icon={FileBarChart}
          title="Belum ada kegiatan penilaian"
          description={
            user.role === "GURU"
              ? "Anda belum memiliki kegiatan penilaian pada jadwal mengajar Anda."
              : "Belum ada kegiatan penilaian yang tercatat pada sistem."
          }
        />
      )}

      {where && daftar.length > 0 && (
        <>
          <section aria-label="Filter data analisis">
            <SectionHeader title="Pilih Data Penilaian" />
            <Card className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <div className="w-full sm:w-auto sm:min-w-[170px]">
                <label className="label">Kelas</label>
                <SelectNavigasi
                  param="kelas"
                  className="input min-h-[44px]"
                  value={kelasId ?? ""}
                  options={[{ value: "", label: "Semua Kelas" }, ...kelasOpsi]}
                />
              </div>
              <div className="w-full sm:w-auto sm:min-w-[170px]">
                <label className="label">Mata Pelajaran</label>
                <SelectNavigasi
                  param="mapel"
                  className="input min-h-[44px]"
                  value={mapelId ?? ""}
                  options={[{ value: "", label: "Semua Mata Pelajaran" }, ...mapelOpsi]}
                />
              </div>
              <div className="w-full sm:min-w-[240px] sm:flex-1">
                <label className="label">Kegiatan Penilaian</label>
                <SelectNavigasi
                  param="kegiatan"
                  className="input min-h-[44px]"
                  value={terpilihMeta?.id ?? ""}
                  options={kegiatanOpsi}
                />
              </div>
            </Card>
          </section>

          {tersaring.length === 0 && (
            <EmptyState
              variant="filter"
              icon={SearchX}
              title="Filter tidak menemukan kegiatan"
              description="Tidak ada kegiatan penilaian pada kombinasi kelas dan mata pelajaran yang dipilih."
            />
          )}

          {!kegiatan && tersaring.length > 0 && (
            <EmptyState
              variant="filter"
              icon={SearchX}
              title="Kegiatan tidak dapat ditampilkan"
              description="Kegiatan yang diminta berada di luar cakupan akses Anda atau tidak lagi tersedia."
            />
          )}

          {kegiatan && (
            <>
              <section aria-label="Ringkasan dan statistik kegiatan terpilih">
                <SectionHeader title="Ringkasan Kegiatan Terpilih" />
                <div className="grid gap-4 lg:grid-cols-3">
                  <Card>
                    <CardHeader
                      title={kegiatan.judul}
                      description={`${kegiatan.jadwal.mapel.nama} · ${kegiatan.jadwal.kelas.nama}`}
                    />
                    <div className="mt-2">
                      <InfoBaris label="Tanggal" value={formatTanggal(kegiatan.tanggal)} />
                      <InfoBaris label="Nilai Maksimal" value={formatAngka(kegiatan.nilaiMaksimal)} />
                      <InfoBaris label="Siswa Dinilai" value={`${ringkasan.terisi}/${siswaAktif.length}`} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
                      <span className="chip bg-emerald-100 text-emerald-700">Dikumpulkan: {statusHitung.DIKUMPULKAN}</span>
                      <span className="chip bg-amber-100 text-amber-700">Terlambat: {statusHitung.TERLAMBAT}</span>
                      <span className="chip bg-rose-100 text-rose-600">Belum: {statusHitung.BELUM}</span>
                    </div>
                  </Card>

                  <div className="space-y-4 lg:col-span-2">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <StatCard label="Siswa Aktif" value={siswaAktif.length} icon={Users} tone="violet" />
                      <StatCard label="Sudah Memiliki Nilai" value={ringkasan.terisi} icon={CheckCircle2} tone="emerald" />
                      <StatCard label="Belum Memiliki Nilai" value={ringkasan.belumTerisi} icon={AlertTriangle} tone="amber" />
                    </div>

                    {siswaAktif.length > 0 && ringkasan.terisi === 0 && (
                      <Alert variant="warning" title="Belum ada nilai yang terisi">
                        Statistik rata-rata, median, tertinggi, dan terendah akan tampil setelah kegiatan ini memiliki
                        nilai yang terisi.
                      </Alert>
                    )}

                    {ringkasan.terisi > 0 && (
                      <Card>
                        <CardHeader
                          title="Statistik Nilai"
                          description={`Dihitung dari ${ringkasan.terisi} nilai terisi (skala asli kegiatan).`}
                        />
                        <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
                          {statistikItems.map((s) => (
                            <div key={s.label}>
                              <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.label}</dt>
                              <dd className="text-xl font-extrabold text-slate-900">
                                {s.nilai !== null ? formatAngka(s.nilai, 1) : "-"}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </Card>
                    )}
                  </div>
                </div>
              </section>

              <section aria-label="Distribusi rentang nilai">
                <SectionHeader
                  title="Distribusi Rentang Nilai"
                  description="Jumlah siswa per rentang persentase (nilai ÷ nilai maksimal × 100)"
                />
                <Card>
                  {distribusi.every((r) => r.jumlah === 0) ? (
                    <EmptyState
                      icon={FileBarChart}
                      title="Belum ada nilai untuk didistribusikan"
                      description="Distribusi rentang akan tampil setelah kegiatan memiliki nilai terisi."
                    />
                  ) : (
                    <>
                      <BarChartVertikal
                        data={distribusi.map((r) => ({ label: `Rentang ${r.label}`, shortLabel: r.label, nilai: r.jumlah }))}
                        format={(v) => formatAngka(v)}
                      />
                      <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-600">
                        {distribusi.map((r) => (
                          <li key={r.label} className="flex items-center justify-between gap-3">
                            <span>Rentang {r.label}</span>
                            <span className="shrink-0 font-extrabold text-slate-800">{r.jumlah} siswa</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </Card>
              </section>

              <section aria-label="Daftar hasil siswa">
                <SectionHeader
                  title="Daftar Hasil Siswa"
                  description="Hanya untuk dilihat — data mengikuti kondisi tercatat di sistem"
                />
                <Card>
                  {siswaAktif.length === 0 ? (
                    <EmptyState
                      icon={Users}
                      title="Belum ada daftar siswa"
                      description="Kelas pada jadwal kegiatan ini belum memiliki siswa aktif."
                    />
                  ) : (
                    <TabelHasilSiswa rows={rows} />
                  )}
                </Card>
              </section>

              <section aria-label="Tren kegiatan terbaru">
                <SectionHeader
                  title="Tren Kegiatan Terbaru"
                  description="Rata-rata ternormalisasi dari maksimal 6 kegiatan terbaru pada cakupan data"
                />
                <Card>
                  {trenData.length >= 2 ? (
                    <>
                      <BarChartVertikal
                        data={trenData.map((t) => ({ label: t.label, shortLabel: t.shortLabel, nilai: t.persen }))}
                        format={(v) => `${formatAngka(v, 1)}%`}
                      />
                      <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-600">
                        {trenData.map((t) => (
                          <li key={t.id} className="flex items-center justify-between gap-3">
                            <span className="min-w-0 break-words">
                              {t.label} <span className="text-slate-400">({t.shortLabel})</span>
                            </span>
                            <span className="shrink-0 font-extrabold text-slate-800">{formatAngka(t.persen, 1)}%</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <EmptyState
                      icon={FileBarChart}
                      title="Data belum cukup untuk menampilkan tren"
                      description="Tren memerlukan minimal dua kegiatan dengan nilai terisi pada cakupan data ini."
                    />
                  )}
                </Card>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
