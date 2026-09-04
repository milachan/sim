import { redirect } from "next/navigation";
import { BadgeCheck, BookOpen, GraduationCap, KeyRound, ShieldCheck, User as UserIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, ErrorBanner, InfoRow, PageHeader, SuksesBanner } from "@/components/ui";
import { RoleBadge } from "@/components/status-badge";
import { inisial } from "@/lib/utils";
import { PushNotifikasiCard } from "@/components/push-notifikasi";
import { GantiPasswordCard } from "@/components/profil/ganti-password-card";

export const dynamic = "force-dynamic";

export default async function ProfilPage({
  searchParams,
}: {
  searchParams: { sukses?: string; error?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const jurnalTerkirim = await prisma.jurnal.count({ where: { status: "TERKIRIM", pertemuan: { OR: user.guruId ? [{ jadwal: { guruId: user.guruId } }, { dibuatOlehId: user.id }] : [{ dibuatOlehId: user.id }] } } });
  // Kegiatan penilaian hanya relevan untuk akun yang terhubung ke guru.
  // Untuk role non-guru (Kamad/Waka/Admin) tampilkan "-" — bukan total seluruh sekolah.
  const kegiatanCount = user.guruId
    ? await prisma.penilaianKegiatan.count({ where: { jadwal: { guruId: user.guruId } } })
    : null;

  const permintaan = await prisma.passwordChangeRequest.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  const adaPending = permintaan?.status === "PENDING";

  return (
    <div className="fade-up">
      <PageHeader title="Profil Saya" subtitle="Informasi akun dan data mengajar" icon={<UserIcon className="h-6 w-6" />} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="card-pad lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-2xl font-extrabold text-white shadow-lg">
              {inisial(user.nama)}
            </div>
            <h2 className="mt-3 text-lg font-extrabold text-slate-900">{user.nama}</h2>
            <p className="mt-1 text-sm text-slate-500">@{user.username}</p>
            <div className="mt-2"><RoleBadge role={user.role} /></div>
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4">
            <InfoRow label="Status Akun" value={<span className="flex items-center gap-1 font-bold text-emerald-600"><BadgeCheck className="h-4 w-4" /> Aktif</span>} />
            <InfoRow label="Dibuat" value={new Date(user.createdAt).toLocaleDateString("id-ID")} />
          </div>
        </Card>

        <Card className="card-pad lg:col-span-2">
          <h3 className="mb-4 flex items-center gap-2 font-extrabold text-slate-900">
            <GraduationCap className="h-5 w-5 text-emerald-600" /> Data Mengajar
          </h3>
          {user.guru ? (
            <>
              <InfoRow label="Nama" value={user.guru.nama} strong />
              <InfoRow label="NIP / NUPTK" value={user.guru.nip ?? "-"} />
              <InfoRow label="Status Guru" value={user.guru.status ? "Aktif" : "Nonaktif"} />
              <InfoRow label="Wali Kelas" value={user.guru.waliKelas.length ? user.guru.waliKelas.map((k) => k.nama).join(", ") : "-"} />
              <InfoRow
                label="Mapel Diampu"
                value={
                  <span className="flex flex-wrap justify-end gap-1">
                    {user.guru.mapelDiampu.length ? user.guru.mapelDiampu.map((m) => <span key={m.id} className="chip bg-emerald-50 text-emerald-700">{m.nama}</span>) : "-"}
                  </span>
                }
              />
            </>
          ) : (
            <p className="text-sm text-slate-500">Akun ini tidak terhubung ke data guru.</p>
          )}
        </Card>

        <Card className="card-pad lg:col-span-3">
          <h3 className="mb-3 flex items-center gap-2 font-extrabold text-slate-900">
            <KeyRound className="h-5 w-5 text-emerald-600" /> Ganti Password
          </h3>
          <SuksesBanner message={searchParams.sukses} />
          {permintaan && permintaan.status !== "PENDING" && (
            <div className={`mb-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${permintaan.status === "APPROVED" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-bold">
                  Permintaan terakhir: {permintaan.status === "APPROVED" ? "Disetujui" : "Ditolak"}
                </p>
                {permintaan.catatanAdmin && (
                  <p className="mt-0.5">Catatan admin: {permintaan.catatanAdmin}</p>
                )}
                {permintaan.resolvedAt && (
                  <p className="mt-0.5 text-[11px] opacity-70">
                    {new Date(permintaan.resolvedAt).toLocaleString("id-ID")}
                  </p>
                )}
              </div>
            </div>
          )}
          <ErrorBanner message={searchParams.error} />
          <GantiPasswordCard adaPending={adaPending} />
        </Card>

        <div className="lg:col-span-3">
          <PushNotifikasiCard />
        </div>

        <Card className="card-pad lg:col-span-3">
          <h3 className="mb-4 flex items-center gap-2 font-extrabold text-slate-900">
            <BookOpen className="h-5 w-5 text-emerald-600" /> Statistik Aktivitas
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Jurnal Terkirim", value: jurnalTerkirim },
              { label: "Kegiatan Penilaian", value: kegiatanCount ?? "-" },
              { label: "Peran Akses", value: <span className="text-base"><KeyRound className="mr-1 inline h-4 w-4 text-emerald-500" />Sesuai menu</span> },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-slate-50 p-4 text-center">
                <p className="text-2xl font-extrabold text-slate-900">{s.value}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
