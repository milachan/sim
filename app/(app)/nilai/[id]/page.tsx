import { notFound } from "next/navigation";
import { AlertCircle, CheckCircle2, HelpCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Breadcrumb, Card, InfoRow, PageHeader, SuksesBanner } from "@/components/ui";
import { KegiatanBadge } from "@/components/status-badge";
import { TombolCetak } from "@/components/tombol-cetak";
import { formatTanggal, KKM_DEFAULT, statusNilai } from "@/lib/utils";
import { bolehBacaKegiatanNilai, bolehKelolaKegiatanNilai } from "@/lib/otorisasi";
import FormNilaiTable from "@/components/nilai/form-nilai-table";

export const dynamic = "force-dynamic";

export default async function DetailNilai({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { sukses?: string };
}) {
  const user = await getCurrentUser();

  // Otorisasi sebelum data sensitif lengkap diambil: hanya ambil kepemilikan
  // jadwal untuk memutuskan siapa yang boleh membaca kegiatan penilaian.
  const cekKegiatan = await prisma.penilaianKegiatan.findUnique({
    where: { id: params.id },
    select: { jadwal: { select: { guruId: true } } },
  });
  if (!cekKegiatan) notFound();
  if (!bolehBacaKegiatanNilai(user, cekKegiatan.jadwal.guruId)) notFound();
  const bolehKelola = bolehKelolaKegiatanNilai(user, cekKegiatan.jadwal.guruId);

  const kegiatan = await prisma.penilaianKegiatan.findUnique({
    where: { id: params.id },
    include: {
      jadwal: { include: { kelas: { include: { siswa: { where: { status: "AKTIF", deletedAt: null }, orderBy: { nama: "asc" } } } }, mapel: true, guru: true } },
      nilai: { include: { siswa: true } },
    },
  });
  if (!kegiatan) notFound();

  // Rekap dihitung dari siswa AKTIF kelas saat ini (konsisten dengan halaman
  // daftar) — bukan dari snapshot baris nilai saat kegiatan dibuat.
  const nilaiBySiswa = new Map(kegiatan.nilai.map((n) => [n.siswaId, n]));
  const siswaAktif = kegiatan.jadwal.kelas.siswa;
  const nilaiTerisiAngka: number[] = [];
  let belumKumpul = 0;
  let remidi = 0;
  let kosong = 0;
  let tuntas = 0;
  for (const s of siswaAktif) {
    const n = nilaiBySiswa.get(s.id);
    const nilai = n?.nilai ?? null;
    if (nilai !== null) nilaiTerisiAngka.push(nilai);
    if (n?.statusKumpul === "BELUM") belumKumpul++;
    const st = statusNilai(nilai, n?.statusKumpul ?? "BELUM", KKM_DEFAULT);
    if (st === "REMIDI") remidi++;
    else if (st === "KOSONG") kosong++;
    else tuntas++;
  }
  const rata = nilaiTerisiAngka.length ? nilaiTerisiAngka.reduce((a, v) => a + v, 0) / nilaiTerisiAngka.length : null;
  const max = nilaiTerisiAngka.length ? Math.max(...nilaiTerisiAngka) : null;
  const min = nilaiTerisiAngka.length ? Math.min(...nilaiTerisiAngka) : null;
  const totalSiswa = siswaAktif.length;

  return (
    <div className="fade-up">
      <Breadcrumb
        items={[
          { href: "/", label: "Beranda" },
          { href: "/nilai", label: "Penilaian" },
          { label: kegiatan.judul },
        ]}
      />

      <SuksesBanner message={searchParams.sukses} />

      <PageHeader
        title={kegiatan.judul}
        subtitle={`${kegiatan.jadwal.mapel.nama} — ${kegiatan.jadwal.kelas.nama} · ${kegiatan.jadwal.guru.nama}`}
        actions={
          <>
            <TombolCetak className="btn-secondary no-print" label="Cetak" />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-4 print-area">
        <div className="lg:col-span-1">
          <Card className="card-pad">
            <KegiatanBadge jenis={kegiatan.jenis} />
            <div className="mt-3">
              <InfoRow label="Tanggal" value={formatTanggal(kegiatan.tanggal)} />
              <InfoRow label="Nilai Maksimal" value={kegiatan.nilaiMaksimal} strong />
              <InfoRow
                label="KKM"
                value={
                  <span className="inline-flex items-center gap-1">
                    {KKM_DEFAULT}
                    <span
                      title="Kriteria Ketuntasan Minimal. Siswa dengan nilai di bawah KKM berstatus remidi."
                      className="cursor-help text-slate-400"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                    </span>
                  </span>
                }
                strong
              />
              <InfoRow label="Siswa dinilai" value={`${nilaiTerisiAngka.length}/${totalSiswa}`} />
              <InfoRow label="Belum kumpul" value={belumKumpul} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
              <div>
                <p className="text-lg font-extrabold text-slate-900">{rata !== null ? rata.toFixed(1) : "-"}</p>
                <p className="text-[10px] font-bold uppercase text-slate-400">Rata-rata</p>
              </div>
              <div>
                <p className="text-lg font-extrabold text-emerald-600">{max ?? "-"}</p>
                <p className="text-[10px] font-bold uppercase text-slate-400">Tertinggi</p>
              </div>
              <div>
                <p className="text-lg font-extrabold text-rose-500">{min ?? "-"}</p>
                <p className="text-[10px] font-bold uppercase text-slate-400">Terendah</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2.5 text-center">
              <div>
                <p className="text-base font-extrabold text-emerald-700">{tuntas}</p>
                <p className="mt-0.5 text-[10px] font-bold uppercase text-slate-500">Tuntas</p>
              </div>
              <div>
                <p className="text-base font-extrabold text-rose-600">{remidi}</p>
                <p className="mt-0.5 text-[10px] font-bold uppercase text-slate-500">Remidi</p>
              </div>
              <div>
                <p className="text-base font-extrabold text-slate-500">{kosong}</p>
                <p className="mt-0.5 text-[10px] font-bold uppercase text-slate-500">Kosong</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
              {remidi > 0 && (
                <span className="chip bg-rose-100 text-rose-700">
                  <AlertCircle className="h-3 w-3" /> {remidi} siswa remidi
                </span>
              )}
              {kosong > 0 && (
                <span className="chip bg-slate-200 text-slate-700">{kosong} siswa belum ada nilai</span>
              )}
              {remidi === 0 && kosong === 0 && totalSiswa > 0 && (
                <span className="chip bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" /> Semua siswa tuntas
                </span>
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-3 print-area">
          <FormNilaiTable
            kegiatanId={kegiatan.id}
            nilaiMaksimal={kegiatan.nilaiMaksimal}
            kkm={KKM_DEFAULT}
            bolehKelola={bolehKelola}
            rows={kegiatan.jadwal.kelas.siswa.map((s) => {
              const n = kegiatan.nilai.find((x) => x.siswaId === s.id);
              return {
                siswaId: s.id,
                nama: s.nama,
                nis: s.nis,
                nilai: n?.nilai ?? null,
                catatan: n?.catatan ?? "",
                statusKumpul: n?.statusKumpul ?? "BELUM",
              };
            })}
          />
        </div>
      </div>
    </div>
  );
}
