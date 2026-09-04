import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, CheckCircle2, Download, FileText, PlusCircle, Search, SearchX } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { bolehKelolaTemplate } from "@/lib/otorisasi";
import { JENIS_DOKUMEN_LABEL } from "@/lib/dokumen-validasi";
import { bersihkanQueryCarian } from "@/lib/administrasi/dashboard";
import { opsiJenisArsip } from "@/lib/administrasi/arsip";
import { saringDaftarTemplate } from "@/lib/administrasi/template-validasi";
import { daftarTemplate } from "@/lib/actions/template";
import { hrefUnduhVersiTemplate } from "@/lib/administrasi/template-validasi";
import { formatUkuran } from "@/lib/administrasi/upload-helpers";
import { formatTanggal } from "@/lib/utils";
import PageHeader from "@/components/ds/page-header";
import StatCard from "@/components/ds/stat-card";
import Card from "@/components/ds/card";
import EmptyState from "@/components/ds/empty-state";
import FilterTabs from "@/components/ds/filter-tabs";
import Alert from "@/components/ds/alert";
import { cn } from "@/lib/utils";

const BATAS_KATALOG = 100;

function hrefTemplate(params: { q?: string | null; jenis?: string | null; status?: string | null }): string {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  if (params.jenis) p.set("jenis", params.jenis);
  if (params.status && params.status !== "semua") p.set("status", params.status);
  const qs = p.toString();
  return qs ? `/administrasi/template?${qs}` : "/administrasi/template";
}

