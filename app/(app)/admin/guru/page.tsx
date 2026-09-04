import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, ErrorBanner, PageHeader, SuksesBanner, TableRow, TableShell, Td, Th } from "@/components/ui";
import { JENIS_GURU_BADGE, JENIS_GURU_LABEL, ROLE_LABEL } from "@/lib/constants";
import type { JenisGuru } from "@prisma/client";
import { formGuru, formHapusGuru, formPulihkanGuru } from "@/lib/actions/admin-forms";
import { TombolHapus } from "@/components/tombol-hapus";
import { GuruImport } from "@/components/admin/guru-import";
import { SelectNavigasi } from "@/components/select-navigasi";

export const dynamic = "force-dynamic";

export default async function AdminGuruPage({
  searchParams,
}: {
  searchParams: { sukses?: string; error?: string; edit?: string; q?: string; status?: string };
}) {
  await getCurrentUser();
  const [gurus, mapels] = await Promise.all([
    prisma.guru.findMany({ include: { mapelDiampu: true, waliKelas: true, user: { select: { id: true, username: true, role: true, aktif: true } } }, orderBy: [{ status: "desc" }, { nama: "asc" }] }),
    prisma.mataPelajaran.findMany({ orderBy: { nama: "asc" } }),
  ]);
  const edit = searchParams.edit ? gurus.find((g) => g.id === searchParams.edit) : null;

  // Filter berbasis URL (pola sama seperti halaman nilai).
  const q = (searchParams.q ?? "").trim().toLowerCase();
  const statusF = searchParams.status === "aktif" ? "aktif" : searchParams.status === "nonaktif" ? "nonaktif" : "";
  const adaFilter = !!(q || statusF);

  let tampil = gurus;
  if (q) {
    tampil = tampil.filter(
      (g) =>
        g.nama.toLowerCase().includes(q) ||
        (g.kode ?? "").toLowerCase().includes(q) ||
        (g.nip ?? "").toLowerCase().includes(q) ||
        (g.user?.username ?? "").toLowerCase().includes(q)
    );
  }
  if (statusF === "aktif") tampil = tampil.filter((g) => g.status);
  if (statusF === "nonaktif") tampil = tampil.filter((g) => !g.status);

  const jumlahAktif = gurus.filter((g) => g.status).length;
  const jumlahTanpaAkun = gurus.filter((g) => !g.user).length;
  const jumlahWali = gurus.filter((g) => g.waliKelas.length > 0).length;

  return (
    <div className="fade-up">
      <PageHeader title="Data Guru" subtitle={`${gurus.length} guru tercatat`} icon={<Users className="h-6 w-6" />} />
      <SuksesBanner message={searchParams.sukses} />
      <ErrorBanner message={searchParams.error} />

      {/* Ringkasan cepat */}
      <div className="mb-6 flex flex-wrap gap-2">
        <span className="chip bg-slate-900 text-white">{gurus.length} guru</span>
        <span className="chip bg-emerald-100 text-emerald-700">{jumlahAktif} aktif</span>
        <span className="chip bg-slate-200 text-slate-600">{gurus.length - jumlahAktif} nonaktif</span>
        <span className="chip bg-amber-100 text-amber-800">{jumlahTanpaAkun} tanpa akun</span>
        <span className="chip bg-violet-100 text-violet-700">{jumlahWali} wali kelas</span>
      </div>

      <GuruImport />

      <Card className="card-pad mb-6">
        <h3 className="mb-4 flex items-center gap-2 font-extrabold text-slate-900">
          <Plus className="h-4 w-4 text-emerald-600" /> {edit ? `Ubah: ${edit.nama}` : "Tambah Guru Baru"}
        </h3>
        <form action={formGuru} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={edit?.id ?? ""} />
          <div className="sm:col-span-2">
            <label className="label">Nama Lengkap & Gelar *</label>
            <input className="input" name="nama" defaultValue={edit?.nama ?? ""} placeholder="mis. Budi Santoso, S.Kom." required />
          </div>
          <div>
            <label className="label">Kode Guru (opsional)</label>
            <input className="input" name="kode" defaultValue={edit?.kode ?? ""} placeholder="mis. K5" />
            <p className="mt-1 text-xs text-slate-400">Kode dari file jadwal (contoh: K5) — kunci sinkron saat upload jadwal.</p>
          </div>
          <div>
            <label className="label">NIP / NUPTK</label>
            <input className="input" name="nip" defaultValue={edit?.nip ?? ""} />
          </div>
          <div>
            <label className="label">No. WhatsApp</label>
            <input className="input" name="telepon" defaultValue={edit?.telepon ?? ""} placeholder="mis. 081234567890" />
            <p className="mt-1 text-xs text-slate-400">Dipakai untuk pengingat jurnal via WhatsApp (opsional).</p>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" name="status" defaultValue={edit ? (edit.status ? "1" : "0") : "1"}>
              <option value="1">Aktif</option>
              <option value="0">Nonaktif</option>
            </select>
          </div>
          <div>
            <label className="label">Jenis Guru</label>
            <select className="input" name="jenisGuru" defaultValue={edit?.jenisGuru ?? "BIASA"}>
              {(Object.keys(JENIS_GURU_LABEL) as JenisGuru[]).map((j) => (
                <option key={j} value={j}>{JENIS_GURU_LABEL[j]}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Piket = backup absensi harian bila guru jam pertama belum mengisi. BK = punya halaman khusus & dapat dijadwalkan.
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Mata Pelajaran Diampu</label>
            <div className="flex flex-wrap gap-2 rounded-xl border border-slate-300 bg-slate-50 p-3">
              {mapels.map((m) => (
                <label key={m.id} className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 transition hover:ring-emerald-400">
                  <input type="checkbox" name="mapelId" value={m.id} defaultChecked={edit?.mapelDiampu.some((x) => x.id === m.id) ?? false} className="accent-emerald-600" />
                  {m.nama}
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <button className="btn-primary">Simpan</button>
            {edit && <Link href="/admin/guru" className="btn-ghost ml-2">Batal</Link>}
          </div>
        </form>
      </Card>

      {gurus.length === 0 ? (
        <EmptyState
          title="Belum ada guru tercatat"
          desc="Tambahkan guru lewat form di atas, atau gunakan Import Data Guru (Excel) untuk membuat banyak guru sekaligus beserta akunnya."
        />
      ) : (
        <>
          {/* Filter & pencarian */}
          <div className="card mb-3 flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="w-full sm:w-auto sm:min-w-[160px]">
              <label className="label">Status</label>
              <SelectNavigasi
                param="status"
                className="input min-h-[44px]"
                value={statusF}
                options={[
                  { value: "", label: "Semua Status" },
                  { value: "aktif", label: "Aktif" },
                  { value: "nonaktif", label: "Nonaktif" },
                ]}
              />
            </div>
            <div className="w-full sm:min-w-[220px] sm:flex-1">
              <label className="label">Cari nama / kode / NIP / username</label>
              <form action="/admin/guru" method="get" className="flex gap-2">
                {statusF && <input type="hidden" name="status" value={statusF} />}
                <input
                  className="input min-h-[44px] flex-1"
                  name="q"
                  defaultValue={searchParams.q ?? ""}
                  placeholder="mis. Budi…"
                />
                <button className="btn-secondary min-h-[44px]">Cari</button>
              </form>
            </div>
            {adaFilter && (
              <Link href="/admin/guru" className="btn-ghost btn-sm self-end text-rose-600 hover:bg-rose-50">
                Hapus filter
              </Link>
            )}
          </div>

          {tampil.length === 0 ? (
            <EmptyState
              title="Tidak ada guru yang cocok"
              desc="Coba ubah kata kunci pencarian atau filter status."
              action={
                <Link href="/admin/guru" className="btn-ghost">
                  Hapus semua filter
                </Link>
              }
            />
          ) : (
            <TableShell>
              <thead>
                <tr>
                  <Th>Nama</Th>
                  <Th>Kode</Th>
                  <Th>Jenis</Th>
                  <Th>Kontak</Th>
                  <Th>Mapel Diampu</Th>
                  <Th>Status</Th>
                  <Th>Akun</Th>
                  <Th className="text-right">Aksi</Th>
                </tr>
              </thead>
              <tbody>
                {tampil.map((g) => (
                  <TableRow key={g.id} className={g.deletedAt ? "opacity-50" : ""}>
                    <Td className="font-bold text-slate-900">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {g.nama}
                        {g.waliKelas.length > 0 && (
                          <span className="chip bg-violet-100 text-violet-700">
                            Wali Kelas {g.waliKelas.map((k) => k.nama).join(", ")}
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      {g.kode ? (
                        <span className="chip bg-slate-900 text-white">{g.kode}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </Td>
                    <Td>
                      <span className={`chip ${JENIS_GURU_BADGE[g.jenisGuru]}`}>{JENIS_GURU_LABEL[g.jenisGuru]}</span>
                    </Td>
                    <Td>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        {g.nip ? <span className="truncate text-slate-700">{g.nip}</span> : null}
                        {g.telepon ? <span className="truncate text-xs text-slate-500">{g.telepon}</span> : null}
                        {!g.nip && !g.telepon && <span className="text-slate-300">—</span>}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex max-w-[220px] flex-wrap gap-1">
                        {g.mapelDiampu.length === 0 && <span className="text-slate-400">—</span>}
                        {g.mapelDiampu.map((m) => (
                          <span key={m.id} className="chip bg-emerald-50 text-emerald-700">{m.nama}</span>
                        ))}
                      </div>
                    </Td>
                    <Td>{g.status ? <span className="chip bg-emerald-100 text-emerald-700">Aktif</span> : <span className="chip bg-slate-200 text-slate-500">Nonaktif</span>}</Td>
                    <Td>
                      {g.user ? (
                        <div className="flex flex-col gap-1">
                          <span className={`chip ${g.user.aktif ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                            {g.user.aktif ? "Aktif" : "Nonaktif"}
                          </span>
                          <span className="text-xs text-slate-500">@{g.user.username} · {ROLE_LABEL[g.user.role]}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">Belum ada akun</span>
                      )}
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-2">
                        {!g.user ? (
                          <Link href={`/admin/users?guru=${g.id}`} className="btn-ghost btn-sm !px-2.5 text-emerald-700">Buat Akun</Link>
                        ) : (
                          <Link href={`/admin/users?edit=${g.user.id}`} className="btn-ghost btn-sm !px-2.5 text-blue-700">Kelola Akun</Link>
                        )}
                        <Link href={`/admin/guru?edit=${g.id}`} className="btn-ghost btn-sm !px-2.5 text-emerald-700">Ubah</Link>
                        {g.deletedAt ? (
                          <form action={formPulihkanGuru}>
                            <input type="hidden" name="id" value={g.id} />
                            <button className="btn-ghost btn-sm !px-2.5 text-emerald-600">Pulihkan</button>
                          </form>
                        ) : (
                          <TombolHapus action={formHapusGuru} id={g.id} pesan="Nonaktifkan guru ini? (soft delete, bisa dipulihkan)" />
                        )}
                      </div>
                    </Td>
                  </TableRow>
                ))}
              </tbody>
            </TableShell>
          )}
        </>
      )}
    </div>
  );
}