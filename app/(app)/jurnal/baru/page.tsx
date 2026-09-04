import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { AlarmClock, BookOpen, Clock, GraduationCap, HelpCircle, NotebookPen, UserCheck } from "lucide-react";
import FormJurnalManual from "@/components/jurnal/form-jurnal-manual";

export const dynamic = "force-dynamic";

export default async function JurnalBaruPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Jurnal manual memakai guard wajibKelola (GURU/WAKA/ADMIN/SUPERADMIN) —
  // role pemantauan (Waka tanpa guruId / Kamad) diarahkan ke beranda masing-masing.
  if (!["GURU", "WAKA", "ADMIN", "SUPERADMIN"].includes(user.role)) redirect("/");
  if (user.role === "WAKA" && !user.guruId) redirect("/waka");

  const [kelasList, mapelList] = await Promise.all([
    prisma.kelas.findMany({ orderBy: [{ tingkat: "asc" }, { nama: "asc" }] }),
    user.guruId
      ? prisma.mataPelajaran.findMany({
          where: { guru: { some: { id: user.guruId } } },
          orderBy: { nama: "asc" },
        })
      : prisma.mataPelajaran.findMany({ orderBy: { nama: "asc" } }),
  ]);

  return (
    <div className="fade-up">
      <PageHeader
        title="Jurnal Manual"
        subtitle="Pembelajaran yang tidak terjadwal — wajib mencantumkan alasan"
        icon={<NotebookPen className="h-6 w-6" />}
      />

      {/* Penjelasan singkat kapan perlu jurnal manual */}
      <Card className="card-pad mb-5">
        <h3 className="flex items-center gap-2 font-extrabold text-slate-900">
          <HelpCircle className="h-5 w-5 text-sky-600" /> Kapan perlu pakai Jurnal Manual?
        </h3>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {[
            { icon: UserCheck, label: "Guru pengganti", desc: "Menggantikan guru yang berhalangan hadir" },
            { icon: AlarmClock, label: "Jadwal mendadak", desc: "Penambahan jam, les, atau kegiatan mendadak" },
            { icon: GraduationCap, label: "Remedial / pengayaan", desc: "Pembelajaran tambahan di luar jam pelajaran" },
            { icon: Clock, label: "Mengisi jam kosong", desc: "Menggantikan jam yang ditinggal guru lain" },
          ].map((k) => (
            <li key={k.label} className="flex items-start gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-inset ring-slate-100">
              <k.icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                <b className="text-slate-800">{k.label}</b>
                <span className="block text-xs text-slate-500">{k.desc}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-sky-50 px-3.5 py-2.5 text-xs font-semibold text-sky-800 ring-1 ring-inset ring-sky-100">
          <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-500" />
          Sudah ada di jadwal? Cukup buka lewat <b>&nbsp;Jadwal Saya&nbsp;</b> — tidak perlu Jurnal Manual.
        </p>
      </Card>

      <FormJurnalManual kelasList={kelasList.map((k) => ({ id: k.id, nama: k.nama }))} mapelList={mapelList.map((m) => ({ id: m.id, nama: m.nama }))} />
    </div>
  );
}
