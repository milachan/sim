import Link from "next/link";
import { FileQuestion } from "lucide-react";

// not-found Rumah Administrasi — pesan netral: tidak membuka apakah dokumen
// ada tetapi tidak boleh diakses.

export default function AdministrasiNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 ring-1 ring-inset ring-slate-200">
        <FileQuestion className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="mt-3 text-base font-extrabold text-slate-900">Dokumen atau halaman tidak ditemukan</h1>
      <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-500">
        Tautan mungkin salah, dokumen mungkin sudah dihapus, atau halaman tidak tersedia. Periksa kembali tautan Anda.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Link href="/administrasi" className="btn-primary min-h-[44px]">
          Ke Dashboard Administrasi
        </Link>
        <Link href="/administrasi/dokumen-saya" className="btn-secondary min-h-[44px]">
          Ke Dokumen Saya
        </Link>
      </div>
    </div>
  );
}
