import Link from "next/link";
import { Plus, Search, User } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, ErrorBanner, PageHeader, SuksesBanner, TableRow, TableShell, Td, Th } from "@/components/ui";
import { formHapusSiswa, formPulihkanSiswa, formSiswa } from "@/lib/actions/admin-forms";
import { TombolHapus } from "@/components/tombol-hapus";
import { JENIS_KELAMIN_LABEL, STATUS_SISWA_LABEL } from "@/lib/constants";
import type { StatusSiswa } from "@prisma/client";

export const dynamic = "force-dynamic";

const STATUS_FILTER: (StatusSiswa | "")[] = ["", "AKTIF", "ALUMNI", "KELUAR"];

export default async function AdminSiswaPage({
  searchParams,
}: {
  searchParams: { sukses?: string; error?: string; edit?: string; kelas?: string; status?: string; q?: string };
}) {
  await getCurrentUser();
  const kelas = searchParams.kelas ?? "";
  const status = (STATUS_FILTER as string[]).includes(searchParams.status ?? "") ? (searchParams.status as StatusSiswa | "") : "";
  const q = (searchParams.q ?? "").trim().slice(0, 80);

  const [kelasList, siswa] = await Promise.all([
    prisma.kelas.findMany({ orderBy: [{ tingkat: "asc" }, { nama: "asc" }] }),
    prisma.siswa.findMany({
      where: {
        ...(kelas ? { kelasId: kelas } : {}),
        ...(status ? { status } : {}),
        ...(q
          ? {
              OR: [
                { nama: { contains: q } },
                { nis: { contains: q } },
                { nisn: { contains: q } },
              ],
            }
          : {}),
      },
      include: { kelas: { include: { waliKelas: true } } },
      orderBy: [{ deletedAt: "asc" }, { nama: "asc" }],
    }),
  ]);
  const edit = searchParams.edit ? siswa.find((s) => s.id === searchParams.edit) : null;

  // Bantu menyusun tautan filter dengan mempertahankan param lain
  const hrefFilter = (ubah: { kelas?: string; status?: string; q?: string }) => {
    const p = new URLSearchParams();
    const gabung = { kelas, status, q, ...ubah };
    if (gabung.kelas) p.set("kelas", gabung.kelas);
    if (gabung.status) p.set("status", gabung.status);
    if (gabung.q) p.set("q", gabung.q);
    const s = p.toString();
    return `/admin/siswa${s ? `?${s}` : ""}`;
  };

  const namaKelasFilter = kelasList.find((k) => k.id === kelas)?.nama ?? "semua kelas";

  return (
    <div className="fade-up">
      <PageHeader
        title="Data Siswa"
        subtitle={`${siswa.length} siswa${kelas ? ` · kelas ${namaKelasFilter}` : ""}${status ? ` · ${STATUS_SISWA_LABEL[status]}` : ""}${q ? ` · cari "${q}"` : ""}`}
        icon={<User className="h-6 w-6" />}
      />

      {/* Filter: kelas (chip) + status + pencarian */}
      <div className="mb-5 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <Link href={hrefFilter({ kelas: "" })} className={`chip ${!kelas ? "bg-emerald-600 text-white" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200"}`}>
            Semua kelas
          </Link>
          {kelasList.map((k) => (
            <Link key={k.id} href={hrefFilter({ kelas: k.id })} className={`chip ${kelas === k.id ? "bg-emerald-600 text-white" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200"}`}>
              {k.nama}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTER.map((s) => (
              <Link
                key={s || "semua"}
                href={hrefFilter({ status: s })}
                className={`chip ${status === s ? "bg-emerald-600 text-white" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200"}`}
              >
                {s ? STATUS_SISWA_LABEL[s] : "Semua status"}
              </Link>
            ))}
          </div>
          <form action="/admin/siswa" method="GET" className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-sm">
            <input type="hidden" name="kelas" value={kelas} />
            <input type="hidden" name="status" value={status} />
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input !pl-9"
                name="q"
                defaultValue={q}
                placeholder="Cari nama / NISN / NIS…"
                aria-label="Cari siswa"
              />
            </div>
            <button className="btn-secondary btn-sm" type="submit">Cari</button>
            {q && (
              <Link href={hrefFilter({ q: "" })} className="btn-ghost btn-sm">Reset</Link>
            )}
          </form>
        </div>
      </div>

      <SuksesBanner message={searchParams.sukses} />
      <ErrorBanner message={searchParams.error} />

      <Card className="card-pad mb-6">
        <h3 className="mb-4 flex items-center gap-2 font-extrabold text-slate-900">
          <Plus className="h-4 w-4 text-emerald-600" /> {edit ? `Ubah: ${edit.nama}` : "Tambah Siswa"}
        </h3>
        <form action={formSiswa} className="grid gap-3 sm:grid-cols-4">
          <input type="hidden" name="id" value={edit?.id ?? ""} />
          <div className="sm:col-span-2">
            <label className="label">Nama Lengkap *</label>
            <input className="input" name="nama" defaultValue={edit?.nama ?? ""} required />
          </div>
          <div>
            <label className="label">NISN</label>
            <input className="input" name="nisn" defaultValue={edit?.nisn ?? ""} maxLength={10} inputMode="numeric" placeholder="10 digit" />
          </div>
          <div>
            <label className="label">NIS</label>
            <input className="input" name="nis" defaultValue={edit?.nis ?? ""} />
          </div>
          <div>
            <label className="label">Jenis Kelamin</label>
            <select className="input" name="jenisKelamin" defaultValue={edit?.jenisKelamin ?? ""}>
              <option value="">— belum diisi —</option>
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
          </div>
          <div>
            <label className="label">Kelas</label>
            <select className="input" name="kelasId" defaultValue={edit?.kelasId ?? kelas ?? ""}>
              <option value="">— tanpa kelas —</option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.id}>{k.nama}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" name="status" defaultValue={edit?.status ?? "AKTIF"}>
              <option value="AKTIF">Aktif</option>
              <option value="ALUMNI">Alumni</option>
              <option value="KELUAR">Keluar</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <button className="btn-primary">Simpan</button>
            {edit && <Link href={hrefFilter({})} className="btn-ghost ml-2">Batal</Link>}
          </div>
        </form>
        <p className="mt-3 text-xs text-slate-400">
          NISN adalah kunci sinkron saat import Excel — harus 10 digit angka.
        </p>
      </Card>

      <TableShell>
        <thead>
          <tr>
            <Th>Nama</Th>
            <Th>NISN</Th>
            <Th>NIS</Th>
            <Th>JK</Th>
            <Th>Kelas</Th>
            <Th>Wali Kelas</Th>
            <Th>No. Wali Kelas</Th>
            <Th>Status</Th>
            <Th className="text-right">Aksi</Th>
          </tr>
        </thead>
        <tbody>
          {siswa.map((s) => (
            <TableRow key={s.id} className={s.deletedAt ? "opacity-50" : ""}>
              <Td className="font-bold text-slate-900">{s.nama}</Td>
              <Td className="font-mono text-xs">{s.nisn ?? "-"}</Td>
              <Td>{s.nis ?? "-"}</Td>
              <Td>{s.jenisKelamin ? JENIS_KELAMIN_LABEL[s.jenisKelamin] : "-"}</Td>
              <Td>{s.kelas?.nama ?? "-"}</Td>
              <Td>{s.kelas?.waliKelas?.nama ?? "-"}</Td>
              <Td className="whitespace-nowrap">{s.kelas?.waliKelas?.telepon ?? "-"}</Td>
              <Td>
                <span className={`chip ${s.status === "AKTIF" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                  {STATUS_SISWA_LABEL[s.status]}
                </span>
              </Td>
              <Td className="text-right">
                <div className="flex justify-end gap-2">
                  <Link href={`/admin/siswa?edit=${s.id}${kelas || status || q ? `&${hrefFilter({}).split("?")[1]}` : ""}`} className="btn-ghost btn-sm !px-2.5 text-emerald-700">Ubah</Link>
                  {s.deletedAt ? (
                    <form action={formPulihkanSiswa}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="btn-ghost btn-sm !px-2.5 text-emerald-600">Pulihkan</button>
                    </form>
                  ) : (
                    <TombolHapus action={formHapusSiswa} id={s.id} pesan="Nonaktifkan siswa ini? (soft delete, bisa dipulihkan)" />
                  )}
                </div>
              </Td>
            </TableRow>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
}
