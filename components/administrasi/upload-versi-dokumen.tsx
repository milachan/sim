"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, X } from "lucide-react";
import { ACCEPT_DOKUMEN, formatUkuran } from "@/lib/administrasi/upload-helpers";

const MAKS = 10 * 1024 * 1024;

function pesanRamah(status: number, body: string): string {
  if (status === 401) return "Sesi habis. Silakan login ulang.";
  if (status === 413) return body || "File terlalu besar. Maksimal 10 MB.";
  if (status === 409) return body || "Dokumen sudah terkunci dan tidak dapat diunggah versi baru.";
  if (status === 400) return body || "Format tidak didukung atau isi file tidak sesuai.";
  if (status >= 500) return "Gangguan server. Coba lagi nanti.";
  return body || "Gagal mengunggah file.";
}

export default function UploadVersiDokumen({ dokumenId }: { dokumenId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [sukses, setSukses] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onPick = (f: File | null) => {
    setSukses(null);
    setError(null);
    if (!f) { setFile(null); return; }
    if (f.size === 0) { setError("File kosong."); setFile(null); return; }
    if (f.size > MAKS) { setError("File terlalu besar. Maksimal 10 MB."); setFile(null); return; }
    setFile(f);
  };

  const onSubmit = async () => {
    if (!file || pending) return;
    setPending(true);
    setError(null);
    setSukses(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/administrasi/dokumen/${dokumenId}/upload`, { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(pesanRamah(res.status, body.error ?? body.message ?? ""));
        return;
      }
      setSukses("Versi baru berhasil diunggah.");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch {
      setError("Gangguan jaringan. Coba lagi.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label htmlFor="file-versi" className="block text-sm font-extrabold text-slate-900">Pilih file</label>
        <p className="mt-0.5 text-xs text-slate-500">PDF, DOC, DOCX, XLS, XLSX — maksimal 10 MB per file.</p>
        <input
          ref={inputRef}
          id="file-versi"
          type="file"
          accept={ACCEPT_DOKUMEN}
          aria-label="Pilih file dokumen"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          className="mt-2 block w-full min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-white hover:file:bg-black"
        />
        {file && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
            <span className="truncate font-semibold text-slate-700">{file.name}</span>
            <span className="shrink-0 text-slate-500">{formatUkuran(file.size)}</span>
            <button type="button" aria-label="Hapus pilihan" onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ""; }} className="shrink-0 rounded-full p-1 hover:bg-slate-200">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={onSubmit}
          disabled={!file || pending}
          aria-busy={pending}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-black disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {pending ? "Mengunggah..." : "Unggah Versi"}
        </button>
        {sukses && <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{sukses}</p>}
        {error && <p role="alert" className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}
      </div>
    </div>
  );
}
