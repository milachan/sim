import Link from "next/link";
import { NotebookPen, Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, ErrorBanner, PageHeader, SuksesBanner, TableRow, TableShell, Td, Th } from "@/components/ui";
import { formHapusMapel, formMapel } from "@/lib/actions/admin-forms";
import { TombolHapus } from "@/components/tombol-hapus";

export const dynamic = "force-dynamic";

export default async function AdminMapelPage({ searchParams }: { searchParams: { sukses?: string; error?: string; edit?: string } }) {
  await getCurrentUser();
  const mapels = await prisma.mataPelajaran.findMany({ include: { _count: { select: { jadwal: true, guru: true } } }, orderBy: { nama: "asc" } });
  const edit = searchParams.edit ? mapels.find((m) => m.id === searchParams.edit) : null;

  return (
    <div className="fade-up">
      <PageHeader title="Mata Pelajaran" subtitle={`${mapels.length} mapel`} icon={<NotebookPen className="h-6 w-6" />} />
      <SuksesBanner message={searchParams.sukses} />
      <ErrorBanner message={searchParams.error} />

      <Card className="card-pad mb-6">
        <h3 className="mb-4 flex items-center gap-2 font-extrabold text-slate-900">
          <Plus className="h-4 w-4 text-emerald-600" /> {edit ? `Ubah: ${edit.nama}` : "Tambah Mata Pelajaran"}
        </h3>
        <form action={formMapel} className="grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="id" value={edit?.id ?? ""} />
          <div className="sm:col-span-2">
            <label className="label">Nama *</label>
            <input className="input" name="nama" defaultValue={edit?.nama ?? ""} required />
          </div>
          <div>
            <label className="label">Kode</label>
            <input className="input" name="kode" defaultValue={edit?.kode ?? ""} placeholder="mis. INF" />
          </div>
          <div className="sm:col-span-3">
            <button className="btn-primary">Simpan</button>
            {edit && <Link href="/admin/mapel" className="btn-ghost ml-2">Batal</Link>}
          </div>
        </form>
      </Card>

      <TableShell>
        <thead>
          <tr>
            <Th>Nama</Th>
            <Th>Kode</Th>
            <Th>Jadwal</Th>
            <Th>Pengampu</Th>
            <Th className="text-right">Aksi</Th>
          </tr>
        </thead>
        <tbody>
          {mapels.map((m) => (
            <TableRow key={m.id}>
              <Td className="font-bold text-slate-900">{m.nama}</Td>
              <Td className="chip bg-slate-100 text-slate-600">{m.kode ?? "-"}</Td>
              <Td>{m._count.jadwal} slot</Td>
              <Td>{m._count.guru} guru</Td>
              <Td className="text-right">
                <div className="flex justify-end gap-2">
                  <Link href={`/admin/mapel?edit=${m.id}`} className="btn-ghost btn-sm !px-2.5 text-emerald-700">Ubah</Link>
                  <TombolHapus action={formHapusMapel} id={m.id} pesan="Hapus mapel ini? (hanya jika tidak dipakai jadwal)" />
                </div>
              </Td>
            </TableRow>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
}
