"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { buatTemplate } from "@/lib/actions/template";
import { BATAS_NAMA_TEMPLATE } from "@/lib/administrasi/template-validasi";
import { JENIS_DOKUMEN_LABEL } from "@/lib/dokumen-validasi";
import type { JenisDokumen } from "@prisma/client";

// Form pembuatan template — disimpan NONAKTIF; file diunggah di halaman detail.

export default function FormTemplateBaru() {
  const router = useRouter();
  const [nama, setNama] = useState("");
  const [jenis, setJenis] = useState<JenisDokumen>("DOKUMEN_UMUM");
  const [deskripsi, setDeskripsi] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        start(async () => {
          try {
            const r = await buatTemplate({ nama, jenis, deskripsi: deskripsi || null });
            if (!r.ok) {
              setErr(r.error);
              return;
            }
            router.push(`/administrasi/template/${r.id}`);
          } catch {
            setErr("Gagal menyimpan template.");
          }
        });
      }}
      autoComplete="off"
      className="space-y-4"
    >
      <div>
        <label htmlFor="nama-template" className="label">
          Nama template <span className="font-bold text-slate-500">(wajib)</span>
        </label>
        <input
          id="nama-template"
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          maxLength={BATAS_NAMA_TEMPLATE}
          required
          autoComplete="off"
          className="input"
          placeholder="Contoh: Template Proposal Kegiatan Resmi"
          aria-describedby="nama-template-bantuan"
        />
        <p id="nama-template-bantuan" className="mt-1 text-xs text-slate-500">
          Nama yang dilihat guru pada katalog template.
        </p>
      </div>

      <div>
        <label htmlFor="jenis-template" className="label">
          Jenis dokumen <span className="font-bold text-slate-500">(wajib)</span>
        </label>
        <select
          id="jenis-template"
          value={jenis}
          onChange={(e) => setJenis(e.target.value as JenisDokumen)}
          className="input"
          aria-describedby="jenis-template-bantuan"
        >
          {(Object.keys(JENIS_DOKUMEN_LABEL) as JenisDokumen[]).map((k) => (
            <option key={k} value={k}>{JENIS_DOKUMEN_LABEL[k]}</option>
          ))}
        </select>
        <p id="jenis-template-bantuan" className="mt-1 text-xs text-slate-500">
          Template tampil pada jenis dokumen yang dipilih.
        </p>
      </div>

      <div>
        <label htmlFor="deskripsi-template" className="label">
          Deskripsi <span className="text-xs font-semibold text-slate-400">(opsional)</span>
        </label>
        <textarea
          id="deskripsi-template"
          value={deskripsi}
          onChange={(e) => setDeskripsi(e.target.value)}
          maxLength={2000}
          rows={3}
          className="input"
          placeholder="Penjelasan singkat kegunaan template…"
          aria-describedby="deskripsi-template-bantuan"
        />
        <p id="deskripsi-template-bantuan" className="mt-1 text-xs text-slate-500">
          Maksimal 2000 karakter.
        </p>
      </div>

      {err && (
        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {err}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Menyimpan…
          </>
        ) : (
          "Simpan Template"
        )}
      </button>

      <p role="status" aria-live="polite" className="sr-only">
        {pending ? "Menyimpan template…" : ""}
      </p>
      <p className="text-[11px] leading-relaxed text-slate-400">
        Template tersimpan sebagai nonaktif. Unggah file resmi terlebih dahulu sebelum template dapat diaktifkan.
      </p>
    </form>
  );
}
