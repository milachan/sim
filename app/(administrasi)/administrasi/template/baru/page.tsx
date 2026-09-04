import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { bolehKelolaTemplate } from "@/lib/otorisasi";
import PageHeader from "@/components/ds/page-header";
import Card from "@/components/ds/card";
import Alert from "@/components/ds/alert";
import FormTemplateBaru from "@/components/administrasi/template/form-template-baru";

// Halaman pembuatan template — HANYA ADMIN/SUPERADMIN.
// Role lain diarahkan ke katalog tanpa membocorkan keberadaan route.

export default async function TemplateBaruPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!bolehKelolaTemplate(user)) notFound();

  return (
    <div className="space-y-4">
      <Link
        href="/administrasi/template"
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-1 text-sm font-bold text-slate-600 transition-colors hover:text-slate-900"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Kembali ke Katalog Template
      </Link>

      <PageHeader
        eyebrow="Pengelolaan Template"
        title="Tambah Template"
        subtitle="Buat metadata template resmi. Template tersimpan nonaktif — unggah file resmi di halaman detail, baru kemudian aktifkan."
      />

      <Card padding="lg" className="mx-auto w-full max-w-2xl">
        <FormTemplateBaru />
      </Card>

      <Alert variant="info" className="mx-auto max-w-2xl">
        Template harus memiliki minimal satu file sebelum dapat diaktifkan. Setelah tersimpan, Anda akan diarahkan ke
        halaman detail untuk mengunggah file.
      </Alert>
    </div>
  );
}
