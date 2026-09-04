import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, History, ShieldCheck, UploadCloud } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { bolehKelolaTemplate } from "@/lib/otorisasi";
import { JENIS_DOKUMEN_LABEL } from "@/lib/dokumen-validasi";
import { hrefUnduhVersiTemplate } from "@/lib/administrasi/template-validasi";
import { labelAksiTemplate } from "@/lib/administrasi/template-validasi";
import { formatUkuran, potongHash } from "@/lib/administrasi/upload-helpers";
import { formatTanggal } from "@/lib/utils";
import PageHeader from "@/components/ds/page-header";
import Card, { CardHeader } from "@/components/ds/card";
import Alert from "@/components/ds/alert";
import FormUbahTemplate from "@/components/administrasi/template/form-ubah-template";
import UploadVersiTemplate from "@/components/administrasi/template/upload-versi-template";
import { TombolAktifkanTemplate, TombolNonaktifkanTemplate } from "@/components/administrasi/template/aksi-status-template";
import { cn } from "@/lib/utils";
import type { JenisDokumen } from "@prisma/client";

// Detail pengelolaan template — HANYA ADMIN/SUPERADMIN (notFound bila lain,
// tanpa membocorkan keberadaan data).

export default async function DetailTemplatePage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!bolehKelolaTemplate(user)) notFound();

  const t = await prisma.templateDokumen.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      jenis: true,
      nama: true,
      deskripsi: true,
      aktif: true,
      createdAt: true,
      _count: { select: { versi: true } },
      versi: {
        orderBy: { nomor: "desc" },
        select: {
          id: true,
          nomor: true,
          namaAsli: true,
          mime: true,
          ukuran: true,
          sha256: true,
          dibuatOlehId: true,
          createdAt: true,
        },
      },
    },
  });
  if (!t) notFound();
  const tRiwayat = await prisma.riwayatTemplateDokumen.findMany({
    where: { templateId: t.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, aksi: true, aktorUserId: true, createdAt: true },
  });

  // Nama pengunggah/aktor (bukan ID internal) — satu query kumpulan.
  const idUser = new Set<string>();
  for (const v of t.versi) idUser.add(v.dibuatOlehId);
  for (const r of tRiwayat) idUser.add(r.aktorUserId);
  const users = idUser.size > 0
    ? await prisma.user.findMany({ where: { id: { in: [...idUser] } }, select: { id: true, nama: true } })
    : [];
  const namaUser = new Map(users.map((u) => [u.id, u.nama]));

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="flex min-h-[44px] items-center gap-1 text-sm font-bold text-slate-500">
        <Link href="/administrasi/template" className="rounded-xl px-1 transition-colors hover:text-slate-900">
          Template Dokumen
        </Link>
        <ChevronLeft className="hidden" aria-hidden="true" />
        <span aria-current="page" className="min-w-0 truncate text-slate-900">
          {t.nama}
        </span>      </nav>

      <PageHeader
        eyebrow="Pengelolaan Template"
        title={t.nama}
        subtitle={t.deskripsi ?? undefined}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        {/* Kolom utama */}
        <div className="order-1 min-w-0 space-y-4 lg:order-none lg:col-start-1 lg:row-start-1">
          <Card padding="lg">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("chip", t.aktif ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600")}>
                {t.aktif ? "Aktif" : "Nonaktif"}
              </span>
              <span className="chip bg-slate-100 text-slate-600">{JENIS_DOKUMEN_LABEL[t.jenis as JenisDokumen]}</span>
              <span className="chip bg-slate-100 text-slate-600">{t._count.versi} versi</span>
            </div>
            <div className="mt-4">
              <CardHeader title="Ubah metadata" description="Nama dan deskripsi tampil pada katalog guru." />
              <div className="mt-3">
                <FormUbahTemplate id={t.id} awal={{ nama: t.nama, deskripsi: t.deskripsi }} />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <UploadCloud className="h-4 w-4 text-blue-700" aria-hidden="true" />
                  Unggah versi baru
                </span>
              }
              description="Setiap unggahan membuat nomor versi baru. Versi dengan nomor tertinggi menjadi versi yang diunduh guru."
            />
            <div className="mt-3">
              <UploadVersiTemplate templateId={t.id} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Riwayat versi" description="Terbaru ke terlama. Semua versi dapat diunduh untuk audit." />
            {t.versi.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">Belum ada versi file.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {t.versi.map((v, i) => (
                  <li key={v.id} className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                      <span className="font-extrabold text-slate-900">
                        v{v.nomor}
                        {i === 0 && (
                          <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">
                            Versi terbaru
                          </span>
                        )}
                      </span>
                      <a
                        href={hrefUnduhVersiTemplate(v.id)}
                        aria-label={`Unduh versi ${v.nomor}`}
                        className="text-[11px] font-bold text-blue-700 hover:text-blue-900"
                      >
                        Unduh
                      </a>
                    </div>
                    <p className="mt-1 break-words text-slate-700">{v.namaAsli}</p>
                    <p className="mt-0.5 text-slate-500">
                      {(v.namaAsli.split(".").pop() ?? "—").toUpperCase()} · {formatUkuran(v.ukuran)} · checksum{" "}
                      <span className="break-all font-mono">{potongHash(v.sha256, 16)}</span>
                    </p>
                    <p className="mt-0.5 text-slate-400">
                      Diunggah {formatTanggal(v.createdAt, "d MMM yyyy, HH:mm")} oleh{" "}
                      {namaUser.get(v.dibuatOlehId) ?? "—"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <History className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  Audit aktivitas
                </span>
              }
            />
            <ol className="mt-3 space-y-2">
              {tRiwayat.map((r) => {
                const { label } = labelAksiTemplate(r.aksi);
                return (
                  <li key={r.id} className="rounded-xl bg-slate-50 px-3 py-2 text-xs">
                    <span className="font-bold text-slate-800">{label}</span>
                    <span className="block text-[11px] text-slate-400">
                      {formatTanggal(r.createdAt, "d MMM yyyy, HH:mm")} · {namaUser.get(r.aktorUserId) ?? "—"}
                    </span>
                  </li>
                );
              })}
              {tRiwayat.length === 0 && <li className="text-xs text-slate-500">Belum ada aktivitas.</li>}
            </ol>
          </Card>
        </div>

        {/* Panel status & aksi */}
        <aside className="order-2 min-w-0 space-y-4 lg:sticky lg:top-6 lg:order-none lg:col-start-2 lg:row-start-1 lg:self-start" aria-label="Status template">
          <Card variant="outline" className={t.aktif ? "border-emerald-200" : undefined}>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <ShieldCheck className={cn("h-4 w-4", t.aktif ? "text-emerald-600" : "text-slate-400")} aria-hidden="true" />
                  Status template
                </span>
              }
              description={
                t.aktif
                  ? "Template tampil di katalog guru dan dapat diunduh (versi terbaru)."
                  : "Template disembunyikan dari katalog guru."
              }
            />
            <div className="mt-3 space-y-3">
              <TombolAktifkanTemplate id={t.id} jumlahVersi={t._count.versi} />
              {t.aktif && <TombolNonaktifkanTemplate id={t.id} />}
            </div>
          </Card>

          <Alert variant="neutral" className="text-[11px] text-slate-400">
            Status badge mengikuti makna status: aktif emerald, nonaktif netral. Template resmi bukan dokumen pengajuan
            dan tidak terkait alur pemeriksaan Kamad.
          </Alert>
        </aside>
      </div>
    </div>
  );
}
