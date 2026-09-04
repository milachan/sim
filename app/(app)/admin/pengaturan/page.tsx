import { MessageCircle, Settings } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, ErrorBanner, PageHeader, SuksesBanner } from "@/components/ui";
import { formPengaturan, formPengaturanWhatsApp } from "@/lib/actions/admin-forms";
import { PushAdminPanel } from "@/components/push-notifikasi";
import { WhatsAppAdminPanel } from "@/components/whatsapp-panel";

export const dynamic = "force-dynamic";

export default async function PengaturanPage({ searchParams }: { searchParams: { sukses?: string; error?: string } }) {
  await getCurrentUser();
  const settings = await prisma.setting.findMany();
  const get = (key: string, fallback: string) => settings.find((s) => s.key === key)?.value ?? fallback;

  return (
    <div className="fade-up">
      <PageHeader title="Pengaturan Sistem" subtitle="Konfigurasi identitas aplikasi & pengingat" icon={<Settings className="h-6 w-6" />} />
      <SuksesBanner message={searchParams.sukses} />
      <ErrorBanner message={searchParams.error} />

      <Card className="card-pad max-w-2xl">
        <form action={formPengaturan} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Nama Aplikasi</label>
            <input className="input" name="namaAplikasi" defaultValue={get("nama_aplikasi", "Sistem Administrasi Guru")} />
          </div>
          <div>
            <label className="label">Nama Sekolah</label>
            <input className="input" name="namaSekolah" defaultValue={get("nama_sekolah", "MTs Negeri 2 Kebumen")} />
          </div>
          <div>
            <label className="label">Jam Sekolah Selesai (untuk reminder)</label>
            <input type="time" className="input" name="jamSelesai" defaultValue={get("jam_sekolah_selesai", "15:00")} />
          </div>
          <div>
            <label className="label">Batas Tanggal Laporan Bulanan</label>
            <input type="number" min={1} max={28} className="input" name="batasLaporan" defaultValue={get("batas_laporan_bulanan", "5")} />
          </div>
          <div className="sm:col-span-2">
            <button className="btn-primary">Simpan Pengaturan</button>
          </div>
        </form>
      </Card>

      <Card className="card-pad mt-6 max-w-2xl">
        <h3 className="mb-4 flex items-center gap-2 font-extrabold text-slate-900">
          <MessageCircle className="h-4 w-4 text-emerald-600" /> Notifikasi WhatsApp
        </h3>
        <form action={formPengaturanWhatsApp} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Token API Fonnte</label>
            <input type="password" className="input" name="waToken" defaultValue={get("wa_token", "")} placeholder="masukkan token dari dashbom Fonnte (…)" autoComplete="off" />
            <p className="mt-1 text-xs text-slate-400">
              Daftar di <span className="font-semibold">fonnte.com</span> → buat device → salin token. Bisa juga lewat env <code className="rounded bg-slate-100 px-1">WA_TOKEN</code>.
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" name="waAktif" value="1" defaultChecked={get("wa_aktif", "0") === "1"} className="h-4 w-4 accent-emerald-600" />
              Aktifkan pengingat WhatsApp otomatis
            </label>
          </div>
          <div className="sm:col-span-2">
            <button className="btn-primary">Simpan Pengaturan WhatsApp</button>
          </div>
        </form>
      </Card>

      <div className="mt-6 max-w-2xl space-y-6">
        <PushAdminPanel />
        <WhatsAppAdminPanel />
      </div>
    </div>
  );
}
