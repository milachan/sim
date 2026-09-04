"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { formProsesPasswordChange } from "@/lib/actions/admin-forms";

export function PanelPermintaanPassword({
  pending,
}: {
  pending: {
    id: string;
    userId: string;
    nama: string;
    username: string;
    role: string;
    createdAt: string;
  }[];
}) {
  const [bukaId, setBukaId] = useState<string | null>(null);

  if (pending.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Tidak ada permintaan ganti password yang menunggu konfirmasi.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {pending.map((p) => {
        const isOpen = bukaId === p.id;
        return (
          <li key={p.id} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-900">{p.nama}</p>
                <p className="text-xs text-slate-500">
                  @{p.username} · {p.role} · diajukan {new Date(p.createdAt).toLocaleString("id-ID")}
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setBukaId(isOpen ? null : p.id)}
              >
                {isOpen ? "Tutup" : "Tinjau"}
              </button>
            </div>
            {isOpen && (
              <div className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
                <SetujuForm requestId={p.id} />
                <TolakForm requestId={p.id} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SetujuForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [catatan, setCatatan] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.set("requestId", requestId);
      fd.set("setujui", "1");
      fd.set("catatan", catatan);
      await formProsesPasswordChange(fd);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded-lg border border-emerald-200 bg-white p-3">
      <p className="flex items-center gap-1 text-xs font-bold text-emerald-700">
        <Check className="h-3.5 w-3.5" /> Setujui
      </p>
      <input
        type="text"
        placeholder="Catatan (opsional)"
        className="input !text-xs"
        value={catatan}
        onChange={(e) => setCatatan(e.target.value)}
      />
      <button type="submit" className="btn-primary btn-sm w-full" disabled={loading}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
        Setujui
      </button>
      {error && <p className="text-[11px] font-semibold text-rose-600">{error}</p>}
    </form>
  );
}

function TolakForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [catatan, setCatatan] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.set("requestId", requestId);
      fd.set("setujui", "0");
      fd.set("catatan", catatan);
      await formProsesPasswordChange(fd);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded-lg border border-rose-200 bg-white p-3">
      <p className="flex items-center gap-1 text-xs font-bold text-rose-700">
        <X className="h-3.5 w-3.5" /> Tolak
      </p>
      <input
        type="text"
        placeholder="Alasan penolakan (opsional)"
        className="input !text-xs"
        value={catatan}
        onChange={(e) => setCatatan(e.target.value)}
      />
      <button type="submit" className="btn-secondary btn-sm w-full !border-rose-300 !text-rose-700" disabled={loading}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
        Tolak
      </button>
      {error && <p className="text-[11px] font-semibold text-rose-600">{error}</p>}
    </form>
  );
}
