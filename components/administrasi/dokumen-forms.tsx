"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { BATAS_JUDUL_DOKUMEN, JENIS_DOKUMEN_LABEL } from "@/lib/dokumen-validasi";
import type { JenisDokumen } from "@prisma/client";
import {
  buatDokumen,
  hapusDokumenDraf,
  kirimDokumen,
  kirimRevisiDokumen,
  mintaRevisiDokumen,
  ubahDokumenDraf,
} from "@/lib/actions/dokumen";

export function FormBuatDokumen({ onSelesai }: { onSelesai?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [judul, setJudul] = useState("");
  const [jenis, setJenis] = useState<JenisDokumen>("PROPOSAL");
  const [ringkasan, setRingkasan] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        start(async () => {
          try {
            const r = await buatDokumen({ judul, jenis, ringkasan: ringkasan || null });
            onSelesai?.();
            router.push(`/administrasi/${r.id}`);
          } catch (ex: unknown) {
            setErr(ex instanceof Error ? ex.message : "Gagal membuat dokumen.");
          }
        });
      }}
      autoComplete="off"
      className="space-y-4"
    >
      {/* Batas judul mengikuti BATAS_JUDUL_DOKUMEN (kolom DB VARCHAR(191)). */}
      <div>
        <label htmlFor="judul-dokumen" className="label">
          Judul <span className="font-bold text-slate-500">(wajib)</span>
        </label>
        <input
          id="judul-dokumen"
          value={judul}
          onChange={(e) => setJudul(e.target.value)}
          maxLength={BATAS_JUDUL_DOKUMEN}
          required
          autoComplete="off"
          className="input"
          placeholder="Contoh: Proposal Kegiatan Pesantren Ramadan"
          aria-describedby="judul-dokumen-bantuan"
        />
        <p id="judul-dokumen-bantuan" className="mt-1 text-xs text-slate-500">
          Tulis judul yang jelas, minimal 5 karakter.
        </p>
      </div>

      <div>
        <label htmlFor="jenis-dokumen" className="label">
          Jenis dokumen <span className="font-bold text-slate-500">(wajib)</span>
        </label>
        <select
          id="jenis-dokumen"
          value={jenis}
          onChange={(e) => setJenis(e.target.value as JenisDokumen)}
          className="input"
          aria-describedby="jenis-dokumen-bantuan"
        >
          {(Object.keys(JENIS_DOKUMEN_LABEL) as JenisDokumen[]).map((k) => (
            <option key={k} value={k}>{JENIS_DOKUMEN_LABEL[k]}</option>
          ))}
        </select>
        <p id="jenis-dokumen-bantuan" className="mt-1 text-xs text-slate-500">
          Pilih kategori yang paling sesuai — jenis menentukan alur pemeriksaan.
        </p>
      </div>

      <div>
        <label htmlFor="ringkasan-dokumen" className="label">
          Keterangan <span className="text-xs font-semibold text-slate-400">(opsional)</span>
        </label>
        <textarea
          id="ringkasan-dokumen"
          value={ringkasan}
          onChange={(e) => setRingkasan(e.target.value)}
          maxLength={2000}
          rows={3}
          className="input"
          placeholder="Ringkasan singkat isi atau tujuan dokumen…"
          aria-describedby="ringkasan-dokumen-bantuan"
        />
        <p id="ringkasan-dokumen-bantuan" className="mt-1 text-xs text-slate-500">
          Maksimal 2000 karakter. Membantu Kamad memahami konteks sebelum membuka file.
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
          "Simpan sebagai Draf"
        )}
      </button>
    </form>
  );
}

