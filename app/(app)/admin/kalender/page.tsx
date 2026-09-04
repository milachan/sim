import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, ErrorBanner, PageHeader, SuksesBanner, TableRow, TableShell, Td, Th } from "@/components/ui";
import { formHapusKalender, formKalender } from "@/lib/actions/admin-forms";
import { TombolHapus } from "@/components/tombol-hapus";
import { formatTanggal } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TIPE_WARNA: Record<string, string> = {
  KEGIATAN: "bg-emerald-100 text-emerald-700",
  LIBUR: "bg-rose-100 text-rose-700",
  UJIAN: "bg-violet-100 text-violet-700",
};

export default async function AdminKalenderPage({ searchParams }: { searchParams: { sukses?: string; error?: string; edit?: string } }) {
  await getCurrentUser();
  const [kalender, tahunAjaran] = await Promise.all([
    prisma.kalenderAkademik.findMany({ include: { tahunAjaran: true }, orderBy: { tanggal: "desc" } }),
    prisma.tahunAjaran.findMany({ orderBy: { nama: "desc" } }),
  ]);
  const edit = searchParams.edit ? kalender.find((k) => k.id === searchParams.edit) : null;
  const taAktif = tahunAjaran.find((t) => t.aktif) ?? tahunAjaran[0];

  return (
    <div className="fade-up">
      <PageHeader title="Kalender Akademik" subtitle={`${kalender.length} agenda tercatat`} icon={<CalendarDays className="h-6 w-6" />} />
      <SuksesBanner message={searchParams.sukses} />
      <ErrorBanner message={searchParams.error} />

      <Card className="card-pad mb-6">
        <h3 className="mb-4 flex items-center gap-2 font-extrabold text-slate-900">
          <Plus className="h-4 w-4 text-emerald-600" /> {edit ? "Ubah Agenda" : "Tambah Agenda"}
        </h3>
        <form action={formKalender} className="grid gap-3 sm:grid-cols-4">
          <input type="hidden" name="id" value={edit?.id ?? ""} />
          <div>
            <label className="label">Tanggal *</label>
            <input type="date" className="input" name="tanggal" defaultValue={edit?.tanggal.toISOString().slice(0, 10) ?? ""} required />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Keterangan *</label>
            <input className="input" name="keterangan" defaultValue={edit?.keterangan ?? ""} required />
          </div>
          <div>
            <label className="label">Tipe</label>
            <select className="input" name="tipe" defaultValue={edit?.tipe ?? "KEGIATAN"}>
              <option value="KEGIATAN">Kegiatan</option>
              <option value="LIBUR">Libur</option>
              <option value="UJIAN">Ujian</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className="label">Tahun Ajaran</label>
            <select className="input" name="tahunAjaranId" defaultValue={edit?.tahunAjaranId ?? taAktif?.id ?? ""}>
              {tahunAjaran.map((t) => (
                <option key={t.id} value={t.id}>{t.nama}{t.aktif ? " (aktif)" : ""}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-4">
            <button className="btn-primary">Simpan</button>
            {edit && <Link href="/admin/kalender" className="btn-ghost ml-2">Batal</Link>}
          </div>
        </form>
      </Card>

      <TableShell>
        <thead>
          <tr>
            <Th>Tanggal</Th>
            <Th>Keterangan</Th>
            <Th>Tipe</Th>
            <Th>Tahun Ajaran</Th>
            <Th className="text-right">Aksi</Th>
          </tr>
        </thead>
        <tbody>
          {kalender.map((k) => (
            <TableRow key={k.id}>
              <Td className="font-bold text-slate-900">{formatTanggal(k.tanggal, "EEE, d MMM yyyy")}</Td>
              <Td>{k.keterangan}</Td>
              <Td><span className={`chip ${TIPE_WARNA[k.tipe] ?? "bg-slate-100 text-slate-600"}`}>{k.tipe}</span></Td>
              <Td>{k.tahunAjaran?.nama ?? "-"}</Td>
              <Td className="text-right">
                <div className="flex justify-end gap-2">
                  <Link href={`/admin/kalender?edit=${k.id}`} className="btn-ghost btn-sm !px-2.5 text-emerald-700">Ubah</Link>
                  <TombolHapus action={formHapusKalender} id={k.id} pesan="Hapus agenda ini?" />
                </div>
              </Td>
            </TableRow>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
}
