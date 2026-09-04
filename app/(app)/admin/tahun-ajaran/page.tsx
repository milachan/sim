import Link from "next/link";
import {
  Archive,
  CalendarRange,
  ChevronDown,
  GraduationCap,
  Info,
  Lock,
  Pencil,
  Plus,
  Sparkles,
  Zap,
} from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, ErrorBanner, PageHeader, SuksesBanner } from "@/components/ui";
import { formHapusSemester, formPulihkanSemester, formSemester, formTahunAjaran } from "@/lib/actions/admin-forms";
import { TombolHapus } from "@/components/tombol-hapus";
import { cariSemesterAktif } from "@/lib/semester";
import { cn, formatTanggal } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SemesterItem = {
  id: string;
  nama: string;
  aktif: boolean;
  deletedAt: Date | null;
  mulai: Date | null;
  selesai: Date | null;
  tahunAjaranId: string;
  _count: { jadwal: number };
};

type TahunAjaranItem = {
  id: string;
  nama: string;
  aktif: boolean;
  semester: SemesterItem[];
};

type SearchParams = { sukses?: string; error?: string; edit?: string; editTa?: string; tambah?: string };

export default async function AdminTahunAjaranPage({ searchParams }: { searchParams: SearchParams }) {
  await getCurrentUser();
  // Sinkronkan periode aktif bila ada pergantian otomatis berdasarkan tanggal
  await cariSemesterAktif();
  const tahunAjaran = (await prisma.tahunAjaran.findMany({
    include: { semester: { include: { _count: { select: { jadwal: true } } } } },
    orderBy: [{ aktif: "desc" }, { nama: "desc" }],
  })) as TahunAjaranItem[];

  const semuaSemester = tahunAjaran.flatMap((t) => t.semester);
  const editSem = searchParams.edit ? semuaSemester.find((s) => s.id === searchParams.edit && !s.deletedAt) : null;
  const editTa = searchParams.editTa ? tahunAjaran.find((t) => t.id === searchParams.editTa) : null;
  const tambahTaId =
    searchParams.tambah && tahunAjaran.some((t) => t.id === searchParams.tambah) ? searchParams.tambah : null;
  const totalPeriode = semuaSemester.filter((s) => !s.deletedAt).length;

  // Periode yang sedang aktif (fokus utama halaman ini)
  const semAktif = semuaSemester.find((s) => !s.deletedAt && s.aktif);
  const taAktif = semAktif ? tahunAjaran.find((t) => t.id === semAktif.tahunAjaranId) : null;
  const adaPeriodeAktif = !!semAktif;

  // Tahun ajaran yang dipilih untuk form periode: edit > praseleksi (?tambah=) > tahun berjalan > pertama
  const taUntukPeriode =
    editSem?.tahunAjaranId ?? tambahTaId ?? taAktif?.id ?? tahunAjaran.find((t) => t.aktif)?.id ?? tahunAjaran[0]?.id;
  const tahunPilihan = tahunAjaran.find((t) => t.id === taUntukPeriode);
  const defaultAktif = tahunPilihan ? !tahunPilihan.semester.some((s) => !s.deletedAt && s.aktif) : true;

  // Buka bagian "Semua Tahun Ajaran" otomatis saat sedang mengubah dari sana
  const bukaSemua = !!editSem || !!editTa || !!tambahTaId;

  return (
    <div className="fade-up">
      <PageHeader
        title="Tahun Ajaran & Periode"
        subtitle={`Halaman ini menampilkan periode yang sedang aktif — periode inilah yang dipakai jadwal, jurnal & absensi guru. Kelola semua tahun ajaran & periode lain di bagian "Semua Tahun Ajaran" di bawah.`}
        icon={<GraduationCap className="h-6 w-6" />}
      />
      <SuksesBanner message={searchParams.sukses} />
      <ErrorBanner message={searchParams.error} />

      {/* ===== Periode yang sedang aktif ===== */}
      {adaPeriodeAktif && semAktif && taAktif ? (
        <Card className="relative mb-6 overflow-hidden border-emerald-200">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-400" />
          <div className="relative p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip bg-emerald-600 text-white">● Aktif — sedang dipakai</span>
              <span className="chip bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">
                {taAktif.nama}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">{semAktif.nama}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Tahun ajaran <b className="text-slate-700">{taAktif.nama}</b> · {totalPeriode} periode tercatat
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/tahun-ajaran?edit=${semAktif.id}`} className="btn-secondary btn-sm">
                  <Pencil className="h-3.5 w-3.5 text-emerald-700" /> Ubah Periode
                </Link>
                <Link href={`/admin/tahun-ajaran?tambah=${taAktif.id}`} className="btn-secondary btn-sm">
                  <Plus className="h-3.5 w-3.5" /> Tambah Periode
                </Link>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-emerald-100 pt-4 text-sm text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <CalendarRange className="h-4 w-4 text-emerald-600" />
                {semAktif.mulai ? (
                  <span>
                    Berlaku otomatis:{" "}
                    <b className="text-slate-800">
                      {formatTanggal(semAktif.mulai, "d MMM yyyy")} –{" "}
                      {semAktif.selesai ? formatTanggal(semAktif.selesai, "d MMM yyyy") : "tanpa batas"}
                    </b>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5 text-amber-500" /> Diaktifkan manual
                  </span>
                )}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                <b className="text-slate-800">{semAktif._count.jadwal}</b> jadwal pelajaran
              </span>
            </div>
          </div>
        </Card>
      ) : (
        <div className="fade-up mb-6 flex flex-col gap-4 rounded-[1.15rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-bold">Belum ada periode yang aktif</p>
              <p className="mt-0.5 leading-5 text-amber-800">
                Jadwal guru belum ditentukan. Aktifkan salah satu periode lewat tombol <b>Aktifkan</b> di bagian{" "}
                <a href="#semua-tahun-ajaran" className="font-semibold text-amber-900 underline">
                  Semua Tahun Ajaran
                </a>{" "}
                di bawah.
              </p>
            </div>
          </div>
          <a href="#semua-tahun-ajaran" className="btn-primary btn-sm shrink-0">
            Pilih Periode Aktif
          </a>
        </div>
      )}

      {/* ===== Tambah / Ubah tahun ajaran ===== */}
      <Card className="card-pad mb-6">
        <h3 className="mb-4 flex items-center gap-2 font-extrabold text-slate-900">
          {editTa ? (
            <>
              <Pencil className="h-4 w-4 text-emerald-600" /> Ubah Tahun Ajaran: {editTa.nama}
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 text-emerald-600" /> Tambah Tahun Ajaran
            </>
          )}
        </h3>
        <form action={formTahunAjaran} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {editTa && <input type="hidden" name="id" value={editTa.id} />}
          <div className="flex-1">
            <label className="label">Nama tahun ajaran *</label>
            <input className="input" name="nama" defaultValue={editTa?.nama ?? ""} placeholder="mis. 2026/2027" required />
          </div>
          <div className="flex shrink-0 items-end gap-2">
            <button className="btn-primary">{editTa ? "Simpan Perubahan" : "Simpan"}</button>
            {editTa && <Link href="/admin/tahun-ajaran" className="btn-ghost">Batal</Link>}
          </div>
        </form>
        {!editTa && (
          <p className="mt-2 text-xs text-slate-500">
            Tahun ajaran baru dimulai tanpa periode — tambahkan periodenya lewat form <b>Tambah Periode Baru</b> di bawah.
          </p>
        )}
      </Card>

      {/* ===== Tambah / Ubah periode ===== */}
      {tahunAjaran.length > 0 && (
        <Card className="card-pad mb-6">
          <h3 className="mb-4 flex items-center gap-2 font-extrabold text-slate-900">
            {editSem ? (
              <>
                <Pencil className="h-4 w-4 text-emerald-600" /> Ubah Periode: {editSem.nama}
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 text-emerald-600" /> Tambah Periode Baru
              </>
            )}
          </h3>
          <form action={formSemester} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {editSem && <input type="hidden" name="id" value={editSem.id} />}
            {!editSem ? (
              <div>
                <label className="label">Tahun ajaran *</label>
                <select className="input" name="tahunAjaranId" defaultValue={taUntukPeriode ?? ""} required>
                  {tahunAjaran.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nama}
                      {t.aktif ? " (tahun berjalan)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <input type="hidden" name="tahunAjaranId" value={editSem.tahunAjaranId} />
            )}
            <div>
              <label className="label">Nama periode *</label>
              <input
                className="input"
                name="nama"
                defaultValue={editSem ? editSem.nama : ""}
                placeholder="mis. Ganjil / Genap"
                required
              />
            </div>
            <div>
              <label className="label">Berlaku mulai</label>
              <input
                type="date"
                name="mulai"
                className="input"
                defaultValue={editSem?.mulai ? editSem.mulai.toISOString().slice(0, 10) : ""}
              />
            </div>
            <div>
              <label className="label">Berlaku sampai</label>
              <input
                type="date"
                name="selesai"
                className="input"
                defaultValue={editSem?.selesai ? editSem.selesai.toISOString().slice(0, 10) : ""}
              />
            </div>
            <div className="flex items-end">
              <label
                className="flex items-center gap-2 pb-2.5 text-sm font-semibold text-slate-600"
                title="Periode aktif lain di tahun ajaran ini otomatis dinonaktifkan."
              >
                <input
                  type="checkbox"
                  name="aktif"
                  value="1"
                  defaultChecked={editSem ? editSem.aktif : defaultAktif}
                  className="accent-emerald-600"
                />
                Langsung aktifkan
              </label>
            </div>
            <div className="flex items-end gap-2">
              <button className="btn-primary btn-sm whitespace-nowrap">{editSem ? "Simpan Perubahan" : "Tambah Periode"}</button>
              {editSem && <Link href="/admin/tahun-ajaran" className="btn-ghost btn-sm">Batal</Link>}
            </div>
          </form>
          <p className="mt-3 text-xs text-slate-500">
            💡 Isi tanggal berlaku bila periode berganti otomatis sesuai tanggal (pergantian jadwal berkala). Bila kosong,
            aktifkan manual lewat tombol <b>Aktifkan</b> pada periode yang dipakai.
          </p>
        </Card>
      )}

      {tahunAjaran.length === 0 && (
        <EmptyState title="Belum ada tahun ajaran" desc="Buat tahun ajaran pertama di atas, lalu tambahkan periode di dalamnya." />
      )}

      {/* ===== Semua tahun ajaran & periode (dilipat agar fokus tetap pada periode aktif) ===== */}
      {tahunAjaran.length > 0 && (
        <details id="semua-tahun-ajaran" className="group" open={bukaSemua}>
          <summary className="flex cursor-pointer select-none items-center gap-2.5 rounded-[1.15rem] border border-slate-200 bg-white px-4 py-3.5 text-sm font-extrabold text-slate-800 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
            <Archive className="h-5 w-5 text-slate-400" />
            Semua Tahun Ajaran & Periode
            <span className="chip bg-slate-100 text-slate-500">
              {tahunAjaran.length} tahun · {totalPeriode} periode
            </span>
            <ChevronDown className="ml-auto h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>

          <div className="mt-3 space-y-4">
            {/* Cara kerja singkat */}
            <Card className="border-blue-100 bg-blue-50/50">
              <div className="p-4 sm:p-5">
                <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <Info className="h-4 w-4 text-blue-600" /> Cara mengatur periode
                </h3>
                <ol className="mt-3 grid gap-x-6 gap-y-2 text-sm text-slate-700 md:grid-cols-3">
                  <li><b>1.</b> Buat tahun ajaran, mis. <i>2026/2027</i>.</li>
                  <li><b>2.</b> Buat periode di dalamnya — mis. <i>Ganjil</i>, <i>Genap</i>.</li>
                  <li><b>3.</b> Aktifkan periode yang sedang dipakai. Jadwal, jurnal &amp; absensi guru mengikuti periode aktif.</li>
                </ol>
                <p className="mt-3 text-xs leading-5 text-slate-600">
                  Periode yang diisi tanggal berlaku otomatis berganti saat tanggal masuk rentangnya (pergantian jadwal
                  berkala); tanpa tanggal, aktifkan manual lewat tombol <b>Aktifkan</b>. Mengarsipkan periode hanya
                  menyembunyikannya dari daftar — seluruh jurnal &amp; data guru tetap aman.
                </p>
              </div>
            </Card>

            {tahunAjaran.length === 0 ? (
              <EmptyState title="Belum ada tahun ajaran" desc="Buat tahun ajaran pertama lewat form di atas." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {tahunAjaran.map((ta) => {
                  const aktifSem = ta.semester.filter((s) => !s.deletedAt);
                  const arsipSem = ta.semester.filter((s) => s.deletedAt);
                  const jadwalTotal = aktifSem.reduce((n, s) => n + s._count.jadwal, 0);
                  const semAktif = aktifSem.find((s) => s.aktif);
                  const sedangUbahTa = editTa?.id === ta.id;
                  return (
                    <Card key={ta.id} className={cn("card-pad", sedangUbahTa && "border-blue-400", semAktif && "border-emerald-200")}>
                      {/* Header kartu */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="flex flex-wrap items-center gap-2 text-lg font-extrabold text-slate-900">
                            {ta.nama}
                            {semAktif && <span className="chip bg-emerald-600 text-white">● Aktif</span>}
                          </h3>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {aktifSem.length} periode · {jadwalTotal} jadwal
                            {semAktif && (
                              <>
                                {" "}
                                · <span className="font-semibold text-emerald-700">dipakai: {semAktif.nama}</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Daftar periode aktif */}
                      <div className="mt-4 space-y-2">
                        {aktifSem.length === 0 && (
                          <p className="rounded-xl border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-400">
                            Belum ada periode. Gunakan tombol “Tambah Periode” di bawah.
                          </p>
                        )}
                        {aktifSem.map((s) => {
                          const sedangUbahSem = searchParams.edit === s.id;
                          return (
                            <div
                              key={s.id}
                              className={cn(
                                "flex flex-col gap-2 rounded-xl border px-4 py-3 transition sm:flex-row sm:items-center sm:justify-between",
                                s.aktif ? "border-emerald-300 bg-emerald-50/70" : "border-slate-200 bg-white hover:border-slate-300",
                                sedangUbahSem && "border-blue-400 bg-blue-50/60 ring-1 ring-blue-200"
                              )}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-800">
                                  {s.nama}
                                  {s.aktif && <span className="chip bg-emerald-600 text-white">● Aktif — sedang dipakai</span>}
                                </p>
                                <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                                  {s.mulai ? (
                                    <span className="inline-flex items-center gap-1">
                                      <CalendarRange className="h-3 w-3" />
                                      <span className={s.aktif ? "font-semibold text-emerald-700" : ""}>
                                        Berlaku otomatis: {formatTanggal(s.mulai, "d MMM yyyy")} –{" "}
                                        {s.selesai ? formatTanggal(s.selesai, "d MMM yyyy") : "tanpa batas"}
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-slate-400">
                                      <Zap className="h-3 w-3" /> Manual — aktifkan lewat tombol
                                    </span>
                                  )}
                                  <span className="text-slate-300">·</span>
                                  <span>{s._count.jadwal} jadwal</span>
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                                <Link href={`/admin/tahun-ajaran?edit=${s.id}`} className="btn-ghost btn-sm !px-2.5 text-emerald-700">
                                  Ubah
                                </Link>
                                {s.aktif ? (
                                  <span
                                    title="Periode yang sedang dipakai tidak bisa diarsipkan. Aktifkan periode lain terlebih dahulu — data periode ini (jadwal, absensi & jurnal) tetap aman."
                                    className="inline-flex cursor-help items-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-400"
                                  >
                                    <Lock className="h-3.5 w-3.5" /> Tidak bisa diarsipkan
                                  </span>
                                ) : (
                                  <>
                                    <form action={formSemester} title="Jadikan periode ini yang dipakai guru — jadwal, jurnal & absensi mengikutinya.">
                                      <input type="hidden" name="id" value={s.id} />
                                      <input type="hidden" name="tahunAjaranId" value={ta.id} />
                                      <input type="hidden" name="nama" value={s.nama} />
                                      <input type="hidden" name="aktif" value="1" />
                                      <button className="btn-secondary btn-sm !px-3">Aktifkan</button>
                                    </form>
                                    <TombolHapus
                                      action={formHapusSemester}
                                      id={s.id}
                                      label="Arsipkan"
                                      pesan={`Arsipkan periode "${s.nama}"? Seluruh jadwal, absensi & jurnal guru tetap aman dan tetap tercatat di laporan bulanan — periode hanya disembunyikan dari daftar.`}
                                    />
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Arsip (dilipat) */}
                      {arsipSem.length > 0 && (
                        <details className="group mt-3">
                          <summary className="flex cursor-pointer select-none items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
                            <Archive className="h-3.5 w-3.5" />
                            Arsip ({arsipSem.length}) — data tetap aman
                            <ChevronDown className="ml-auto h-3.5 w-3.5 text-slate-400 transition-transform group-open:rotate-180" />
                          </summary>
                          <div className="mt-2 space-y-1.5">
                            {arsipSem.map((s) => (
                              <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-500 line-through decoration-slate-300">{s.nama}</p>
                                  <p className="text-[11px] text-slate-400">
                                    {s.mulai
                                      ? `${formatTanggal(s.mulai, "d MMM yyyy")} – ${s.selesai ? formatTanggal(s.selesai, "d MMM yyyy") : "selesai"}`
                                      : "tanpa tanggal"}{" "}
                                    · {s._count.jadwal} jadwal
                                  </p>
                                </div>
                                <form action={formPulihkanSemester}>
                                  <input type="hidden" name="id" value={s.id} />
                                  <button className="btn-ghost btn-sm !text-xs text-emerald-700">Pulihkan</button>
                                </form>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      {/* Aksi kartu */}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                        <Link href={`/admin/tahun-ajaran?tambah=${ta.id}`} className="btn-secondary btn-sm">
                          <Plus className="h-3.5 w-3.5" /> Tambah Periode
                        </Link>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link href={`/admin/tahun-ajaran?editTa=${ta.id}`} className="btn-ghost btn-sm" title="Ubah nama tahun ajaran ini">
                            Ubah nama
                          </Link>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
