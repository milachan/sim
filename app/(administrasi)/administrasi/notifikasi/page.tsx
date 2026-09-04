import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Bell, CheckCircle2, Inbox } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import {
  daftarNotifikasiUser,
  jumlahNotifikasiBelumDibaca,
} from "@/lib/administrasi/notifikasi";
import {
  ikonJenisNotifikasi,
  LABEL_FILTER_NOTIFIKASI,
  labelStatusDibaca,
  opsiFilterNotifikasi,
} from "@/lib/administrasi/notifikasi-ui";
import PageHeader from "@/components/ds/page-header";
import Card from "@/components/ds/card";
import FilterTabs from "@/components/ds/filter-tabs";
import EmptyState from "@/components/ds/empty-state";
import Alert from "@/components/ds/alert";
import TombolTandaiSemua from "@/components/administrasi/tombol-tandai-semua";

export const metadata: Metadata = { title: "Pusat Notifikasi" };

const BATAS_DAFTAR = 50;

// Pusat notifikasi Administrasi: hanya milik session user, filter
// diproses server-side lewat searchParams, daftar dibatasi 50 terbaru.
export default async function NotifikasiPage({
  searchParams,
}: {
  searchParams?: { f?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Nilai asing kembali konsisten ke "semua" (helper dites).
  const filter = opsiFilterNotifikasi(searchParams?.f);

  const [rows, unread] = await Promise.all([
    daftarNotifikasiUser(user.id, {
      batas: BATAS_DAFTAR,
      ...(filter !== "semua" ? { status: filter } : {}),
    }),
    jumlahNotifikasiBelumDibaca(user.id),
  ]);

  const tabItems = LABEL_FILTER_NOTIFIKASI.map((f) => ({
    nilai: f.nilai,
    label: f.label,
    href: f.nilai === "semua" ? "/administrasi/notifikasi" : `/administrasi/notifikasi?f=${f.nilai}`,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pusat Notifikasi"
        subtitle="Pemberitahuan dokumen administrasi madrasah milik Anda."
        icon={Bell}
        breadcrumb={[{ href: "/administrasi", label: "Dashboard" }, { label: "Notifikasi" }]}
        actions={<TombolTandaiSemua jumlah={unread} />}
      />

      <FilterTabs items={tabItems} aktif={filter} label="Filter notifikasi" />

      {unread > 0 && (
        <Alert variant="info" title={`${unread} notifikasi belum dibaca.`}>
          Buka dokumen terkait untuk menandainya sudah dibaca.
        </Alert>
      )}

      {rows.length === 0 ? (
        filter === "belum" ? (
          <EmptyState
            icon={CheckCircle2}
            variant="success"
            title="Tidak ada notifikasi belum dibaca"
            description="Semua notifikasi Anda sudah dibaca."
          />
        ) : filter === "sudah" ? (
          <EmptyState
            icon={Inbox}
            variant="filter"
            title="Belum ada notifikasi yang sudah dibaca"
            description="Notifikasi akan berpindah ke sini setelah Anda membuka dokumennya."
          />
        ) : (
          <EmptyState
            icon={Bell}
            variant="default"
            title="Belum ada notifikasi"
            description="Notifikasi dokumen (kirim, revisi, persetujuan, finalisasi) akan muncul di sini."
          />
        )
      ) : (
        <ul className="space-y-2.5">
          {rows.map((n) => {
            const Ikon = ikonJenisNotifikasi(n.jenis);
            const sudahDibaca = n.dibacaPada != null;
            return (
              <li key={n.id}>
                <Card
                  variant="outline"
                  padding="md"
                  className={cn(!sudahDibaca && "border-l-4 border-l-accent")}
                >
                  <div className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
                        sudahDibaca
                          ? "bg-slate-50 text-slate-400 ring-slate-200"
                          : "bg-accent-soft text-accent-foreground ring-accent-border"
                      )}
                    >
                      <Ikon className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h2 className="text-sm font-extrabold text-slate-900">{n.judul}</h2>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ring-1 ring-inset",
                            sudahDibaca
                              ? "bg-slate-100 text-slate-500 ring-slate-200"
                              : "bg-accent-soft text-accent-foreground ring-accent-border"
                          )}
                        >
                          {labelStatusDibaca(n.dibacaPada)}
                        </span>
                      </div>
                      <p className="mt-0.5 break-words text-xs leading-relaxed text-slate-600">{n.isi}</p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-400">
                        <time dateTime={new Date(n.createdAt).toISOString()}>
                          {new Date(n.createdAt).toLocaleString("id-ID")}
                        </time>
                      </p>
                      <div className="mt-2.5">
                        <Link
                          href={`/administrasi/notifikasi/${n.id}/buka`}
                          className={cn(
                            "inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-offset-2",
                            sudahDibaca
                              ? "border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                              : "bg-accent-soft text-accent-foreground hover:bg-accent hover:text-white"
                          )}
                        >
                          Buka Dokumen
                          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
