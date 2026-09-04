import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, FileCheck2, SearchX, SlidersHorizontal } from "lucide-react";
import type { StatusDokumen } from "@prisma/client";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { adalahPemeriksaDokumen } from "@/lib/otorisasi";
import { JENIS_DOKUMEN_LABEL } from "@/lib/dokumen-validasi";
import {
  bangunWhereArsip,
  daftarTahunArsip,
  hitungStatistikArsip,
  opsiJenisArsip,
  opsiMilikArsip,
  opsiTahunArsip,
} from "@/lib/administrasi/arsip";
import { hrefUnduhVersi } from "@/lib/administrasi/pemeriksaan";
import PageHeader from "@/components/ds/page-header";
import StatCard from "@/components/ds/stat-card";
import KartuArsip from "@/components/administrasi/kartu-arsip";
import EmptyState from "@/components/ds/empty-state";
import Alert from "@/components/ds/alert";

const BATAS_ARSIP = 100;

export default async function ArsipPage({
  searchParams,
}: {
  searchParams?: { q?: string; jenis?: string; tahun?: string; milik?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const isPemeriksa = adalahPemeriksaDokumen(user.role);

  // Filter asing kembali ke nilai aman (helper dites).
  const tahunIni = new Date().getUTCFullYear();
  const q = (searchParams?.q ?? "").trim() || null;
  const jenis = opsiJenisArsip(searchParams?.jenis ?? null);
  const tahun = opsiTahunArsip(searchParams?.tahun ?? null, tahunIni);
  const milik = opsiMilikArsip(searchParams?.milik ?? null);

  const where = bangunWhereArsip(user.id, isPemeriksa, { q, jenis, tahun, milik });

  const [rows, statRows] = await Promise.all([
    prisma.dokumen.findMany({
      where,
      orderBy: { dokumenFinal: { difinalkanPada: "desc" } },
      take: BATAS_ARSIP,
      select: {
        id: true,
        judul: true,
        jenis: true,
        status: true,
        pengajuUserId: true,
        dokumenFinal: {
          select: {
            versiId: true,
            nomorVersi: true,
            namaAsli: true,
            mime: true,
            ukuran: true,
            sha256: true,
            kodeVerifikasi: true,
            difinalkanPada: true,
            difinalkanOlehId: true,
          },
        },
      },
    }),
    // Statistik nyata dari scope yang sama (tanpa filter pencarian agar tetap ringkas).
    prisma.dokumen.findMany({
      where: bangunWhereArsip(user.id, isPemeriksa, { q: null, jenis: null, tahun: null, milik }),
      select: { status: true, jenis: true, pengajuUserId: true, dokumenFinal: { select: { difinalkanPada: true } } },
    }),
  ]);

  const stat = hitungStatistikArsip(
    statRows.map((r) => ({
      status: r.status as StatusDokumen,
      jenis: r.jenis,
      pengajuUserId: r.pengajuUserId,
      difinalkanPada: r.dokumenFinal?.difinalkanPada ?? new Date(0),
    })),
    tahunIni
  );

  // Nama pengaju & finalisator dalam satu query (tanpa N+1); tidak pernah tampilkan ID.
  const idUser = new Set<string>();
  for (const r of rows) {
    if (isPemeriksa) idUser.add(r.pengajuUserId);
    if (r.dokumenFinal) idUser.add(r.dokumenFinal.difinalkanOlehId);
  }
  const users = idUser.size > 0
    ? await prisma.user.findMany({ where: { id: { in: [...idUser] } }, select: { id: true, nama: true } })
    : [];
  const namaUser = new Map(users.map((u) => [u.id, u.nama]));

  const belumAdaArsip = stat.total === 0;
  const tanpaHasilFilter = rows.length === 0 && !belumAdaArsip;
  const filterAktif = Boolean(q || jenis || tahun || (isPemeriksa && milik === "saya"));

  const labelStatKeempat = isPemeriksa ? "Seluruh Madrasah" : "Milik Saya";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Arsip & Referensi"
        title="Arsip Dokumen"
        subtitle="Dokumen administrasi yang sudah dikunci sebagai versi final. Arsip bersifat baca — perubahan dilakukan melalui pengajuan baru."
      />

      {/* Statistik nyata */}
      <section aria-label="Ringkasan arsip">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Dokumen Final" value={stat.total} icon={FileCheck2} tone="emerald" />
          <StatCard label={`Difinalkan ${tahunIni}`} value={stat.tahunIni} icon={Archive} tone="blue" />
          <StatCard label="Jenis Dokumen" value={stat.jumlahJenis} icon={SlidersHorizontal} tone="slate" />
          <StatCard label={labelStatKeempat} value={stat.total} icon={Archive} tone={isPemeriksa ? "violet" : "slate"} />
        </div>
      </section>

      {/* Filter */}
      <section aria-label="Filter arsip">
        <form method="get" action="/administrasi/arsip" className="rounded-[var(--card-radius)] border border-[hsl(var(--card-border)/0.8)] bg-[hsl(var(--card-bg))] p-4 shadow-[var(--card-shadow)]">
          <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-slate-400">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            Filter
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="q-arsip" className="label">Cari judul</label>
              <input id="q-arsip" type="search" name="q" defaultValue={q ?? ""} placeholder="Judul dokumen…" autoComplete="off" className="input" />
            </div>
            <div>
              <label htmlFor="jenis-arsip" className="label">Jenis dokumen</label>
              <select id="jenis-arsip" name="jenis" defaultValue={jenis ?? ""} className="input">
                <option value="">Semua jenis</option>
                {Object.entries(JENIS_DOKUMEN_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="tahun-arsip" className="label">Tahun finalisasi</label>
              <select id="tahun-arsip" name="tahun" defaultValue={tahun ?? ""} className="input">
                <option value="">Semua tahun</option>
                {daftarTahunArsip(tahunIni).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            {isPemeriksa && (
              <div>
                <label htmlFor="milik-arsip" className="label">Kepemilikan</label>
                <select id="milik-arsip" name="milik" defaultValue={milik} className="input">
                  <option value="semua">Semua</option>
                  <option value="saya">Milik Saya</option>
                </select>
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="submit" className="btn-primary btn-sm min-h-[44px]">
              Terapkan
            </button>
            {filterAktif && (
              <Link href="/administrasi/arsip" className="btn-secondary btn-sm min-h-[44px]">
                Reset
              </Link>
            )}
            <span className="text-xs text-slate-400">
              {rows.length >= BATAS_ARSIP ? `${BATAS_ARSIP}+` : rows.length} dokumen
            </span>
          </div>
        </form>
      </section>

      {/* Daftar arsip */}
      {rows.length === 0 ? (
        belumAdaArsip ? (
          isPemeriksa ? (
            <EmptyState
              icon={Archive}
              title="Belum ada dokumen final"
              description="Dokumen yang telah difinalkan Kamad akan muncul di sini sebagai arsip resmi madrasah."
              variant="success"
            />
          ) : (
            <EmptyState
              icon={Archive}
              title="Belum ada dokumen final milik Anda"
              description="Dokumen Anda yang telah disetujui dan difinalkan Kamad akan tersimpan di arsip ini."
              variant="success"
              action={
                <Link href="/administrasi/baru" className="btn-primary btn-sm min-h-[44px]">
                  Ajukan Dokumen
                </Link>
              }
            />
          )
        ) : tanpaHasilFilter ? (
          <EmptyState
            icon={SearchX}
            variant="filter"
            title="Tidak ada dokumen yang cocok"
            description="Tidak ada arsip yang cocok dengan filter saat ini."
            action={
              <Link href="/administrasi/arsip" className="btn-secondary btn-sm min-h-[44px]">
                Reset filter
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={FileCheck2}
            title="Belum tersedia untuk Anda"
            description="Arsip pada filter ini belum dapat ditampilkan."
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => {
            const f = r.dokumenFinal;
            if (!f) return null;
            return (
              <KartuArsip
                key={r.id}
                href={isPemeriksa ? `/administrasi/kotak-masuk/${r.id}` : `/administrasi/${r.id}`}
                unduhHref={hrefUnduhVersi(f.versiId)}
                judul={r.judul}
                jenisLabel={JENIS_DOKUMEN_LABEL[r.jenis as keyof typeof JENIS_DOKUMEN_LABEL] ?? r.jenis}
                status={r.status as StatusDokumen}
                pengajuNama={isPemeriksa ? namaUser.get(r.pengajuUserId) ?? "—" : null}
                nomorVersi={f.nomorVersi}
                namaFile={f.namaAsli}
                mime={f.mime}
                ukuran={f.ukuran}
                sha256={f.sha256}
                kodeVerifikasi={f.kodeVerifikasi}
                difinalkanPada={f.difinalkanPada}
                finalisatorNama={namaUser.get(f.difinalkanOlehId) ?? null}
              />
            );
          })}
        </div>
      )}

      <Alert variant="neutral" className="mx-1 text-[11px] text-slate-400">
        Kode verifikasi belum memiliki halaman verifikasi publik. Arsip ini merupakan penguncian internal dokumen dan
        belum merupakan Tanda Tangan Elektronik tersertifikasi.
      </Alert>
    </div>
  );
}