export default async function TemplatePage({
  searchParams,
}: {
  searchParams?: { q?: string; jenis?: string; status?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const kelola = bolehKelolaTemplate(user);

  const q = bersihkanQueryCarian(searchParams?.q ?? null);
  const jenis = opsiJenisArsip(searchParams?.jenis ?? null);
  // Status hanya relevan untuk admin; pengguna selalu melihat aktif saja.
  const status = kelola ? (searchParams?.status ?? null) : null;

  // Data diambil server-side; filter diproses lewat helper murni yang dites.
  const semua = await daftarTemplate();
  const statistik = {
    total: semua.length,
    aktif: semua.filter((t) => t.aktif).length,
    nonaktif: semua.filter((t) => !t.aktif).length,
    totalVersi: semua.reduce((n, t) => n + t.jumlahVersi, 0),
  };
  const rows = saringDaftarTemplate(semua, { q, jenis, status }).slice(0, BATAS_KATALOG);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Arsip & Referensi"
        title="Template Dokumen"
        icon={FileText}
        subtitle={
          kelola
            ? "Kelola template resmi per jenis dokumen. Unggah versi baru untuk memperbarui file yang diunduh guru."
            : "Unduh template resmi madrasah sebelum menyusun dokumen pengajuan. Template dikelola oleh admin madrasah."
        }
        actions={
          kelola ? (
            <Link href="/administrasi/template/baru" className="btn-primary">
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              Tambah Template
            </Link>
          ) : undefined
        }
      />

      {/* Statistik nyata — hanya untuk pengelola */}
      {kelola && (
        <section aria-label="Ringkasan template">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total Template" value={statistik.total} icon={FileText} tone="slate" />
            <StatCard label="Aktif" value={statistik.aktif} icon={CheckCircle2} tone="emerald" />
            <StatCard label="Nonaktif" value={statistik.nonaktif} icon={Archive} tone="amber" />
            <StatCard label="Total Versi" value={statistik.totalVersi} icon={PlusCircle} tone="blue" />
          </div>
        </section>
      )}

      {/* Filter */}
      <section aria-label="Filter template" className="space-y-3">
        <form method="get" action="/administrasi/template" role="search" className="flex gap-2">
          {kelola && status && status !== "semua" && <input type="hidden" name="status" value={status} />}
          {jenis && <input type="hidden" name="jenis" value={jenis} />}
          <label htmlFor="cari-template" className="sr-only">
            Cari nama atau deskripsi template
          </label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="cari-template"
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Cari nama atau deskripsi template…"
              autoComplete="off"
              className="input pl-9"
            />
          </div>
          <button type="submit" className="btn-secondary shrink-0">
            Cari
          </button>
        </form>

        {kelola && (
          <FilterTabs
            label="Filter status template"
            aktif={status ?? "semua"}
            items={[
              { nilai: "semua", label: "Semua", href: hrefTemplate({ q, jenis, status: null }) },
              { nilai: "aktif", label: "Aktif", href: hrefTemplate({ q, jenis, status: "aktif" }) },
              { nilai: "nonaktif", label: "Nonaktif", href: hrefTemplate({ q, jenis, status: "nonaktif" }) },
            ]}
          />
        )}

        <nav aria-label="Filter jenis template">
          <ul className="flex flex-wrap gap-2">
            <li>
              <Link
                href={hrefTemplate({ q, jenis: null, status })}
                aria-current={!jenis ? "true" : undefined}
                className={cn(
                  "inline-flex min-h-[44px] items-center rounded-full px-4 text-sm font-bold transition-colors",
                  !jenis
                    ? "bg-accent-soft text-accent-foreground ring-1 ring-inset ring-accent-border"
                    : "border border-[hsl(var(--card-border))] bg-[hsl(var(--card-bg))] text-slate-600 hover:border-slate-300 hover:text-slate-900"
                )}
              >
                Semua jenis
              </Link>
            </li>
            {Object.entries(JENIS_DOKUMEN_LABEL).map(([v, l]) => (
              <li key={v}>
                <Link
                  href={hrefTemplate({ q, jenis: v, status })}
                  aria-current={jenis === v ? "true" : undefined}
                  className={cn(
                    "inline-flex min-h-[44px] items-center rounded-full px-4 text-sm font-bold transition-colors",
                    jenis === v
                      ? "bg-accent-soft text-accent-foreground ring-1 ring-inset ring-accent-border"
                      : "border border-[hsl(var(--card-border))] bg-[hsl(var(--card-bg))] text-slate-600 hover:border-slate-300 hover:text-slate-900"
                  )}
                >
                  {l}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {(q || jenis || (kelola && status && status !== "semua")) && (
          <p className="px-1 text-xs text-slate-500">
            Menampilkan {rows.length >= BATAS_KATALOG ? `${BATAS_KATALOG}+` : rows.length} template
            {q && (
              <>
                {" "}untuk pencarian <span className="font-bold text-slate-700">“{q}”</span>{" "}
                <Link href={hrefTemplate({ q: null, jenis, status })} className="font-semibold text-blue-700 hover:text-blue-900">
                  hapus pencarian
                </Link>
              </>
            )}
          </p>
        )}
      </section>

      {/* Daftar template */}
      {rows.length === 0 ? (
        semua.length === 0 && !kelola ? (
          <EmptyState
            icon={FileText}
            title="Admin belum menyediakan template resmi."
            description="Template akan muncul di sini setelah admin madrasah mengunggah dan mengaktifkannya. Sementara itu, Anda tetap dapat mengajukan dokumen tanpa template."
          />
        ) : semua.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Belum ada template"
            description="Tambahkan template pertama, lalu unggah file resminya sebelum mengaktifkan."
            action={
              <Link href="/administrasi/template/baru" className="btn-primary btn-sm min-h-[44px]">
                <PlusCircle className="h-4 w-4" aria-hidden="true" />
                Tambah Template
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={SearchX}
            variant="filter"
            title="Tidak ada template yang cocok"
            description="Tidak ada template yang cocok dengan filter atau pencarian saat ini."
            action={
              <Link href="/administrasi/template" className="btn-secondary btn-sm min-h-[44px]">
                Reset filter & pencarian
              </Link>
            }
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((t) => {
            const v = t.versiTerbaru;
            return (
              <Card
                key={t.id}
                variant={kelola ? "interactive" : "default"}
                href={kelola ? `/administrasi/template/${t.id}` : undefined}
                padding="md"
                className="flex min-w-0 flex-col"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="line-clamp-2 min-w-0 break-words text-sm font-bold leading-snug text-slate-900">{t.nama}</h2>
                  <span className={cn("chip shrink-0", t.aktif ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600")}>
                    {t.aktif ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                  {JENIS_DOKUMEN_LABEL[t.jenis as keyof typeof JENIS_DOKUMEN_LABEL] ?? t.jenis}
                </p>
                {t.deskripsi && <p className="mt-2 line-clamp-2 break-words text-xs leading-relaxed text-slate-600">{t.deskripsi}</p>}

                {v ? (
                  <dl className="mt-3 space-y-1 rounded-xl bg-slate-50 px-3 py-2.5 text-[11px]">
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="w-24 shrink-0 font-semibold text-slate-500">Versi terbaru</dt>
                      <dd className="min-w-0 flex-1 font-bold text-slate-800">v{v.nomor}</dd>
                    </div>
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="w-24 shrink-0 font-semibold text-slate-500">Format</dt>
                      <dd className="min-w-0 flex-1 text-slate-600">
                        {(v.namaAsli.split(".").pop() ?? "—").toUpperCase()} · {formatUkuran(v.ukuran)}
                      </dd>
                    </div>
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="w-24 shrink-0 font-semibold text-slate-500">Diperbarui</dt>
                      <dd className="min-w-0 flex-1 text-slate-600">{formatTanggal(v.createdAt)}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">
                    Belum ada file versi.
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    Template Resmi
                  </span>
                  {v ? (
                    <a
                      href={hrefUnduhVersiTemplate(v.id)}
                      aria-label={`Unduh template ${t.nama} versi ${v.nomor}`}
                      className={cn(
                        "inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2",
                        kelola
                          ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          : "bg-blue-700 text-white hover:bg-blue-800"
                      )}
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Unduh Template
                    </a>
                  ) : (
                    <span className="flex-1" />
                  )}
                  {kelola && (
                    <span className="text-[11px] font-semibold text-slate-400">{t.jumlahVersi} versi</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Alert variant="neutral" className="mx-1 text-[11px] text-slate-400">
        Template resmi bersifat referensi — dokumen pengajuan tetap dibuat melalui Ajukan Dokumen dan diperiksa Kamad.
      </Alert>
    </div>
  );
}
