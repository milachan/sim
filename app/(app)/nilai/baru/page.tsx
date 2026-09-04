import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { GraduationCap } from "lucide-react";
import FormKegiatanBaru from "@/components/nilai/form-kegiatan-baru";
import { cariSemesterAktif } from "@/lib/semester";

export const dynamic = "force-dynamic";

export default async function NilaiBaruPage({ searchParams }: { searchParams: { jadwal?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Membuat kegiatan penilaian memakai guard wajibKelola (GURU/WAKA/ADMIN/SUPERADMIN) —
  // role pemantauan (Waka tanpa guruId / Kamad) diarahkan ke beranda masing-masing.
  if (!["GURU", "WAKA", "ADMIN", "SUPERADMIN"].includes(user.role)) redirect("/");
  if (user.role === "WAKA" && !user.guruId) redirect("/waka");

  const isGuru = user.role === "GURU" || (user.role === "WAKA" && !!user.guruId);

  // Sinkronkan semester aktif bila ada pergantian otomatis berdasarkan tanggal
  await cariSemesterAktif();

  const jadwal = await prisma.jadwal.findMany({
    where: { semester: { aktif: true }, ...(isGuru && user.guruId ? { guruId: user.guruId } : {}) },
    include: { kelas: true, mapel: true },
    orderBy: [{ hari: "asc" }, { jamKeMulai: "asc" }],
  });

  return (
    <div className="fade-up">
      <PageHeader
        title="Buat Kegiatan Penilaian"
        subtitle="Tugas, kuis, ulangan harian, praktik, proyek, dan lainnya — terhubung ke jadwal"
        icon={<GraduationCap className="h-6 w-6" />}
      />
      <FormKegiatanBaru
        jadwalList={jadwal.map((j) => ({
          id: j.id,
          label: `${j.mapel.nama} — ${j.kelas.nama} · ${j.hari} jam ke-${j.jamKeMulai}`,
        }))}
        jadwalAwal={searchParams.jadwal ?? ""}
      />
    </div>
  );
}
