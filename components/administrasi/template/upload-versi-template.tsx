"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UploadCloud } from "lucide-react";
import { formatUkuran } from "@/lib/administrasi/upload-helpers";

// Unggah versi baru template. Validasi server: PDF/DOC/DOCX/XLS/XLSX, maks 10 MB.
// Anti double-submit: input & tombol disabled saat pending. Storage key tidak
// pernah dikirim dari atau ditampilkan ke client.

const DITERIMA = ".pdf,.doc,.docx,.xls,.xlsx";

export default function UploadVersiTemplate({ templateId }: { templateId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sukses, setSukses] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function pilih(f: File | null) {
    setErr(null);
    setSukses(null);
    setFile(f);
  }

  function unggah() {
    if (!file || pending) return;
    setErr(null);
    setSukses(null);
    start(async () => {
      try {
        const fd = new FormData();
        fd.set("file", file);
        const res = await fetch(`/api/administrasi/template/${templateId}/upload`, {
          method: "POST",
          body: fd,
        });
        const data = (await res.json().catch(() => null)) as { error?: string; nomor?: number } | null;
        if (!res.ok) {
          setErr(data?.error ?? "Gagal mengunggah versi baru.");
          return;
        }
        setSukses(`Versi ${data?.nomor ?? ""} berhasil diunggah.`);
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      } catch {
        setErr("Gagal mengunggah versi baru.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={`file-template-${templateId}`} className="label">
          File template <span className="font-bold text-slate-500">(wajib)</span>
        </label>
        <input
          ref={inputRef}
          id={`file-template-${templateId}`}
          type="file"
          accept={DITERIMA}
          onChange={(e) => pilih(e.target.files?.[0] ?? null)}
          disabled={pending}
          className="input file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-slate-700"
          aria-describedby={`file-template-bantuan-${templateId}`}
        />
        <p id={`file-template-bantuan-${templateId}`} className="mt-1 text-xs text-slate-500">
          Format PDF, DOC, DOCX, XLS, atau XLSX. Maksimal 10 MB.
        </p>
      </div>

      {file && (
        <p className="break-words rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <span className="font-bold text-slate-800">{file.name}</span> · {formatUkuran(file.size)}
        </p>
      )}

      {err && (
        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          {err}
        </p>
      )}

      <button type="button" onClick={unggah} disabled={pending || !file} className="btn-primary w-full">
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Mengunggah…
          </>
        ) : (
          <>
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            Unggah Versi Baru
          </>
        )}
      </button>

      <p role="status" aria-live="polite" className={sukses ? "text-xs font-semibold text-emerald-700" : "sr-only"}>
        {sukses ?? (pending ? "Mengunggah versi baru…" : "")}
      </p>
      <p className="text-[11px] leading-relaxed text-slate-400">
        Setiap unggahan membuat versi baru. Versi lama tetap tersimpan dan dapat diunduh untuk audit.
      </p>
    </div>
  );
}
