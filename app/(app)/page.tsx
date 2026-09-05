import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, BarChart3, ClipboardCheck, PenLine, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, EmptyState, PageHeader, SuksesBanner } from "@/components/ui";
import { sinkronkanPertemuan } from "@/lib/pertemuan";
import { formatTanggalPanjang, mulaiHari } from "@/lib/utils";
import { detailKelengkapanAbsensiHarian, hariDariTanggal } from "@/lib/absensi-harian";
import {
  jamKeBerjalan,
  jamPembukaHari,
  STATUS_ABSENSI_HARIAN_BADGE,
  STATUS_ABSENSI_HARIAN_LABEL,
  type StatusAbsensiHarian,
} from "@/lib/constants";
import { rentangJamCerdas } from "@/lib/jam-utils";
import { cariSemesterAktif } from "@/lib/semester";
import InfoWaktu from "@/components/info-waktu";
import JadwalHariIniBeranda, { type ItemJadwalBeranda } from "@/components/jadwal-hari-ini-beranda";
import PerluDilengkapiBeranda, { type GrupPerluBeranda } from "@/components/perlu-dilengkapi-beranda";
import TourPertama from "@/components/tour-pertama";

export const dynamic = "force-dynamic";

export default async function Beranda({ searchParams }: { searchParams: { sukses?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Halaman ini khusus guru — role lain punya beranda masing-masing
  if (user.role === "ADMIN" || user.role === "SUPERADMIN") redirect("/admin");
  if (user.role === "WAKA") redirect("/waka");
  if (user.role === "KEPALA") redirect("/kamad");

  // Akun khusus petugas piket: langsung ke absensi harian (menu ringkas),
  // tidak perlu halaman beranda guru yang berisi jurnal/pertemuan.
  if (user.role === "GURU" && user.guru?.jenisGuru === "PIKET" && user.guru?.kode === "PIKET") {
    redirect("/absensi-harian");
  }

  const guruId = user.guruId!;
  const hariIni = mulaiHari();

  // Sinkronkan semester aktif bila ada pergantian otomatis berdasarkan tanggal
  await cariSemesterAktif();

  // Pastikan pertemuan hari ini ada (fallback bilamana cron sinkronisasi belum
  // sempat berjalan). Ragam sinkronisasi ini juga menangani backfill hari yang
  // terlewat dengan aman (idempoten), jadi boleh dipanggil setiap render halaman.
  await sinkronkanPertemuan({ guruId, sampai: hariIni });

  // Hari jadwal hari ini (Minggu → null): hanya untuk blok absensi harian kelas.
  const hariHariIni = hariDariTanggal(new Date());

  const [pertemuanHariIni, belumLengkap] = await Promise.all([
    prisma.pertemuan.findMany({
      where: { jadwal: { guruId }, tanggal: hariIni },
      include: { jadwal: { include: { kelas: true, mapel: true } } },
      orderBy: { jadwal: { jamKeMulai: "asc" } },
    }),
    // Ambil cukup banyak agar bisa dikelompokkan sampai 7 tanggal terbaru.
    prisma.pertemuan.findMany({
      where: { jadwal: { guruId }, tanggal: { lt: hariIni }, status: { notIn: ["LENGKAP", "TIDAK_TERLAKSANA"] } },
      include: { jadwal: { include: { kelas: true, mapel: true } } },
      orderBy: { tanggal: "desc" },
      take: 60,
    }),
    prisma.pertemuan.count({
      where: { jadwal: { guruId }, tanggal: { lt: hariIni }, jurnal: null, status: { not: "TIDAK_TERLAKSANA" } },
    }),
  ]);

  // Absensi harian kelas: kelas di mana guru ini memegang jadwal pada JAM PEMBUKA
  // hari (jam ke-1; Senin jam ke-2 karena upacara). Kelas yang hari itu baru mulai
  // dari jam ke-3 dst. tidak punya guru jam pertama — dikelola piket/wali sebagai backup.
  // Minggu (null) → tidak ada jadwal berjalan, tidak ada kelas guru jam pertama.
  const [jadwalSemuaHariIni, absensiHarianHariIni] = hariHariIni
    ? await Promise.all([
        prisma.jadwal.findMany({
          where: { hari: hariHariIni, jamKeMulai: jamPembukaHari(hariHariIni), semester: { aktif: true } },
          include: { kelas: true, mapel: true },
          orderBy: [{ id: "asc" }],
        }),
        prisma.absensiHarian.findMany({ where: { tanggal: hariIni }, include: { pengisi: true } }),
      ])
    : [[], []];
  const jamPertamaPerKelas = new Map<string, (typeof jadwalSemuaHariIni)[number]>();
  for (const j of jadwalSemuaHariIni) {
    if (!jamPertamaPerKelas.has(j.kelasId)) jamPertamaPerKelas.set(j.kelasId, j);
  }
  const kelasJamPertamaSaya = [...jamPertamaPerKelas.values()].filter((j) => j.guruId === guruId);
  const ahHariIniByKelas = new Map(absensiHarianHariIni.map((a) => [a.kelasId, a]));
  const statusAbsensiKelas = (kelasId: string): StatusAbsensiHarian => {
    const rec = ahHariIniByKelas.get(kelasId);
    return rec ? rec.peranPengisi : "BELUM_DIISI";
  };

  // Gerbang jurnal: untuk kelas yang guru ini pegang jam pertamanya hari ini, bila
  // absensi harian kelas belum lengkap, baris di "Jadwal Hari Ini" harus mengarahkan
  // ke pengisian absensi kelas dulu — baru boleh masuk ke halaman pengisian jurnal.
  // Rentang waktu "Jam pertama" tiap kelas — dari DB (pengaturan jam pelajaran)
  // dengan fallback template, dihitung sekali untuk seluruh daftar.
  const rentangJamPertamaByKelas = new Map<string, string | null>(
    await Promise.all(
      kelasJamPertamaSaya.map(async (j) => [
        j.kelasId,
        await rentangJamCerdas(j.hari, j.jamKeMulai, j.jamKeSelesai),
      ] as [string, string | null])
    )
  );

  const kelasJamPertamaIds = kelasJamPertamaSaya.map((j) => j.kelasId);
  const hasilKelengkapanAbsensi = await Promise.all(
    kelasJamPertamaIds.map(async (kelasId) => ({
      kelasId,
      lengkap: (await detailKelengkapanAbsensiHarian(kelasId, hariIni)).lengkap,
    }))
  );
  const absensiJamPertamaBelumLengkap = new Set(
    hasilKelengkapanAbsensi.filter((h) => !h.lengkap).map((h) => h.kelasId)
  );

  const sapaan = (() => {
    const jam = new Date().getHours();
    if (jam < 11) return "Selamat pagi";
    if (jam < 15) return "Selamat siang";
    if (jam < 19) return "Selamat sore";
    return "Selamat malam";
  })();

  // Data polos kartu "Jadwal Hari Ini" — aman dikirim ke komponen client (live).
  const jadwalHariIniItems: ItemJadwalBeranda[] = await Promise.all(
    pertemuanHariIni.map(async (p) => {
      const jadwal = p.jadwal!;
      return {
        id: p.id,
        href: `/pertemuan/${p.id}`,
        hari: jadwal.hari,
        mapel: jadwal.mapel.nama,
        kelas: jadwal.kelas.nama,
        kelasId: jadwal.kelasId,
        jamKeMulai: jadwal.jamKeMulai,
        jamKeSelesai: jadwal.jamKeSelesai,
        rentang: (await rentangJamCerdas(jadwal.hari, jadwal.jamKeMulai, jadwal.jamKeSelesai)) ?? null,
        pertemuanKe: p.pertemuanKe,
        status: p.status,
        // Bila guru jam pertama kelas ini belum melengkapi absensi harian, baris ini
        // menjadi gerbang: klik → isi absensi kelas dulu (belum bisa ke halaman jurnal).
        wajibAbsenDulu: absensiJamPertamaBelumLengkap.has(jadwal.kelasId),
      };
    })
  );

  // Kartu "Perlu Dilengkapi" dikelompokkan per tanggal; maksimal 7 hari terbaru.
  const MAX_HARI_PERLU = 7;
  const mapPerlu = new Map<string, GrupPerluBeranda>();
  for (const p of belumLengkap) {
    const jadwal = p.jadwal!;
    const kunci = p.tanggal.toISOString().slice(0, 10);
    let grup = mapPerlu.get(kunci);
    if (!grup) {
      if (mapPerlu.size >= MAX_HARI_PERLU) continue;
      grup = { tanggal: kunci, label: formatTanggalPanjang(p.tanggal), items: [] };
      mapPerlu.set(kunci, grup);
    }
    grup.items.push({
      id: p.id,
      href: `/pertemuan/${p.id}`,
      judul: `${jadwal.mapel.nama} — ${jadwal.kelas.nama}`,
      detail: `Pertemuan ke-${p.pertemuanKe}${p.sumber === "MANUAL" ? " · Manual" : ""}`,
    });
  }
  const grupPerlu = [...mapPerlu.values()];

  return (
    <div className="fade-up">
      <PageHeader
        title={`${sapaan}, ${user.nama.split(",")[0]}!`}
        subtitle="Terus semangat hari ini"
        icon={<Sparkles className="h-6 w-6" />}
      />

      <SuksesBanner message={searchParams.sukses} />

      <TourPertama role={user.role} />

      {/* Keterangan waktu — satu baris agar ringkas di layar HP */}
      <InfoWaktu />

      {/* Absensi harian kelas (guru jam pertama) */}
      <Card className="mt-4 overflow-hidden">
        <h2 className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 font-extrabold text-slate-900">
          <ClipboardCheck className="h-5 w-5 text-blue-600" /> Absensi Kelas Hari Ini
        </h2>
        {kelasJamPertamaSaya.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Anda bukan guru jam pertama hari ini"
              desc="Hanya guru pemegang jadwal jam pembuka (jam ke-1; Senin jam ke-2) yang muncul di sini. Guru piket menjadi backup untuk kelas lain."
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {kelasJamPertamaSaya.map((j) => {
              const st = statusAbsensiKelas(j.kelasId);
              const sudah = st !== "BELUM_DIISI";
              return (
                <Link
                  key={j.kelasId}
                  href={`/absensi-harian/${j.kelasId}`}
                  className="group flex flex-col gap-3 px-5 py-4 transition hover:bg-blue-50/50 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="flex items-center gap-3 sm:contents">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100">
                      <ClipboardCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-bold text-slate-900 group-hover:text-blue-700">{j.kelas.nama}</p>
                      <p className="break-words text-xs text-slate-500">
                        Jam pertama: {j.mapel.nama} · {rentangJamPertamaByKelas.get(j.kelasId) ?? `Jam ${j.jamKeMulai}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-row items-center justify-between gap-2 sm:flex-col sm:items-end">
                    <span className={`chip ${STATUS_ABSENSI_HARIAN_BADGE[st]}`}>{STATUS_ABSENSI_HARIAN_LABEL[st]}</span>
                    <span className={`btn btn-sm min-h-11 ${sudah ? "btn-secondary" : "btn-primary group-hover:bg-emerald-700"}`}>
                      <PenLine className="h-3.5 w-3.5" /> {sudah ? "Koreksi" : "Isi"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      {/* Jadwal hari ini — jam yang sedang berjalan menyala otomatis (live) */}
      <JadwalHariIniBeranda
        hari={hariHariIni}
        jamAwal={hariHariIni ? jamKeBerjalan(hariHariIni, new Date()) : null}
        items={jadwalHariIniItems}
      />

      {/* Perlu dilengkapi (tertinggal) — per tanggal, klik untuk buka rincian */}
      <PerluDilengkapiBeranda grups={grupPerlu} />

      {/* Pintu ke dashboard statistik */}
      <div className="mt-6 flex justify-center">
        <Link href="/ringkasan" className="btn-ghost">
          <BarChart3 className="h-4 w-4" /> Lihat Ringkasan & Statistik
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
