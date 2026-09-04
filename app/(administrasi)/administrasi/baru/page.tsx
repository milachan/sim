import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileText, Send, UploadCloud } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { bolehMengajukanDokumen } from "@/lib/otorisasi";
import { FormBuatDokumen } from "@/components/administrasi/dokumen-forms";
import PageHeader from "@/components/ds/page-header";
import Alert from "@/components/ds/alert";
import { cn } from "@/lib/utils";

// Halaman pengajuan dokumen baru. Hanya langkah 1 yang aktif:
// setelah draf tersimpan, pengguna diarahkan ke detail dokumen
// untuk unggah file (langkah 2) lalu mengirim (langkah 3).
//
// Guard server-side: KEPALA/ADMIN/SUPERADMIN dialihkan ke dashboard
// dengan info bahwa alur pengajuan pribadi tidak tersedia untuk mereka.

const LANGKAH_PENGAJUAN = [
  { nomor: 1 as const, label: "Informasi", icon: FileText, aktif: true },
  { nomor: 2 as const, label: "Unggah file", icon: UploadCloud, aktif: false },
  { nomor: 3 as const, label: "Kirim ke Kamad", icon: Send, aktif: false },
];

export default async function AjukanDokumenPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!bolehMengajukanDokumen(user)) {
    redirect("/administrasi?info=pengajuan-tidak-tersedia");
  }

  return (
    <div className="space-y-5">
      <Link
        href="/administrasi"
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-1 text-sm font-bold text-slate-600 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Kembali ke Dashboard
      </Link>

      <PageHeader
        eyebrow="Rumah Administrasi"
        title="Ajukan Dokumen Baru"
        subtitle="Isi informasi dasar dokumen. Tahap pertama otomatis tersimpan sebagai draf milik Anda — file PDF dan pengiriman ke Kamad menyusul di halaman detail dokumen."
      />

      {/* Indikator proses — hanya langkah 1 yang aktif */}
      <nav aria-label="Proses pengajuan dokumen" aria-current="step">
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {LANGKAH_PENGAJUAN.map((l) => (
            <li
              key={l.nomor}
              className={cn(
                "flex min-h-[44px] items-center gap-2.5 rounded-xl border px-3 py-2",
                l.aktif ? "border-blue-200 bg-blue-50" : "border-dashed border-slate-200 bg-white"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                  l.aktif ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-400"
                )}
                aria-hidden="true"
              >
                {l.aktif ? <CheckCircle2 className="h-4 w-4" /> : l.nomor}
              </span>
              <span className="min-w-0">
                <span className={cn("block truncate text-sm font-bold", l.aktif ? "text-blue-900" : "text-slate-400")}>
                  {l.label}
                </span>
                <span className={cn("block text-[10px] font-semibold uppercase tracking-widest", l.aktif ? "text-blue-600" : "text-slate-300")}>
                  Langkah {l.nomor}
                  {l.aktif && " — sekarang"}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </nav>

      {/* Formulir pada card dengan lebar baca nyaman */}
      <section className="card card-pad fade-up mx-auto w-full max-w-2xl">
        <h2 className="text-sm font-extrabold text-slate-900">Informasi dokumen</h2>
        <p className="mt-1 text-xs text-slate-500">Semua kolom pada tahap ini akan tersimpan sebagai Draf.</p>
        <div className="mt-4">
          <FormBuatDokumen />
        </div>
      </section>

      <Alert variant="neutral" className="mx-auto max-w-2xl">
        Unggah file dilakukan setelah draf tercipta, di halaman detail dokumen.
      </Alert>
    </div>
  );
}
