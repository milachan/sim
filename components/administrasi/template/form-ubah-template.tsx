"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ubahTemplate } from "@/lib/actions/template";
import { BATAS_NAMA_TEMPLATE } from "@/lib/administrasi/template-validasi";

// Form ubah metadata template (nama & deskripsi). Jenis tidak dapat diubah
// setelah dibuat agar katalog tetap konsisten.

export default function FormUbahTemplate({
  id,
  awal,
}: {
  id: string;
  awal: { nama: string; deskripsi: string | null };
}) {
  const router = useRouter();
  const [nama, setNama] = useState(awal.nama);
  const [deskripsi, setDeskripsi] = useState(awal.deskripsi ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [sukses, setSukses] = useState(false);
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        setSukses(false);
        start(async () => {
          try {
            const r = await ubahTemplate(id, { nama, deskripsi: deskripsi || null });
            if (!r.ok) {
              setErr(r.error);
              return;
            }
            setSukses(true);
            router.refresh();
          } catch {
            setErr("Gagal menyimpan perubahan.");
          }
        });
      }}
      autoComplete="off"
      className="space-y-4"
    >
      <div>
        <label htmlFor={`nama-ubah-${id}`} className="label">
          Nama template <span className="font-bold text-slate-500">(wajib)</span>
        </label>
        <input
          id={`nama-ubah-${id}`}
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          maxLength={BATAS_NAMA_TEMPLATE}
          required
          className="input"
        />
      </div>
      <div>
        <label htmlFor={`deskripsi-ubah-${id}`} className="label">
          Deskripsi <span className="text-xs font-semibold text-slate-400">(opsional)</span>
        </label>
        <textarea
          id={`deskripsi-ubah-${id}`}
          value={deskripsi}
          onChange={(e) => setDeskripsi(e.target.value)}
          maxLength={2000}
          rows={3}
          className="input"
        />
      </div>

      {err && (
        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {err}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn-secondary w-full">
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Menyimpan…
          </>
        ) : (
          "Simpan Perubahan"
        )}
      </button>

      <p role="status" aria-live="polite" className={sukses ? "text-xs font-semibold text-emerald-700" : "sr-only"}>
        {sukses ? "Perubahan tersimpan." : ""}
      </p>
    </form>
  );
}
