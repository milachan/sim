import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox, Search, SearchX } from "lucide-react";
import type { StatusDokumen } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { adalahPemeriksaDokumen } from "@/lib/otorisasi";
import { lamaMenunggu, opsiTabKotakMasuk, OPSI_TAB_KOTAK_MASUK, urutkanKotakMasuk } from "@/lib/administrasi/pemeriksaan";
import PageHeader from "@/components/ds/page-header";
import FilterTabs from "@/components/ds/filter-tabs";
import EmptyState from "@/components/ds/empty-state";
import Alert from "@/components/ds/alert";
import DokumenCard from "@/components/administrasi/dokumen-card";

const BATAS_DAFTAR = 100;
const STATUS_KOTAK_MASUK: StatusDokumen[] = ["DIKIRIM", "PERLU_REVISI", "DISETUJUI", "DIFINALKAN"];

function hrefDenganTab(tab: string | null, q: string | null): string {
  const params = new URLSearchParams();
  if (tab && tab !== "menunggu") params.set("tab", tab);
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `/administrasi/kotak-masuk?${qs}` : "/administrasi/kotak-masuk";
}

export default async function KotakMasukPage({
  searchParams,
}: {
  searchParams?: { tab?: string; q?: string };
}) {
  const user = await getCurrentUser();
  if (!user || !adalahPemeriksaDokumen(user.role)) redirect("/administrasi");

  // Filter & pencarian diproses server-side; default tab Menunggu Tindakan.
  const tab = opsiTabKotakMasuk(searchParams?.tab ?? null);
  const q = (searchParams?.q ?? "").trim() || null;

  // Pencarian mencakup judul dokumen dan nama pengaju (dua query ringan,
  // tanpa mengubah schema). ID internal tidak pernah ditampilkan.
  let idsPengaju: string[] = [];
  if (q) {
    const users = await prisma.user.findMany({
      where: { nama: { contains: q } },
      select: { id: true },
      take: 50,
    });
    idsPengaju = users.map((u) => u.id);
  }

  const [statRows, rows] = await Promise.all([
    prisma.dokumen.groupBy({ by: ["status"], where: { status: { in: STATUS_KOTAK_MASUK } }, _count: { _all: true } }),
    prisma.dokumen.findMany({
      where: {
        status: { in: [...tab.statuses] },
        ...(q
          ? {
              OR: [
                { judul: { contains: q } },
                ...(idsPengaju.length > 0 ? [{ pengajuUserId: { in: idsPengaju } }] : []),
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: BATAS_DAFTAR,
      select: {
        id: true,
        judul: true,
        jenis: true,
        status: true,
        ringkasan: true,
        versiAktif: true,
        pengajuUserId: true,
        updatedAt: true,
      },
    }),
  ]);

  const statistik = Object.fromEntries(statRows.map((r) => [r.status, r._count._all])) as Partial<
    Record<StatusDokumen, number>
  >;

  // DIKIRIM paling lama menunggu dulu; status lain terbaru ke terlama.
  const urut = urutkanKotakMasuk(rows);

  // Nama pengaju untuk hasil (bukan ID internal).
  const namaPengaju = new Map<string, string>();
  const idsUnik = [...new Set(urut.map((r) => r.pengajuUserId))];
  if (idsUnik.length > 0) {
    const users = await prisma.user.findMany({ where: { id: { in: idsUnik } }, select: { id: true, nama: true } });
    for (const u of users) namaPengaju.set(u.id, u.nama);
  }

  const kotakKosong =
    statistik.DIKIRIM == null || statistik.DIKIRIM === 0
      ? rows.length === 0 && (await prisma.dokumen.count({ where: { status: { in: STATUS_KOTAK_MASUK } } })) === 0
      : false;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Pemeriksaan"
        title="Kotak Masuk Dokumen"
        subtitle="Dokumen yang dikirim guru untuk diperiksa. Setujui dokumen yang lengkap, atau minta revisi bila masih ada yang perlu diperbaiki."
      />

      {/* Statistik nyata */}
      <section aria-label="Ringkasan kotak masuk">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Menunggu Tindakan", nilai: statistik.DIKIRIM ?? 0, tab: "menunggu" },
            { label: "Perlu Revisi", nilai: statistik.PERLU_REVISI ?? 0, tab: "perlu_revisi" },
            { label: "Disetujui", nilai: statistik.DISETUJUI ?? 0, tab: "disetujui" },
            { label: "Difinalkan", nilai: (statistik.DIFINALKAN ?? 0) + (statistik.DIARSIPKAN ?? 0), tab: "difinalkan" },
          ].map((s) => (
            <Link
              key={s.tab}
              href={hrefDenganTab(s.tab, q)}
              className="flex min-h-[44px] flex-col rounded-[var(--card-radius)] border border-[hsl(var(--card-border)/0.8)] bg-[hsl(var(--card-bg))] p-4 shadow-[var(--card-shadow)] transition hover:border-accent-border hover:shadow-[var(--p-shadow-topbar)]"
            >
              <span className="truncate text-2xl font-extrabold leading-tight text-slate-900">{s.nilai}</span>
              <span className="truncate text-xs font-semibold text-slate-500">{s.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Tab filter + pencarian */}
      <section aria-label="Filter dan pencarian" className="space-y-3">
        <form method="get" action="/administrasi/kotak-masuk" role="search" className="flex gap-2">
          {tab.nilai !== "menunggu" && <input type="hidden" name="tab" value={tab.nilai} />}
          <label htmlFor="cari-kotak-masuk" className="sr-only">
            Cari judul dokumen atau nama pengaju
          </label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="cari-kotak-masuk"
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Cari judul dokumen atau nama pengaju…"
              autoComplete="off"
              className="input pl-9"
            />
          </div>
          <button type="submit" className="btn-secondary shrink-0">
            Cari
          </button>
        </form>

        <FilterTabs
          label="Filter status kotak masuk"
          aktif={tab.nilai}
          items={OPSI_TAB_KOTAK_MASUK.map((opsi) => ({
            nilai: opsi.nilai,
            label: opsi.label,
            href: hrefDenganTab(opsi.nilai === "menunggu" ? null : opsi.nilai, q),
          }))}
        />

        {q && (
          <p className="px-1 text-xs text-slate-500">
            Hasil untuk <span className="font-bold text-slate-700">“{q}”</span>{" "}
            <Link href={hrefDenganTab(tab.nilai === "menunggu" ? null : tab.nilai, null)} className="font-semibold text-blue-700 hover:text-blue-900">
              hapus pencarian
            </Link>
          </p>
        )}
      </section>

      {/* Daftar dokumen */}
      {urut.length === 0 ? (
        kotakKosong && tab.nilai === "menunggu" && !q ? (
          <EmptyState
            icon={Inbox}
            variant="success"
            title="Kotak masuk kosong"
            description="Belum ada dokumen yang dikirim guru. Dokumen baru dari guru akan muncul di sini."
          />
        ) : (
          <EmptyState
            icon={SearchX}
            variant="filter"
            title="Tidak ada dokumen yang cocok"
            description={
              q
                ? `Tidak ada dokumen pada tab ${tab.label} dengan judul atau pengaju mengandung “${q}”.`
                : `Tidak ada dokumen pada tab ${tab.label}.`
            }
            action={
              <Link href="/administrasi/kotak-masuk" className="btn-secondary btn-sm min-h-[44px]">
                Reset filter & pencarian
              </Link>
            }
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {urut.map((r) => {
            const milikSendiri = r.pengajuUserId === user.id;
            return (
              <DokumenCard
                key={r.id}
                href={`/administrasi/kotak-masuk/${r.id}`}
                judul={r.judul}
                jenis={r.jenis}
                status={r.status as StatusDokumen}
                ringkasan={r.ringkasan}
                versiAktif={r.versiAktif}
                updatedAt={r.updatedAt}
                pengajuNama={namaPengaju.get(r.pengajuUserId) ?? "—"}
                labelAksi={r.status === "DIKIRIM" ? "Perlu tindakan" : null}
                metaTambahan={r.status === "DIKIRIM" ? `menunggu ${lamaMenunggu(r.updatedAt)}` : null}
                catatan={milikSendiri ? "Menunggu pemeriksa lain" : null}
              />
            );
          })}
        </div>
      )}

      {urut.length >= BATAS_DAFTAR && (
        <p className="px-1 text-xs text-slate-400">
          Menampilkan {BATAS_DAFTAR} dokumen teratas. Persempit filter atau pencarian untuk melihat lainnya.
        </p>
      )}

      <Alert variant="neutral" className="mx-1 text-[11px] text-slate-400">
        Dokumen draf milik guru tidak tampil di kotak masuk — hanya dokumen yang sudah dikirim.
      </Alert>
    </div>
  );
}
