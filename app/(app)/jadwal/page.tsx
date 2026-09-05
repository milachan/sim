import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarDays, ChevronRight, GraduationCap, Users } from "lucide-react";
import { addDays, format, isSameDay } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { cariSemesterAktif } from "@/lib/semester";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { SelectNavigasi } from "@/components/select-navigasi";
import { apakahJamUpacara, HARI, HARI_LABEL } from "@/lib/constants";
import { rentangJamCerdas } from "@/lib/jam-utils";
import { UpacaraBadge } from "@/components/status-badge";
import { MatriksJadwal, type BarisMatriksJadwal } from "@/components/jadwal/matriks-jadwal";
import { cn, mulaiHari } from "@/lib/utils";
import { hariDariTanggal } from "@/lib/absensi-harian";

export const dynamic = "force-dynamic";

export default async function JadwalPage({
  searchParams,
}: {
  searchParams: { guru?: string; kelas?: string; mapel?: string; tampilan?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isGuru = user.role === "GURU";
  const pengajar = isGuru || (user.role === "WAKA" && !!user.guruId);
  const semesterAktif = await cariSemesterAktif();

  const [guruList, kelasList, mapelList] = await Promise.all([
    prisma.guru.findMany({ where: { status: true, deletedAt: null }, orderBy: { nama: "asc" } }),
    prisma.kelas.findMany({ orderBy: [{ tingkat: "asc" }, { nama: "asc" }] }),
    prisma.mataPelajaran.findMany({ orderBy: { nama: "asc" } }),
  ]);

  // ================= TAMPILAN GURU (jadwal sendiri, per hari) =================
  if (pengajar) {
    const jadwal = await prisma.jadwal.findMany({
      where: { semesterId: semesterAktif?.id, guruId: user.guruId ?? undefined },
      include: { guru: true, kelas: true, mapel: true, _count: { select: { pertemuan: true } } },
      orderBy: [{ hari: "asc" }, { jamKeMulai: "asc" }],
    });

    const hariIni = mulaiHari();
    // Indeks Senin=0..Sabtu=5 untuk offset tanggal tiap hari pada minggu berjalan.
    // Minggu (null) tetap dipetakan agar daftar Senin–Sabtu berikutnya tampil.
    const hariHariIni = hariDariTanggal(new Date());
    const hariIniIndex = hariHariIni ? HARI.indexOf(hariHariIni) : 6; // Senin=0, Minggu=6 (minggu berikutnya)

    // Rentang waktu tiap jadwal diambil dari DB (pengaturan jam pelajaran) dengan
    // fallback template — sekali untuk seluruh daftar, bukan per baris saat render.
    const jadwalDenganRentang = await Promise.all(
      jadwal.map(async (j) => ({
        ...j,
        rentang: (await rentangJamCerdas(j.hari, j.jamKeMulai, j.jamKeSelesai)) ?? `jam ke-${j.jamKeMulai}`,
      }))
    );

    const byHari = HARI.map((h) => ({
      hari: h,
      list: jadwalDenganRentang.filter((j) => j.hari === h),
      tanggal: addDays(hariIni, (HARI.indexOf(h) - hariIniIndex + 7) % 7),
    }));

    const labelHariIni = hariHariIni ? HARI_LABEL[hariHariIni] : "Minggu";

    return (
      <div className="fade-up">
        <PageHeader
          title="Jadwal Saya"
          subtitle={`Jadwal mengajar semester ${semesterAktif?.nama ?? "-"} ${semesterAktif?.tahunAjaran.nama ?? ""} · ${labelHariIni}`}
          icon={<CalendarDays className="h-6 w-6" />}
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {byHari.map(({ hari, list, tanggal }) => {
            const isHariIni = isSameDay(tanggal, hariIni);
            return (
              <Card key={hari} className={cn("overflow-hidden", isHariIni && "ring-2 ring-emerald-500/60")}>
                <div
                  className={cn(
                    "flex items-center justify-between px-4 py-3",
                    isHariIni ? "bg-emerald-600 text-white" : "bg-slate-50 text-slate-700"
                  )}
                >
                  <p className="font-extrabold">{HARI_LABEL[hari]}</p>
                  <div className="text-right">
                    <p className={cn("text-xs font-bold", isHariIni ? "text-emerald-100" : "text-slate-500")}>
                      {format(tanggal, "d MMM yyyy", { locale: localeId })}
                    </p>
                    {isHariIni && <p className="text-[10px] font-semibold text-emerald-100/80">● Hari ini</p>}
                  </div>
                </div>

                {list.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-slate-400">Tidak ada jadwal</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {list.map((j) => (
                      <Link key={j.id} href={`/jadwal/${j.id}`} className="group flex items-center gap-3 px-4 py-3 transition hover:bg-emerald-50/60">
                        <div className="flex h-10 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-emerald-50 font-bold text-emerald-700 ring-1 ring-inset ring-emerald-100">
                          <span className="text-[10px] leading-none">{j.jamKeMulai}</span>
                          <span className="text-[10px] leading-none text-slate-400">–</span>
                          <span className="text-[10px] leading-none">{j.jamKeSelesai}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2">
                            <span className="truncate text-sm font-bold text-slate-900 group-hover:text-emerald-700">{j.mapel.nama}</span>
                            {apakahJamUpacara(j.hari, j.jamKeMulai) && <UpacaraBadge />}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {j.kelas.nama}
                            {` · ${j.rentang}`}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-emerald-500" />
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        {jadwal.length === 0 && (
          <div className="mt-6">
            <EmptyState
              title="Belum ada jadwal mengajar"
              desc="Hubungi admin akademik bila jadwal Anda belum tercatat."
            />
          </div>
        )}
      </div>
    );
  }

  // ================= TAMPILAN ADMIN / WAKA / KAMAD =================
  // Dengan puluhan guru & kelas, tampilkan jadwal per guru ATAU per kelas
  // (matriks mingguan) — bukan ratusan baris sekaligus.
  const tampilan = searchParams.tampilan === "kelas" ? "kelas" : "guru";
  const guruTerpilih = tampilan === "guru" ? searchParams.guru ?? "" : "";
  const kelasTerpilih = tampilan === "kelas" ? searchParams.kelas ?? "" : "";
  const mapelTerpilih = searchParams.mapel ?? "";

  const guruObj = tampilan === "guru" ? guruList.find((g) => g.id === guruTerpilih) : undefined;
  const kelasObj = tampilan === "kelas" ? kelasList.find((k) => k.id === kelasTerpilih) : undefined;

  const whereJ: Record<string, unknown> = { semesterId: semesterAktif?.id };
  if (guruTerpilih) whereJ.guruId = guruTerpilih;
  if (kelasTerpilih) whereJ.kelasId = kelasTerpilih;
  if (mapelTerpilih) whereJ.mapelId = mapelTerpilih;
  const jadwalMatriks = await prisma.jadwal.findMany({
    where: whereJ,
    include: { guru: true, kelas: true, mapel: true },
    orderBy: [{ hari: "asc" }, { jamKeMulai: "asc" }],
  });

  const itemsMatriks: BarisMatriksJadwal[] = jadwalMatriks.map((j) => ({
    id: j.id,
    hari: j.hari,
    jamKeMulai: j.jamKeMulai,
    jamKeSelesai: j.jamKeSelesai,
    mapel: j.mapel.nama,
    kelas: j.kelas.nama,
    guru: j.guru.nama,
  }));

  const judulMatriks = tampilan === "guru"
    ? (guruObj ? `Jadwal ${guruObj.nama.split(",")[0]}` : "Jadwal Guru")
    : (kelasObj ? `Jadwal Kelas ${kelasObj.nama}` : "Jadwal Kelas");

  // Query filter yang dibawa ke halaman detail — diteruskan kembali lewat tombol
  // "Kembali" agar filter tidak hilang setelah melihat detail jadwal.
  const linkQuery = [
    `tampilan=${tampilan}`,
    guruTerpilih ? `guru=${encodeURIComponent(guruTerpilih)}` : "",
    kelasTerpilih ? `kelas=${encodeURIComponent(kelasTerpilih)}` : "",
    mapelTerpilih ? `mapel=${encodeURIComponent(mapelTerpilih)}` : "",
  ]
    .filter(Boolean)
    .join("&");

  const hrefTab = (mode: "guru" | "kelas") => {
    const params = new URLSearchParams({ tampilan: mode });
    if (mode === "guru" && guruTerpilih) params.set("guru", guruTerpilih);
    if (mode === "kelas" && kelasTerpilih) params.set("kelas", kelasTerpilih);
    if (mapelTerpilih) params.set("mapel", mapelTerpilih);
    return `/jadwal?${params.toString()}`;
  };

  return (
    <div className="fade-up">
      <PageHeader title="Jadwal Pelajaran" icon={<CalendarDays className="h-6 w-6" />} />

      {/* Tab Per Guru / Per Kelas */}
      <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
        <Link
          href={hrefTab("guru")}
          className={cn(
            "flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition",
            tampilan === "guru" ? "bg-emerald-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
          )}
        >
          <Users className="h-4 w-4" /> Per Guru
        </Link>
        <Link
          href={hrefTab("kelas")}
          className={cn(
            "flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition",
            tampilan === "kelas" ? "bg-emerald-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
          )}
        >
          <GraduationCap className="h-4 w-4" /> Per Kelas
        </Link>
      </div>

      {/* Filter pilih guru / kelas + mapel */}
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        {tampilan === "guru" ? (
          <div className="min-w-0 flex-1">
            <label className="label">Guru</label>
            <SelectNavigasi
              param="guru"
              value={guruTerpilih}
              options={[{ value: "", label: "— pilih guru —" }, ...guruList.map((g) => ({ value: g.id, label: g.nama }))]}
            />
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <label className="label">Kelas</label>
            <SelectNavigasi
              param="kelas"
              value={kelasTerpilih}
              options={[{ value: "", label: "— pilih kelas —" }, ...kelasList.map((k) => ({ value: k.id, label: k.nama }))]}
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <label className="label">Mata Pelajaran</label>
          <SelectNavigasi
            param="mapel"
            value={mapelTerpilih}
            options={[{ value: "", label: "— semua mapel —" }, ...mapelList.map((m) => ({ value: m.id, label: m.nama }))]}
          />
        </div>
        <div className="min-w-0 flex-1">
          <label className="label">Periode</label>
          <div className="input flex min-w-0 items-center gap-2 !py-0 text-sm font-semibold text-slate-600">
            <CalendarDays className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="min-w-0 truncate">{semesterAktif ? `${semesterAktif.nama} ${semesterAktif.tahunAjaran.nama}` : "—"}</span>
          </div>
        </div>
      </div>

      {!guruObj && !kelasObj ? (
        <EmptyState
          title={tampilan === "guru" ? "Pilih guru untuk melihat jadwalnya" : "Pilih kelas untuk melihat jadwalnya"}
          desc="Ditampilkan sebagai matriks mingguan hari × jam pelajaran."
        />
      ) : jadwalMatriks.length === 0 ? (
        <EmptyState
          title="Tidak ada jadwal"
          desc="Belum ada jadwal untuk pilihan ini pada periode tersebut."
        />
      ) : (
        <Card className="card-pad">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-extrabold text-slate-900">{judulMatriks}</h2>
            <span className="chip bg-emerald-50 text-emerald-700">{jadwalMatriks.length} jadwal · klik sel untuk detail</span>
          </div>
          <MatriksJadwal items={itemsMatriks} mode={tampilan} linkQuery={linkQuery} />
          <p className="mt-4 text-xs text-slate-400">
            Matriks satu minggu pelajaran ({semesterAktif?.nama ?? "-"} {semesterAktif?.tahunAjaran.nama ?? ""}).
          </p>
        </Card>
      )}
    </div>
  );
}
