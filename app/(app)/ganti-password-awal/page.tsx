"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, LogOut, Save } from "lucide-react";
import { signOut } from "next-auth/react";
import { Card, PageHeader } from "@/components/ui";
import { gantiPasswordAwal } from "@/lib/actions/ganti-password-awal";

export default function GantiPasswordAwalPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [ulangi, setUlangi] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sukses, setSukses] = useState(false);

  async function simpan() {
    setError(null);
    if (password.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }
    if (password !== ulangi) {
      setError("Konfirmasi password tidak sama.");
      return;
    }
    setSibuk(true);
    try {
      await gantiPasswordAwal({ passwordBaru: password });
      setSukses(true);
      router.refresh();
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengganti password.");
    } finally {
      setSibuk(false);
    }
  }

  if (sukses) {
    return (
      <div className="fade-up mx-auto max-w-md pt-10">
        <Card className="card-pad text-center">
          <p className="text-lg font-extrabold text-emerald-700">Password berhasil diganti</p>
          <p className="mt-2 text-sm text-slate-500">Sekarang Anda dapat memakai aplikasi seperti biasa.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="fade-up mx-auto max-w-md pt-6">
      <PageHeader
        title="Ganti Password Awal"
        subtitle="Demi keamanan, Anda wajib mengganti password pemberian admin sebelum melanjutkan."
        icon={<KeyRound className="h-6 w-6" />}
      />
      <Card className="card-pad">
        <label className="label">Password Baru</label>
        <input
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Minimal 6 karakter"
          autoComplete="new-password"
        />
        <label className="label mt-3">Ulangi Password Baru</label>
        <input
          type="password"
          className="input"
          value={ulangi}
          onChange={(e) => setUlangi(e.target.value)}
          placeholder="Ketik ulang password"
          autoComplete="new-password"
        />
        {error && <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700">{error}</p>}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button onClick={simpan} disabled={sibuk} className="btn-primary min-h-11 flex-1">
            {sibuk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan Password Baru
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="btn-secondary min-h-11"
            title="Keluar dari aplikasi"
          >
            <LogOut className="h-4 w-4" /> Keluar
          </button>
        </div>
      </Card>
    </div>
  );
}
