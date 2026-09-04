import Link from "next/link";
import { Plus, School } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, ErrorBanner, PageHeader, SuksesBanner, TableRow, TableShell, Td, Th } from "@/components/ui";
import { formHapusKelas, formKelas } from "@/lib/actions/admin-forms";
import { TombolHapus } from "@/components/tombol-hapus";

export const dynamic = "force-dynamic";

export default async function AdminKelasPage({ searchParams }: { searchParams: { sukses?: string; error?: string; edit?: string } }) {
  await getCurrentUser();
  const [kelasList, guruList] = await Promise.all([
    prisma.kelas.findMany({ include: { waliKelas: true, _count: { select: { siswa: true, jadwal: true } } }, orderBy: [{ tingkat: "asc" }, { nama: "asc" }] }),
    prisma.guru.findMany({ where: { status: true, deletedAt: null }, orderBy: { nama: "asc" } }),
  ]);
  const edit = searchParams.edit ? kelasList.find((k) => k.id === searchParams.edit) : null;

  return (
    <div className="fade-up">
      <PageHeader title="Kelas & Rombel" subtitle={`${kelasList.length} rombel`} icon={<School className="h-6 w-6" />} />
      <SuksesBanner message={searchParams.sukses} />
      <ErrorBanner message={searchParams.error} />

      <Card className="card-pad mb-6">
        <h3 className="mb-4 flex items-center gap-2 font-extrabold text-slate-900">
          <Plus className="h-4 w-4 text-emerald-600" /> {edit ? `Ubah: ${edit.nama}` : "Tambah Kelas"}
        </h3>
        <form action={formKelas} className="grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="id" value={edit?.id ?? ""} />
          <div>
            <label className="label">Nama Kelas *</label>
            <input className="input" name="nama" defaultValue={edit?.nama ?? ""} placeholder="mis. 9A" required />
          </div>
          <div>
            <label className="label">Tingkat</label>
            <select className="input" name="tingkat" defaultValue={edit?.tingkat ?? 7}>
              <option value={7}>Kelas 7</option>
              <option value={8}>Kelas 8</option>
              <option value={9}>Kelas 9</option>
            </select>
          </div>
          <div>
            <label className="label">Wali Kelas</label>
            <select className="input" name="waliKelasId" defaultValue={edit?.waliKelasId ?? ""}>
              <option value="">— tanpa wali —</option>
              {guruList.map((g) => (
                <option key={g.id} value={g.id}>{g.nama}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <button className="btn-primary">Simpan</button>
            {edit && <Link href="/admin/kelas" className="btn-ghost ml-2">Batal</Link>}
          </div>
        </form>
      </Card>

      <TableShell>
        <thead>
          <tr>
            <Th>Kelas</Th>
            <Th>Tingkat</Th>
            <Th>Wali Kelas</Th>
            <Th>Siswa</Th>
            <Th>Jadwal</Th>
            <Th className="text-right">Aksi</Th>
          </tr>
        </thead>
        <tbody>
          {kelasList.map((k) => (
            <TableRow key={k.id}>
              <Td className="font-extrabold text-slate-900">{k.nama}</Td>
              <Td>Kelas {k.tingkat}</Td>
              <Td>{k.waliKelas?.nama ?? "-"}</Td>
              <Td>{k._count.siswa} siswa</Td>
              <Td>{k._count.jadwal} slot</Td>
              <Td className="text-right">
                <div className="flex justify-end gap-2">
                  <Link href={`/admin/kelas?edit=${k.id}`} className="btn-ghost btn-sm !px-2.5 text-emerald-700">Ubah</Link>
                  <TombolHapus action={formHapusKelas} id={k.id} pesan="Hapus kelas ini? (hanya bisa jika kosong)" />
                </div>
              </Td>
            </TableRow>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
}
