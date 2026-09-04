import Link from "next/link";
import { BookOpen, PenLine } from "lucide-react";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { EmptyState, PageHeader, SuksesBanner } from "@/components/ui";
import { cn, formatTanggal, persen } from "@/lib/utils";
import { HARI_LABEL } from "@/lib/constants";
import { hitungKelengkapanPerGuru, namaGuruPertemuan, wherePertemuanGuru } from "@/lib/laporan";
import ToolbarJurnal from "@/components/jurnal/toolbar-jurnal";
import DaftarJurnal, { type ItemJurnalList } from "@/components/jurnal/daftar-jurnal";
import KalenderJurnal from "@/components/jurnal/kalender-jurnal";
import PanelGuruPerhatian from "@/components/jurnal/panel-guru-perhatian";

export const dynamic = "force-dynamic";

function MiniStat({ label, value, warna = "text-slate-900" }: { label: string; value: number; warna?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-inset ring-slate-100">
      <p className={`text-lg font-extrabold ${warna}`}>{value}</p>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

export default async function JurnalPage({
  searchParams,
}: {
  searchParams: { tab?: string; bulan?: string; q?: string; mode?: string; guru?: string; sukses?: string; semua?: string; kelas?: string; tanggal?: string };
}) {
  const user = await getCurrentUser();
  const isGuru = user?.role === "GURU" || (user?.role === "WAKA" && !!user?.guruId);
  // Hanya GURU/WAKA/ADMIN/SUPERADMIN yang boleh membuat jurnal (guard wajibKelola).
  const bisaKelola = !!user && ["GURU", "WAKA", "ADMIN", "SUPERADMIN"].includes(user.role) && !!user.guruId;

  const [tahun, bulanNum] = (() => {
    const m = searchParams.bulan ?? "";
    if (/^\d{4}-\d{2}$/.test(m)) {
      const [y, mo] = m.split("-").map(Number);
      if (mo >= 1 && mo <= 12) return [y, mo] as const;
    }
    const now = new Date();
    return [now.getFullYear(), now.getMonth() + 1] as const;
  })();
  const bulan = `${tahun}-${String(bulanNum).padStart(2, "0")}`;
  const q = (searchParams.q ?? "").trim().slice(0, 80);
  const mode = searchParams.mode === "kalender" ? "kalender" : "daftar";
  // Alias lama "draft" (konsep) diarahkan ke "belum" — konsep disatukan dengan belum diisi di UI.
  const tab = ["semua", "terkirim", "belum"].includes(searchParams.tab ?? "")
    ? searchParams.tab!
    : searchParams.tab === "draft"
      ? "belum"
      : "semua";
  const kelasFilter = searchParams.kelas ?? "";
  const tanggalFilter = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.tanggal ?? "") ? searchParams.tanggal! : "";

  // Rentang waktu: tanggal spesifik (bila dipilih) menggantikan rentang bulan.
  const mulai = tanggalFilter
    ? new Date(`${tanggalFilter}T00:00:00`)
    : new Date(tahun, bulanNum - 1, 1);
  const akhir = tanggalFilter
    ? new Date(`${tanggalFilter}T23:59:59.999`)
    : new Date(tahun, bulanNum, 0, 23, 59, 59);

  // Drill-down per guru (Waka/Admin/Kamad): validasi param guru terhadap data
  let guruAktif: { guruId: string; nama: string } | null = null;
  const guruParam = searchParams.guru ?? "";
  if (guruParam && !isGuru) {
    const g = await prisma.guru.findUnique({ where: { id: guruParam, deletedAt: null }, select: { id: true, nama: true } });
    if (g) guruAktif = { guruId: g.id, nama: g.nama };
  }

  // Daftar kelas untuk filter (non-guru)
  const kelasList = isGuru ? [] : await prisma.kelas.findMany({ orderBy: [{ tingkat: "asc" }, { nama: "asc" }] });
  const kelasValid = kelasFilter && kelasList.some((k) => k.id === kelasFilter) ? kelasFilter : "";

  const where: Prisma.PertemuanWhereInput = { tanggal: { gte: mulai, lte: akhir } };
  const andFilter: Prisma.PertemuanWhereInput[] = [];
  if (isGuru && user?.guruId) {
    where.OR = [{ jadwal: { guruId: user.guruId } }, { dibuatOlehId: user.id }];
  }
  if (guruAktif) {
    andFilter.push(wherePertemuanGuru(guruAktif.guruId));
  }
  if (kelasValid) {
    // Pertemuan otomatis menyimpan kelas di jadwal; manual menyimpan kelas langsung.
    andFilter.push({ OR: [{ kelasId: kelasValid }, { jadwal: { kelasId: kelasValid } }] });
  }
  if (q) {
    // Pencarian teks hanya untuk guru, mapel, dan materi (kelas lewat dropdown).
    andFilter.push({
      OR: [
        { mapel: { nama: { contains: q } } },
        { jadwal: { mapel: { nama: { contains: q } } } },
        { jadwal: { guru: { nama: { contains: q } } } },
        { jurnal: { materi: { contains: q } } },
        { jurnal: { kegiatan: { contains: q } } },
      ],
    });
  }
  if (andFilter.length) where.AND = andFilter;

  // Statistik dihitung via COUNT terpisah agar akurat meski daftar dibatasi (take)
  const { jumlah, pertemuan } = await Promise.all([
    prisma.pertemuan.count({ where: { ...where, status: { not: "TIDAK_TERLAKSANA" } } }),
    prisma.pertemuan.count({ where: { ...where, status: { not: "TIDAK_TERLAKSANA" }, jurnal: { is: { status: "TERKIRIM" } } } }),
    prisma.pertemuan.count({ where: { ...where, status: { not: "TIDAK_TERLAKSANA" }, jurnal: { is: { status: "DRAFT" } } } }),
    prisma.pertemuan.count({ where: { ...where, status: { not: "TIDAK_TERLAKSANA" }, jurnal: { is: null } } }),
    prisma.pertemuan.findMany({
      where,
      include: {
        jadwal: { include: { kelas: true, mapel: true, guru: true } },
        kelas: true,
        mapel: true,
        dibuatOleh: { select: { id: true, nama: true, guruId: true } },
        jurnal: true,
        _count: { select: { absensi: true } },
      },
      orderBy: { tanggal: "desc" },
      take: 500,
    }),
  ]).then(([total, terkirim, draft, belumKosong, list]) => ({
    // Draft (konsep lama) disatukan ke "Belum Diisi" di UI.
    jumlah: { total, terkirim, belum: draft + belumKosong },
    pertemuan: list,
  }));
  const persenLengkap = persen(jumlah.terkirim, jumlah.total);

  // Ringkasan kelengkapan per guru (Waka/Admin/Kamad) untuk bulan terpilih.
  // Metrik "lengkap" dihitung dari status jurnal langsung (TERKIRIM). Jurnal
  // manual ikut diatribusikan ke guru pembuatnya (dibuatOleh.guruId).
  const ringkasanGuru = !isGuru
    ? await (async () => {
        const [guruList, rows] = await Promise.all([
          prisma.guru.findMany({ where: { status: true, deletedAt: null }, select: { id: true, nama: true }, orderBy: { nama: "asc" } }),
          prisma.pertemuan.findMany({
            where: {
              tanggal: { gte: mulai, lte: akhir },
              status: { not: "TIDAK_TERLAKSANA" },
              ...(kelasValid ? { OR: [{ kelasId: kelasValid }, { jadwal: { kelasId: kelasValid } }] } : {}),
            },
            select: {
              jadwal: { select: { guruId: true } },
              dibuatOleh: { select: { guruId: true } },
              jurnal: { select: { status: true } },
            },
          }),
        ]);
        const perGuru = hitungKelengkapanPerGuru(
          rows,
          guruList.map((g) => ({ id: g.id, nama: g.nama }))
        );
        return perGuru
          .map((g) => ({ guruId: g.guruId, nama: g.nama, total: g.total, lengkap: g.lengkap, persen: g.persen }))
          .sort((a, b) => a.persen - b.persen || a.nama.localeCompare(b.nama));
      })()
    : [];

  const keItem = (p: (typeof pertemuan)[number]): ItemJurnalList => {
    const kelas = p.kelas ?? p.jadwal?.kelas;
    const mapel = p.mapel ?? p.jadwal?.mapel;
    const guru = namaGuruPertemuan(p);
    return {
      id: p.id,
      tanggal: p.tanggal.toISOString().slice(0, 10),
      mapel: mapel?.nama ?? "-",
      kelas: kelas?.nama ?? "-",
      guru: guru ?? "",
      pertemuanKe: p.pertemuanKe,
      hari: p.jadwal ? HARI_LABEL[p.jadwal.hari] : "",
      sumber: p.sumber,
      jurnalStatus: p.jurnal?.status ?? null,
    };
  };

  // TIDAK_TERLAKSANA tidak dihitung sebagai belum diisi
  const aktif = pertemuan.filter((p) => p.status !== "TIDAK_TERLAKSANA");
  // Kalender selalu menampilkan seluruh status pada bulan terpilih (tidak ikut filter tab)
  const itemsKalender = aktif.map(keItem);
  const items = aktif
    .filter((p) => {
      if (tab === "terkirim") return p.jurnal?.status === "TERKIRIM";
      // Belum = jurnal kosong ATAU masih draft (konsep lama yang belum dikirim).
      if (tab === "belum") return !p.jurnal || p.jurnal?.status === "DRAFT";
      return true;
    })
    .map(keItem);

  const tabs = [
    { id: "semua", label: "Semua", count: jumlah.total },
    { id: "terkirim", label: "Lengkap", count: jumlah.terkirim },
    { id: "belum", label: "Belum Diisi", count: jumlah.belum },
  ];

  const paramsGuru = guruAktif ? `&guru=${guruAktif.guruId}` : "";
  const hrefTab = (id: string) => `/jurnal?tab=${id}&bulan=${bulan}&mode=${mode}${paramsGuru}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  const hrefGuru = (id: string) => `/jurnal?bulan=${bulan}&mode=${mode}${id ? `&guru=${id}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  // URL kembali ke halaman ini (dengan semua filter aktif) — dipakai halaman
  // detail pertemuan untuk menampilkan tombol "Kembali" yang tidak menghilangkan filter.
  const spKembali = new URLSearchParams({ bulan, mode });
  if (q) spKembali.set("q", q);
  if (tab !== "semua") spKembali.set("tab", tab);
  if (guruAktif) spKembali.set("guru", guruAktif.guruId);
  if (kelasValid) spKembali.set("kelas", kelasValid);
  if (tanggalFilter) spKembali.set("tanggal", tanggalFilter);
  const urlKembali = `/jurnal?${spKembali.toString()}`;
  // Query string yang dibawa ke halaman detail: kembalikan ke /jurnal dengan filter.
  const detailQuery = `kembali=${encodeURIComponent(urlKembali)}`;

  // ===== Guru Perlu Perhatian =====
  // Hanya guru yang MASIH PUNYA jurnal belum lengkap (persen < 100). Guru yang
  // sudah lengkap tidak ditampilkan (cukup dihitung di chip agregat).
  const guruPerluPerhatian = ringkasanGuru.filter((g) => g.total > 0 && g.persen < 100);
  const jumlahGuruLengkap = ringkasanGuru.filter((g) => g.total > 0 && g.persen >= 100).length;
  const jumlahGuruPerhatian = guruPerluPerhatian.length;
  const daftarGuru = (guruAktif ? ringkasanGuru : guruPerluPerhatian).map((g) => ({ ...g, href: hrefGuru(g.guruId) }));

  return (
    <div className="fade-up">
      <PageHeader
        title="Jurnal Mengajar"
        subtitle={isGuru ? "Semua jurnal Anda — lengkap atau belum diisi" : "Kelengkapan jurnal seluruh guru"}
        icon={<BookOpen className="h-6 w-6" />}
        actions={
          bisaKelola ? (
            <Link href="/jurnal/baru" className="btn-primary">
              <PenLine className="h-4 w-4" /> Jurnal Manual
            </Link>
          ) : undefined
        }
      />

      <SuksesBanner message={searchParams.sukses} />

      <ToolbarJurnal
        bulan={bulan}
        q={q}
        mode={mode}
        tab={tab}
        guru={guruAktif?.guruId ?? ""}
        kelas={kelasValid}
        tanggal={tanggalFilter}
        kelasList={kelasList}
      />

      {/* Ringkasan jurnal bulan ini */}
      <div className="card card-pad mb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-extrabold capitalize text-slate-900">
            {guruAktif ? `Jurnal ${guruAktif.nama}` : "Jurnal"} · {formatTanggal(`${bulan}-01`, "MMMM yyyy")}
          </h2>
          <span className="text-sm font-extrabold text-emerald-700">{persenLengkap}% jurnal lengkap</span>
        </div>
        <div
          className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={persenLengkap}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Persentase jurnal lengkap"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
            style={{ width: `${persenLengkap}%` }}
          />
        </div>
        {/* Jumlah per status hanya ditampilkan di mode Kalender — di mode Daftar
            angka yang sama sudah ada di chip tab di bawah, agar tidak dobel. */}
        {mode === "kalender" && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MiniStat label="Total Jurnal" value={jumlah.total} />
            <MiniStat label="Lengkap" value={jumlah.terkirim} warna="text-emerald-600" />
            <MiniStat label="Belum Diisi" value={jumlah.belum} warna="text-rose-600" />
          </div>
        )}
      </div>

      {/* Guru Perlu Perhatian — ringkas: maks 5 guru, sisanya lewat modal */}
      {ringkasanGuru.length > 0 && (
        <PanelGuruPerhatian
          bulanLabel={formatTanggal(`${bulan}-01`, "MMMM yyyy")}
          daftarGuru={daftarGuru}
          jumlahLengkap={jumlahGuruLengkap}
          jumlahPerhatian={jumlahGuruPerhatian}
          guruAktifId={guruAktif?.guruId}
        />
      )}

      {mode === "kalender" ? (
        <KalenderJurnal items={itemsKalender} bulan={bulan} linkQuery={detailQuery} sembunyikanGuru={isGuru} />
      ) : (
        <>
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
            {tabs.map((t) => (
              <Link
                key={t.id}
                href={hrefTab(t.id)}
                className={cn(
                  "whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-bold transition sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm",
                  tab === t.id ? "bg-emerald-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "ml-1.5 chip !px-1.5 !py-0.5 text-[10px] leading-none sm:ml-2 sm:!px-2 sm:text-xs",
                    tab === t.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  )}
                >
                  {t.count}
                </span>
              </Link>
            ))}
          </div>

          {items.length === 0 ? (
            <EmptyState
              title={tab === "belum" ? "Semua jurnal sudah diisi" : "Belum ada jurnal"}
              desc={
                tab === "belum"
                  ? "Tidak ada pertemuan dengan jurnal kosong."
                  : q
                    ? "Tidak ada jurnal yang cocok dengan pencarian."
                    : "Jurnal muncul otomatis dari jadwal atau dibuat manual."
              }
            />
          ) : (
            <DaftarJurnal items={items} linkQuery={detailQuery} sembunyikanGuru={isGuru} />
          )}
        </>
      )}
    </div>
  );
}
