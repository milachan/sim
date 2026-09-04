import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileEdit,
  FilePlus2,
  FileText,
  FolderCheck,
  Inbox,
  PenLine,
  Send,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { adalahPemeriksaAdministrasi } from "@/lib/administrasi/nav-config";
import {
  ALUR_DOKUMEN,
  bangunKartuStatistikPemeriksa,
  copyHeaderDashboard,
  hitungStatistikPemeriksa,
  hitungStatistikPengaju,
  hrefTabKotakMasuk,
  labelAksiAntrean,
  urutAntreanLembaga,
} from "@/lib/administrasi/dashboard";
import { lamaMenunggu } from "@/lib/administrasi/pemeriksaan";
import PageHeader from "@/components/ds/page-header";
import StatCard from "@/components/ds/stat-card";
import DokumenCard from "@/components/administrasi/dokumen-card";
import EmptyState from "@/components/ds/empty-state";
import SectionHeader from "@/components/ds/section-header";
import Card from "@/components/ds/card";
import Alert from "@/components/ds/alert";
import { cn, formatTanggal } from "@/lib/utils";
import { STATUS_DOKUMEN_BADGE, STATUS_DOKUMEN_LABEL } from "@/lib/dokumen-validasi";
import type { StatusDokumen } from "@prisma/client";

const COUNT_ALL = { _all: true } as const;
const BATAS_ANTREAN_LEMBAGA = 5;
const BATAS_AKTIVITAS = 5;

function keJumlahPerStatus(rows: { status: StatusDokumen; _count: { _all: number } }[]) {
  const jumlah: Partial<Record<StatusDokumen, number>> = {};
  for (const r of rows) jumlah[r.status] = r._count._all;
  return jumlah;
}

const INFO_DIIZINKAN = new Set<string>(["pengajuan-tidak-tersedia"]);

function ambilInfoDiizinkan(raw: string | string[] | undefined): string | null {
  if (!raw) return null;
  const nilai = Array.isArray(raw) ? raw[0] : raw;
  if (!nilai) return null;
  return INFO_DIIZINKAN.has(nilai) ? nilai : null;
}

type ItemAntreanUi = {
  id: string;
  judul: string;
  updatedAt: Date;
  namaPengaju: string;
  milikSendiri: boolean;
  lama: string;
};

type ItemAktivitas = {
  id: string;
  judul: string;
  status: StatusDokumen;
  updatedAt: Date;
  namaPengaju: string;
};