export function FormUbahDokumen({
  id,
  awal,
}: {
  id: string;
  awal: { judul: string; jenis: JenisDokumen; ringkasan: string | null };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [judul, setJudul] = useState(awal.judul);
  const [jenis, setJenis] = useState<JenisDokumen>(awal.jenis);
  const [ringkasan, setRingkasan] = useState(awal.ringkasan ?? "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        start(async () => {
          try {
            await ubahDokumenDraf(id, { judul, jenis, ringkasan: ringkasan || null });
            router.refresh();
          } catch (ex: unknown) {
            setErr(ex instanceof Error ? ex.message : "Gagal menyimpan perubahan.");
          }
        });
      }}
      className="space-y-3"
    >
      <label className="block text-sm font-semibold text-slate-700">
        Judul
        <input value={judul} onChange={(e) => setJudul(e.target.value)} maxLength={BATAS_JUDUL_DOKUMEN} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Jenis dokumen
        <select value={jenis} onChange={(e) => setJenis(e.target.value as JenisDokumen)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
          {(Object.keys(JENIS_DOKUMEN_LABEL) as JenisDokumen[]).map((k) => (
            <option key={k} value={k}>{JENIS_DOKUMEN_LABEL[k]}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Keterangan
        <textarea value={ringkasan} onChange={(e) => setRingkasan(e.target.value)} maxLength={2000} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </label>
      {err && <p role="alert" className="text-sm font-semibold text-rose-600">{err}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full disabled:opacity-50">
        {pending ? "Menyimpan..." : "Simpan perubahan"}
      </button>
    </form>
  );
}

export function TombolHapusDraf({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const ok = window.confirm("Hapus draf ini? Tindakan tidak dapat dibatalkan.");
            if (!ok) return;
            try {
              await hapusDokumenDraf(id);
              router.push("/administrasi");
              router.refresh();
            } catch (ex: unknown) {
              setErr(ex instanceof Error ? ex.message : "Gagal menghapus.");
            }
          })
        }
        className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
      >
        {pending ? "Menghapus..." : "Hapus draf"}
      </button>
      {err && <p role="alert" className="text-sm font-semibold text-rose-600">{err}</p>}
    </div>
  );
}

export function TombolKirim({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const ok = window.confirm("Kirim dokumen ini ke Kamad? Setelah dikirim tidak dapat diedit langsung.");
            if (!ok) return;
            try {
              await kirimDokumen(id);
              router.refresh();
            } catch (ex: unknown) {
              setErr(ex instanceof Error ? ex.message : "Gagal mengirim.");
            }
          })
        }
        className="w-full rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Mengirim..." : "Kirim ke Kamad"}
      </button>
      {err && <p role="alert" className="text-sm font-semibold text-rose-600">{err}</p>}
    </div>
  );
}

export function FormRevisiDanKirim({
  id,
  awal,
}: {
  id: string;
  awal: { judul: string; jenis: JenisDokumen; ringkasan: string | null };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [judul, setJudul] = useState(awal.judul);
  const [jenis, setJenis] = useState<JenisDokumen>(awal.jenis);
  const [ringkasan, setRingkasan] = useState(awal.ringkasan ?? "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        start(async () => {
          try {
            await kirimRevisiDokumen(id, { judul, jenis, ringkasan: ringkasan || null });
            router.refresh();
          } catch (ex: unknown) {
            setErr(ex instanceof Error ? ex.message : "Gagal mengirim revisi.");
          }
        });
      }}
      className="space-y-3"
    >
      <label className="block text-sm font-semibold text-slate-700">
        Judul
        <input value={judul} onChange={(e) => setJudul(e.target.value)} maxLength={BATAS_JUDUL_DOKUMEN} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Jenis dokumen
        <select value={jenis} onChange={(e) => setJenis(e.target.value as JenisDokumen)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
          {(Object.keys(JENIS_DOKUMEN_LABEL) as JenisDokumen[]).map((k) => (
            <option key={k} value={k}>{JENIS_DOKUMEN_LABEL[k]}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Keterangan
        <textarea value={ringkasan} onChange={(e) => setRingkasan(e.target.value)} maxLength={2000} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
      </label>
      {err && <p role="alert" className="text-sm font-semibold text-rose-600">{err}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full disabled:opacity-50">
        {pending ? "Mengirim revisi..." : "Simpan revisi & kirim ulang"}
      </button>
    </form>
  );
}

export function FormMintaRevisi({ id, saranCatatan }: { id: string; saranCatatan?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [catatan, setCatatan] = useState(saranCatatan ?? "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        start(async () => {
          try {
            await mintaRevisiDokumen(id, catatan);
            router.refresh();
          } catch (ex: unknown) {
            setErr(ex instanceof Error ? ex.message : "Gagal meminta revisi.");
          }
        });
      }}
      className="space-y-3"
    >
      <label className="label" htmlFor={`catatan-revisi-${id}`}>
        Catatan revisi <span className="font-bold text-slate-500">(wajib)</span>
      </label>
      <textarea
        id={`catatan-revisi-${id}`}
        value={catatan}
        onChange={(e) => setCatatan(e.target.value)}
        maxLength={2000}
        rows={3}
        required
        className="input"
        placeholder="Tuliskan bagian yang perlu diperbaiki..."
      />
      {err && (
        <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
          {err}
        </p>
      )}
      <button type="submit" disabled={pending} className="w-full rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-amber-700 disabled:opacity-50">
        {pending ? "Mengirim..." : "Minta revisi"}
      </button>
    </form>
  );
}

