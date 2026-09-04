import Link from "next/link";
import { redirect } from "next/navigation";
import { FilePlus2, Search, SearchX } from "lucide-react";
import type { StatusDokumen } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { bolehMengajukanDokumen } from "@/lib/otorisasi";
import {
  bangunWhereDokumenSaya,
  bersihkanQueryCarian,
  OPSI_FILTER_DOKUMEN,
  opsiFilterDokumen,
} from "@/lib/administrasi/dashboard";
import PageHeader from "@/components/ds/page-header";
import FilterTabs from "@/components/ds/filter-tabs";
import EmptyState from "@/components/ds/empty-state";
import DokumenCard from "@/components/administrasi/dokumen-card";

const BATAS_DAFTAR = 100;

function hrefDenganFilter(status: string | null, q: string | null): string {
  const params = new URLSearchParams();
  if (status && status !== "semua") params.set("status", status);
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `/administrasi/dokumen-saya?${qs}` : "/administrasi/dokumen-saya";
}

export default async function DokumenSayaPage({
  searchParams,
}: {
  searchParams?: { status?: string; q?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Guard server-side: KEPALA/ADMIN/SUPERADMIN tidak memiliki alur
  // pengajuan pribadi. Alihkan ke dashboard dengan penanda netral,
  // tanpa menampilkan form atau daftar pribadi.
  if (!bolehMengajukanDokumen(user)) {
    redirect("/administrasi?info=pengajuan-tidak-tersedia");
  }

  // Filter & pencarian diproses server-side lewat helper yang dites.
  const filter = opsiFilterDokumen(searchParams?.status ?? null);
  const q = bersihkanQueryCarian(searchParams?.q ?? null);
  const where = bangunWhereDokumenSaya(user.id, filter.nilai, q);

  const rows = await prisma.dokumen.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: BATAS_DAFTAR,
    select: { id: true, judul: true, jenis: true, status: true, ringkasan: true, versiAktif: true, updatedAt: true },
  });

  // Bedakan "belum pernah membuat dokumen" vs "tidak ada hasil filter".
  const totalMilik =
    rows.length === 0
      ? await prisma.dokumen.count({ where: { pengajuUserId: user.id } })
      : rows.length;
  const belumPernahMembuat = totalMilik === 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Rumah Administrasi"
        title="Dokumen Saya"
        subtitle="Seluruh dokumen administrasi milik Anda, dari draf hingga difinalkan. Pilih dokumen untuk melanjutkan pengisian, unggah versi PDF, atau melihat riwayatnya."
        actions={
          <Link href="/administrasi/baru" className="btn-primary">
            <FilePlus2 className="h-4 w-4" aria-hidden="true" />
            Ajukan Dokumen
          </Link>
        }
      />

      {/* Filter status + pencarian — dipertahankan antar navigasi */}
      <section aria-label="Filter dan pencarian" className="space-y-3">
        <form method="get" action="/administrasi/dokumen-saya" role="search" className="flex gap-2">
          {filter.nilai !== "semua" && <input type="hidden" name="status" value={filter.nilai} />}
          <label htmlFor="cari-dokumen" className="sr-only">
            Cari judul dokumen
          </label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="cari-dokumen"
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Cari judul dokumen…"
              autoComplete="off"
              className="input pl-9"
            />
          </div>
          <button type="submit" className="btn-secondary shrink-0">
            Cari
          </button>
        </form>

        <FilterTabs
          label="Filter status dokumen"
          aktif={filter.nilai}
          items={OPSI_FILTER_DOKUMEN.map((opsi) => ({
            nilai: opsi.nilai,
            label: opsi.label,
            href: hrefDenganFilter(opsi.nilai === "semua" ? null : opsi.nilai, q),
          }))}
        />

        {(q || filter.statuses.length > 0) && (
          <p className="px-1 text-xs text-slate-500">
            Menampilkan {rows.length >= BATAS_DAFTAR ? `${BATAS_DAFTAR}+` : rows.length} dokumen
            {q && (
              <>
                {" "}untuk pencarian <span className="font-bold text-slate-700">“{q}”</span>{" "}
                <Link href={hrefDenganFilter(filter.nilai === "semua" ? null : filter.nilai, null)} className="font-semibold text-blue-700 hover:text-blue-900">
                  hapus pencarian
                </Link>
              </>
            )}
          </p>
        )}
      </section>

      {/* Daftar dokumen — card di semua ukuran layar */}
      {rows.length === 0 ? (
        belumPernahMembuat ? (
          <EmptyState
            icon={FilePlus2}
            title="Belum ada dokumen"
            description="Anda belum pernah membuat dokumen. Ajukan dokumen pertama Anda — tahap awal tersimpan sebagai draf."
            action={
              <Link href="/administrasi/baru" className="btn-primary btn-sm min-h-[44px]">
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                Ajukan Dokumen
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={SearchX}
            variant="filter"
            title="Tidak ada dokumen yang cocok"
            description={
              q
                ? `Tidak ada dokumen dengan judul mengandung “${q}” pada filter ${filter.label}.`
                : `Tidak ada dokumen pada status ${filter.label}.`
            }
            action={
              <Link href="/administrasi/dokumen-saya" className="btn-secondary btn-sm min-h-[44px]">
                Reset filter & pencarian
              </Link>
            }
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <DokumenCard
              key={r.id}
              href={`/administrasi/${r.id}`}
              judul={r.judul}
              jenis={r.jenis}
              status={r.status as StatusDokumen}
              ringkasan={r.ringkasan}
              versiAktif={r.versiAktif}
              updatedAt={r.updatedAt}
            />
          ))}
        </div>
      )}
    </div>
  );
}

