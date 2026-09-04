import { FileSpreadsheet } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { ImportPanel } from "@/components/admin/import-panel";
import { GuruImport } from "@/components/admin/guru-import";

export const dynamic = "force-dynamic";

export default async function AdminImportPage() {
  await getCurrentUser();
  // Daftar periode untuk dipilih sebagai tujuan jadwal yang diupload.
  const tahunAjaran = await prisma.tahunAjaran.findMany({
    include: {
      semester: {
        where: { deletedAt: null },
        include: { _count: { select: { jadwal: true } } },
        orderBy: [{ aktif: "desc" }, { nama: "asc" }],
      },
    },
    orderBy: [{ aktif: "desc" }, { nama: "desc" }],
  });

  return (
    <div className="fade-up">
      <PageHeader
        title="Import Data dari Excel"
        subtitle="Input massal data guru, siswa & jadwal pelajaran — hemat waktu awal tahun ajaran"
        icon={<FileSpreadsheet className="h-6 w-6" />}
      />

      <nav className="mb-5 flex flex-wrap gap-2">
        <a href="#import-guru" className="chip bg-slate-900 text-white transition hover:bg-slate-700">
          1 · Data Guru (guru + akun)
        </a>
        <a href="#import-siswa-jadwal" className="chip bg-slate-900 text-white transition hover:bg-slate-700">
          2 · Siswa &amp; Jadwal Pelajaran
        </a>
      </nav>

      <section id="import-guru" className="scroll-mt-24">
        <h2 className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-slate-400">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white">1</span>
          Data Guru &amp; Akun — template 9 kolom NAMA s/d WAJIB GANTI PASSWORD
        </h2>
        <GuruImport />
      </section>

      <section id="import-siswa-jadwal" className="scroll-mt-24">
        <h2 className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-slate-400">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] text-white">2</span>
          Siswa &amp; Jadwal Pelajaran
        </h2>
        <ImportPanel
          tahunAjaran={tahunAjaran.map((t) => ({
          id: t.id,
          nama: t.nama,
          aktif: t.aktif,
          semester: t.semester.map((s) => ({
            id: s.id,
            nama: s.nama,
            aktif: s.aktif,
            mulai: s.mulai ? s.mulai.toISOString().slice(0, 10) : null,
            selesai: s.selesai ? s.selesai.toISOString().slice(0, 10) : null,
            _count: { jadwal: s._count.jadwal },
          })),
        }))}
        />
      </section>
    </div>
  );
}