export default async function AdministrasiPage({
  searchParams,
}: {
  searchParams?: { info?: string | string[] };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isPemeriksa = adalahPemeriksaAdministrasi(user.role);
  const copy = copyHeaderDashboard(user.role);
  const info = ambilInfoDiizinkan(searchParams?.info);

  if (isPemeriksa) {
    return <DashboardPemeriksa userNama={user.nama} copy={copy} info={info} />;
  }
  return <DashboardPengaju userId={user.id} userNama={user.nama} copy={copy} />;
}

// ====== Dashboard pemeriksa (KEPALA/ADMIN/SUPERADMIN) ======
// - Statistik pemeriksaan diprioritaskan, masing-masing membuka tab yang sesuai.
// - Antrean lembaga hanya berisi DIKIRIM (tanpa DRAF orang lain).
// - Aktivitas lembaga menampilkan dokumen non-DRAF lintas pengguna.
// - Pemeriksa TIDAK memiliki dokumen pribadi/ajuan; tidak ada CTA "Ajukan",
//   tidak ada statistik pribadi, tidak ada query berdasarkan pengajuUserId.

async function DashboardPemeriksa({
  userNama,
  copy,
  info,
}: {
  userNama: string;
  copy: { eyebrow: string; subtitle: string };
  info: string | null;
}) {
  const [statPemeriksaRows, antreanRaw, aktivitasRaw] = await Promise.all([
    prisma.dokumen.groupBy({
      by: ["status"],
      where: { status: { in: ["DIKIRIM", "PERLU_REVISI", "DISETUJUI", "DIFINALKAN", "DIARSIPKAN"] as StatusDokumen[] } },
      _count: COUNT_ALL,
    }),
    prisma.dokumen.findMany({
      where: { status: "DIKIRIM" },
      orderBy: { updatedAt: "asc" }, // terlama menunggu di atas
      take: BATAS_ANTREAN_LEMBAGA,
      select: { id: true, judul: true, pengajuUserId: true, updatedAt: true },
    }),
    prisma.dokumen.findMany({
      // Aktivitas lembaga: bukan DRAF, lintas pengaju.
      where: { status: { not: "DRAF" } },
      orderBy: { updatedAt: "desc" },
      take: BATAS_AKTIVITAS,
      select: { id: true, judul: true, status: true, pengajuUserId: true, updatedAt: true },
    }),
  ]);

  // Nama pengaju: gabung ID dari antrean & aktivitas agar 1 query ringan.
  const idsPengaju = [
    ...antreanRaw.map((r) => r.pengajuUserId),
    ...aktivitasRaw.map((r) => r.pengajuUserId),
  ];
  const namaPengaju = new Map<string, string>();
  if (idsPengaju.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: [...new Set(idsPengaju)] } },
      select: { id: true, nama: true },
    });
    for (const u of users) namaPengaju.set(u.id, u.nama);
  }

  const stat = hitungStatistikPemeriksa(keJumlahPerStatus(statPemeriksaRows));
  const kartuStat = bangunKartuStatistikPemeriksa(keJumlahPerStatus(statPemeriksaRows));

  const antrean: ItemAntreanUi[] = urutAntreanLembaga(antreanRaw, BATAS_ANTREAN_LEMBAGA).map((r) => ({
    id: r.id,
    judul: antreanRaw.find((x) => x.id === r.id)!.judul,
    updatedAt: r.updatedAt,
    namaPengaju: namaPengaju.get(antreanRaw.find((x) => x.id === r.id)!.pengajuUserId) ?? "—",
    milikSendiri: false,
    lama: lamaMenunggu(r.updatedAt),
  }));

  const aktivitas: ItemAktivitas[] = aktivitasRaw.map((r) => ({
    id: r.id,
    judul: r.judul,
    status: r.status,
    updatedAt: r.updatedAt,
    namaPengaju: namaPengaju.get(r.pengajuUserId) ?? "—",
  }));

  return (
    <div className="space-y-6">
      {info === "pengajuan-tidak-tersedia" && (
        <Alert variant="info">
          Akun pemeriksa tidak menggunakan alur pengajuan pribadi. Gunakan Kotak Masuk untuk memeriksa dokumen guru.
        </Alert>
      )}

      <PageHeader
        eyebrow={copy.eyebrow}
        title="Rumah Administrasi"
        subtitle={
          <>
            Selamat datang, <span className="font-bold text-slate-700">{userNama}</span>. {copy.subtitle}
          </>
        }
        actions={
          <Link href="/administrasi/kotak-masuk" className="btn-primary">
            <Inbox className="h-4 w-4" aria-hidden="true" />
            Periksa Dokumen
            {stat.menunggu > 0 && (
              <span
                aria-hidden="true"
                className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-extrabold text-blue-700"
              >
                {stat.menunggu}
              </span>
            )}
          </Link>
        }
      />

      {/* Statistik pemeriksaan: masing-masing kartu membuka tab kotak-masuk yang sesuai. */}
      <section>
        <SectionHeader title="Pemeriksaan" className="[&_h2]:text-amber-700" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kartuStat.map((s) => (
            <StatCard
              key={s.tab}
              label={s.label}
              value={s.nilai}
              icon={ikonUntukTabPemeriksa(s.tab)}
              tone={toneUntukTabPemeriksa(s.tab)}
              href={hrefTabKotakMasuk(s.tab)}
            />
          ))}
        </div>
      </section>

      {/* Antrean lembaga: hanya DIKIRIM, terlama di atas. */}
      <section className="fade-up">
        <Card>
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
              <Inbox className="h-4 w-4 text-amber-500" aria-hidden="true" />
              Menunggu Pemeriksaan
            </h2>
            <Link
              href={hrefTabKotakMasuk("menunggu")}
              className="text-[11px] font-semibold text-blue-700 hover:text-blue-900"
            >
              Lihat semua
            </Link>
          </div>
          {antrean.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                icon={CheckCircle2}
                title="Tidak ada dokumen yang menunggu pemeriksaan."
                description="Semua pengajuan guru telah ditangani. Antrean akan terisi ketika ada dokumen DIKIRIM baru."
                variant="success"
              />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {antrean.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/administrasi/kotak-masuk/${item.id}`}
                    className="flex min-h-[44px] items-center gap-3 rounded-xl px-1 py-2 transition-colors hover:bg-slate-50"
                  >
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-900">{item.judul}</span>
                      <span className="flex items-center gap-1 truncate text-xs text-slate-500">
                        {item.namaPengaju}
                        <span className="text-slate-400">· menunggu {item.lama}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-slate-400">
                      {labelAksiAntrean(false)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* Aktivitas lembaga: bukan DRAF, lintas pengaju, max 5. */}
      <section>
        <SectionHeader
          title="Aktivitas Pengajuan Terbaru"
          description="Pengajuan dari seluruh guru — bukan hanya milik Anda."
          action={{
            href: "/administrasi/kotak-masuk",
            label: (
              <>
                Lihat semua
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </>
            ),
          }}
        />
        {aktivitas.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Belum ada aktivitas"
            description="Aktivitas akan muncul di sini setelah ada pengajuan baru."
          />
        ) : (
          <ul className="grid grid-cols-1 gap-2">
            {aktivitas.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/administrasi/kotak-masuk/${r.id}`}
                  className="flex min-h-[44px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 transition-colors hover:bg-slate-50"
                >
                  <span className={cn("chip shrink-0", STATUS_DOKUMEN_BADGE[r.status])}>
                    {STATUS_DOKUMEN_LABEL[r.status]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-slate-900">{r.judul}</span>
                    <span className="block truncate text-xs text-slate-500">Dari {r.namaPengaju}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-slate-400">
                    {formatTanggal(r.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ikonUntukTabPemeriksa(tab: "menunggu" | "perlu_revisi" | "disetujui" | "difinalkan") {
  if (tab === "menunggu") return Inbox;
  if (tab === "perlu_revisi") return PenLine;
  if (tab === "disetujui") return CheckCircle2;
  return ClipboardList;
}

function toneUntukTabPemeriksa(tab: "menunggu" | "perlu_revisi" | "disetujui" | "difinalkan") {
  if (tab === "menunggu") return "amber" as const;
  if (tab === "perlu_revisi") return "slate" as const;
  if (tab === "disetujui") return "emerald" as const;
  return "violet" as const;
}

// ====== Dashboard pengaju (GURU/WAKA) ======
// Logika, query, dan akses TIDAK berubah dari versi sebelumnya.
// Hanya dokumentasi internal untuk menegaskan scope query terikat pemilik.

async function DashboardPengaju({
  userId,
  userNama,
  copy,
}: {
  userId: string;
  userNama: string;
  copy: { eyebrow: string; subtitle: string };
}) {
  const [statPengajuRows, perluRevisiRows, drafRows, terbaruRows] = await Promise.all([
    prisma.dokumen.groupBy({
      by: ["status"],
      where: { pengajuUserId: userId },
      _count: COUNT_ALL,
    }),
    prisma.dokumen.findMany({
      where: { pengajuUserId: userId, status: "PERLU_REVISI" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, judul: true, jenis: true, status: true, updatedAt: true },
    }),
    prisma.dokumen.findMany({
      where: { pengajuUserId: userId, status: "DRAF" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, judul: true, jenis: true, status: true, updatedAt: true },
    }),
    prisma.dokumen.findMany({
      where: { pengajuUserId: userId },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, judul: true, jenis: true, status: true, ringkasan: true, versiAktif: true, updatedAt: true },
    }),
  ]);

  const statPengaju = hitungStatistikPengaju(keJumlahPerStatus(statPengajuRows));
  const totalTindakanPenuh = statPengaju.perluRevisi + statPengaju.draf;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={copy.eyebrow}
        title="Rumah Administrasi"
        subtitle={
          <>
            Selamat datang, <span className="font-bold text-slate-700">{userNama}</span>. {copy.subtitle}
          </>
        }
        actions={
          <Link href="/administrasi/baru" className="btn-primary">
            <FilePlus2 className="h-4 w-4" aria-hidden="true" />
            Ajukan Dokumen
          </Link>
        }
      />

      <section>
        <SectionHeader title="Dokumen Saya" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Draf" value={statPengaju.draf} icon={FileEdit} tone="slate" />
          <StatCard label="Dikirim (diproses)" value={statPengaju.diproses} icon={Send} tone="blue" href="/administrasi/dokumen-saya?status=dikirim" />
          <StatCard label="Perlu revisi" value={statPengaju.perluRevisi} icon={PenLine} tone="amber" href="/administrasi/dokumen-saya?status=perlu_revisi" />
          <StatCard label="Selesai" value={statPengaju.selesai} icon={FolderCheck} tone="emerald" href="/administrasi/dokumen-saya" />
        </div>
      </section>

      <section className="fade-up">
        <Card>
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
              <Sparkles className="h-4 w-4 text-amber-500" aria-hidden="true" />
              Perlu Tindakan
            </h2>
            {totalTindakanPenuh > Math.min(perluRevisiRows.length + drafRows.length, 5) && (
              <span className="text-[11px] font-semibold text-slate-400">{totalTindakanPenuh} item tertunda</span>
            )}
          </div>
          {perluRevisiRows.length + drafRows.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                icon={CheckCircle2}
                title="Semua beres!"
                description="Tidak ada draf atau revisi yang menunggu Anda saat ini."
                variant="success"
              />
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {[...perluRevisiRows, ...drafRows].map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/administrasi/${item.id}`}
                    className="flex min-h-[44px] items-center gap-3 rounded-xl px-1 py-2 transition-colors hover:bg-slate-50"
                  >
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-900">{item.judul}</span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-slate-400">
                      {item.status === "PERLU_REVISI" ? "Perbaiki & kirim ulang" : "Lanjutkan draf"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <Card padding="sm" className="sm:p-5" ariaLabel="Alur dokumen administrasi">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-[11px] font-bold text-slate-500" aria-label="Alur dokumen administrasi">
          {ALUR_DOKUMEN.map((tahap, i) => (
            <li key={tahap} className="flex items-center gap-1.5">
              <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-extrabold",
                    i === 0 ? "bg-blue-700 text-white" : "bg-white text-slate-500 ring-1 ring-inset ring-slate-200"
                  )}
                >
                  {i + 1}
                </span>
                {tahap}
              </span>
              {i < ALUR_DOKUMEN.length - 1 && (
                <ArrowRight className="h-3 w-3 shrink-0 text-slate-300" aria-hidden="true" />
              )}
            </li>
          ))}
        </ol>
      </Card>

      <section>
        <SectionHeader
          title="Dokumen Terbaru"
          action={{
            href: "/administrasi/dokumen-saya",
            label: (
              <>
                Lihat semua
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </>
            ),
          }}
        />
        {terbaruRows.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Belum ada dokumen"
            description="Ajukan dokumen pertama Anda — tahap awal tersimpan sebagai draf."
            action={
              <Link href="/administrasi/baru" className="btn-primary btn-sm min-h-[44px]">
                <UploadCloud className="h-4 w-4" aria-hidden="true" />
                Ajukan Dokumen
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {terbaruRows.map((r) => (
              <DokumenCard
                key={r.id}
                href={`/administrasi/${r.id}`}
                judul={r.judul}
                jenis={r.jenis}
                status={r.status}
                ringkasan={r.ringkasan}
                versiAktif={r.versiAktif}
                updatedAt={r.updatedAt}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
