import Link from "next/link";
import { AlertCircle, CheckCircle2, GraduationCap, Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { EmptyState, PageHeader, SuksesBanner } from "@/components/ui";
import { KegiatanBadge } from "@/components/status-badge";
import { formatTanggal, formatAngka, KKM_DEFAULT, statusNilai } from "@/lib/utils";
import { JENIS_KEGIATAN_LABEL, JENIS_KEGIATAN_LIST } from "@/lib/constants";
import { SelectNavigasi } from "@/components/select-navigasi";
import type { JenisKegiatan } from "@prisma/client";

export const dynamic = "force-dynamic";

type Opsi = { value: string; label: string };

/** Parameter URL hanya dipakai bila cocok dengan pilihan nyata (mencegah filter asal). */
function paramValid(raw: string | undefined, opsi: Opsi[]): string | undefined {
  if (!raw) return undefined;
  return opsi.some((o) => o.value === raw) ? raw : undefined;
}

type Kegiatan = {
  id: string;
  jenis: JenisKegiatan;
  judul: string;
  tanggal: Date;
  nilaiMaksimal: number;
  jadwal: {
    mapel: { nama: string };
    kelas: { nama: string; siswa: { id: string }[] };
  };
  nilai: { siswaId: string; nilai: number | null; statusKumpul: "DIKUMPULKAN" | "BELUM" | "TERLAMBAT" }[];
};

/**
 * Ringkasan satu kartu kegiatan, SELALU dihitung dari siswa AKTIF kelas saat
 * ini (bukan snapshot baris nilai saat kegiatan dibuat) — konsisten dengan
 * halaman detail dan tidak menjadi negatif bila ada siswa pindah/nonaktif.
 */
function hitungKartu(k: Kegiatan, kkm: number) {
  const nilaiBySiswa = new Map(k.nilai.map((n) => [n.siswaId, n]));
  const siswaAktif = k.jadwal.kelas.siswa;
  let terisi = 0;
  let tuntas = 0;
  let remidi = 0;
  let kosong = 0;
  let jumlahPersen = 0;
  for (const s of siswaAktif) {
    const n = nilaiBySiswa.get(s.id);
    const nilai = n?.nilai ?? null;
    if (nilai !== null) {
      terisi++;
      jumlahPersen += (nilai / k.nilaiMaksimal) * 100;
    }
    const st = statusNilai(nilai, n?.statusKumpul ?? "BELUM", kkm);
    if (st === "TUNTAS") tuntas++;
    else if (st === "REMIDI") remidi++;
    else kosong++;
  }
  return {
    total: siswaAktif.length,
    terisi,
    tuntas,
    remidi,
    kosong,
    rataPersen: terisi > 0 ? jumlahPersen / terisi : null,
  };
}

export default async function NilaiPage({
  searchParams,
}: {
  searchParams: { sukses?: string; jenis?: string; kelas?: string; mapel?: string; q?: string };
}) {
  const user = await getCurrentUser();
  const isGuru = user?.role === "GURU" || (user?.role === "WAKA" && !!user?.guruId);
  // Hanya GURU/WAKA/ADMIN/SUPERADMIN yang boleh membuat kegiatan (guard wajibKelola).
  const bisaKelola = !!user && ["GURU", "WAKA", "ADMIN", "SUPERADMIN"].includes(user.role) && !!user.guruId;

  // Seluruh kegiatan dalam cakupan (tanpa batas atas agar filter tidak
  // "menghilangkan" kegiatan lama), diurut stabil: tanggal lalu createdAt.
  const kegiatan = await prisma.penilaianKegiatan.findMany({
    where: isGuru && user?.guruId ? { jadwal: { guruId: user.guruId } } : {},
    include: {
      jadwal: {
        include: {
          kelas: { include: { siswa: { where: { status: "AKTIF", deletedAt: null }, select: { id: true } } } },
          mapel: true,
        },
      },
      nilai: { select: { siswaId: true, nilai: true, statusKumpul: true } },
    },
    orderBy: [{ tanggal: "desc" }, { createdAt: "desc" }],
  }) as unknown as Kegiatan[];

  const jenisOpsi: Opsi[] = JENIS_KEGIATAN_LIST.map((j) => ({ value: j, label: JENIS_KEGIATAN_LABEL[j] }));
  const kelasOpsi: Opsi[] = [];
  const mapelOpsi: Opsi[] = [];
  for (const k of kegiatan) {
    if (!kelasOpsi.some((o) => o.value === k.jadwal.kelas.nama)) {
      kelasOpsi.push({ value: k.jadwal.kelas.nama, label: k.jadwal.kelas.nama });
    }
    if (!mapelOpsi.some((o) => o.value === k.jadwal.mapel.nama)) {
      mapelOpsi.push({ value: k.jadwal.mapel.nama, label: k.jadwal.mapel.nama });
    }
  }
  kelasOpsi.sort((a, b) => a.label.localeCompare(b.label, "id"));
  mapelOpsi.sort((a, b) => a.label.localeCompare(b.label, "id"));

  // Filter berbasis URL — nilai kelas/mapel memakai NAMA (bukan id) agar tetap
  // terbaca walau id berubah antar lingkungan; sama seperti pilihan di UI.
  const jenisId = paramValid(searchParams.jenis, jenisOpsi) as JenisKegiatan | undefined;
  const kelasNama = paramValid(searchParams.kelas, kelasOpsi);
  const mapelNama = paramValid(searchParams.mapel, mapelOpsi);
  const q = (searchParams.q ?? "").trim().toLowerCase();

  const adaFilter = !!(jenisId || kelasNama || mapelNama || q);
  let tampil: Kegiatan[] = kegiatan;
  if (jenisId) tampil = tampil.filter((k) => k.jenis === jenisId);
  if (kelasNama) tampil = tampil.filter((k) => k.jadwal.kelas.nama === kelasNama);
  if (mapelNama) tampil = tampil.filter((k) => k.jadwal.mapel.nama === mapelNama);
  if (q) {
    tampil = tampil.filter(
      (k) =>
        k.judul.toLowerCase().includes(q) ||
        k.jadwal.mapel.nama.toLowerCase().includes(q) ||
        k.jadwal.kelas.nama.toLowerCase().includes(q)
    );
  }

  return (
    <div className="fade-up">
      <PageHeader
        title="Penilaian"
        subtitle={isGuru ? "Kegiatan penilaian dari jadwal mengajar Anda" : "Kegiatan penilaian seluruh guru"}
        icon={<GraduationCap className="h-6 w-6" />}
        actions={
          bisaKelola ? (
            <Link href="/nilai/baru" className="btn-primary">
              <Plus className="h-4 w-4" /> Buat Kegiatan
            </Link>
          ) : undefined
        }
      />

      <SuksesBanner message={searchParams.sukses} />

      {kegiatan.length === 0 ? (
        <EmptyState
          title="Belum ada kegiatan penilaian"
          desc="Buat kegiatan (tugas, kuis, ulangan harian, dll.) untuk mulai mencatat nilai siswa."
          action={
            bisaKelola ? (
              <Link href="/nilai/baru" className="btn-primary">
                <Plus className="h-4 w-4" /> Buat Kegiatan Pertama
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Filter & pencarian */}
          <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="w-full sm:w-auto sm:min-w-[150px]">
              <label className="label">Jenis</label>
              <SelectNavigasi
                param="jenis"
                className="input min-h-[44px]"
                value={jenisId ?? ""}
                options={[{ value: "", label: "Semua Jenis" }, ...jenisOpsi]}
              />
            </div>
            <div className="w-full sm:w-auto sm:min-w-[150px]">
              <label className="label">Kelas</label>
              <SelectNavigasi
                param="kelas"
                className="input min-h-[44px]"
                value={kelasNama ?? ""}
                options={[{ value: "", label: "Semua Kelas" }, ...kelasOpsi]}
              />
            </div>
            <div className="w-full sm:w-auto sm:min-w-[150px]">
              <label className="label">Mata Pelajaran</label>
              <SelectNavigasi
                param="mapel"
                className="input min-h-[44px]"
                value={mapelNama ?? ""}
                options={[{ value: "", label: "Semua Mapel" }, ...mapelOpsi]}
              />
            </div>
            <div className="w-full sm:min-w-[200px] sm:flex-1">
              <label className="label">Cari judul / mapel / kelas</label>
              <form action="/nilai" method="get" className="flex gap-2">
                {jenisId && <input type="hidden" name="jenis" value={jenisId} />}
                {kelasNama && <input type="hidden" name="kelas" value={kelasNama} />}
                {mapelNama && <input type="hidden" name="mapel" value={mapelNama} />}
                <input
                  className="input min-h-[44px] flex-1"
                  name="q"
                  defaultValue={searchParams.q ?? ""}
                  placeholder="mis. Kuis Bab 1…"
                />
                <button className="btn-secondary min-h-[44px]">Cari</button>
              </form>
            </div>
            {adaFilter && (
              <Link href="/nilai" className="btn-ghost btn-sm self-end text-rose-600 hover:bg-rose-50">
                Hapus filter
              </Link>
            )}
          </div>

          <p className="mt-3 text-xs font-semibold text-slate-400">
            Menampilkan {tampil.length} dari {kegiatan.length} kegiatan
            {adaFilter ? " (filter aktif)" : " · diurutkan terbaru"} — rata-rata dalam persen agar sebanding antar kegiatan.
          </p>

          {tampil.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="Tidak ada kegiatan yang cocok"
                desc="Coba ubah jenis/kelas/mapel atau kata kunci pencarian."
                action={
                  <Link href="/nilai" className="btn-ghost">
                    Hapus semua filter
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tampil.map((k) => {
                const h = hitungKartu(k, KKM_DEFAULT);
                return (
                  <Link key={k.id} href={`/nilai/${k.id}`} className="card group p-5 transition hover:border-violet-300 hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <KegiatanBadge jenis={k.jenis} />
                      <span className="flex flex-col items-end gap-1 text-xs font-semibold text-slate-400">
                        <span>{formatTanggal(k.tanggal)}</span>
                        <span className="font-bold text-slate-500">maks {k.nilaiMaksimal}</span>
                      </span>
                    </div>
                    <p className="break-words mt-3 font-extrabold text-slate-900 group-hover:text-violet-700">{k.judul}</p>
                    <p className="break-words mt-0.5 text-sm text-slate-500">
                      {k.jadwal.mapel.nama} · {k.jadwal.kelas.nama}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-slate-100 pt-3 text-sm">
                      <span className="flex flex-wrap items-center gap-1 break-words font-bold text-slate-700">
                        {h.terisi}/{h.total} dinilai
                        {h.rataPersen !== null && (
                          <span className="font-semibold text-slate-400">· rata-rata {formatAngka(h.rataPersen, 1)}%</span>
                        )}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                      {h.tuntas > 0 && (
                        <span className="chip bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> {h.tuntas} tuntas
                        </span>
                      )}
                      {h.remidi > 0 && (
                        <span className="chip bg-rose-100 text-rose-700">
                          <AlertCircle className="h-3 w-3" /> {h.remidi} remidi
                        </span>
                      )}
                      {h.kosong > 0 ? (
                        <span className="chip bg-slate-200 text-slate-700">{h.kosong} belum dinilai</span>
                      ) : (
                        h.terisi > 0 && (
                          <span className="chip bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" /> Semua tuntas
                          </span>
                        )
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
