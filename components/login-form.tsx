"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { AlertCircle, BookOpen, CalendarDays, ClipboardCheck, Loader2, LogIn, NotebookPen, Sparkles } from "lucide-react";
import { PwaInstallBanner } from "@/components/pwa";

export type AkunDemo = {
  user: string;
  /** Nama panggilan (bagian nama sebelum gelar) untuk label chip. */
  nama: string;
};

export default function LoginForm({ demo }: { demo: AkunDemo[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await masuk(username, password);
  }

  async function masuk(user: string, pass: string) {
    if (loading) return;
    setUsername(user);
    setPassword(pass);
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", { username: user, password: pass, redirect: false });
      if (res?.error) {
        setError("Username atau password salah. Coba lagi.");
      } else {
        router.push(searchParams.get("callbackUrl") || "/");
        router.refresh();
      }
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      {/* Panel kiri — gambar branding utama */}
      <div className="relative hidden min-h-screen overflow-hidden bg-white lg:flex lg:items-end">
        <Image
          src="/login-background.png"
          alt="Sistem Administrasi Guru MTs Negeri 2 Kebumen"
          fill
          priority
          sizes="50vw"
          className="object-cover object-center"
        />

        <div className="relative z-10 m-6 w-full rounded-3xl bg-white/85 p-6 text-slate-900 shadow-2xl shadow-cyan-900/10 ring-1 ring-cyan-200/70 backdrop-blur-md xl:m-8 xl:p-8">
          <h1 className="text-2xl font-extrabold leading-tight text-[#102a4c] xl:text-3xl">
            Jurnal, Absensi & Penilaian dalam <span className="text-teal-600">satu alur kerja.</span>
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Dari satu jadwal mengajar, isi absensi, jurnal, dan nilai tanpa mengetik ulang kelas, mata pelajaran,
            tanggal, maupun jam pelajaran.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            {[
              { icon: CalendarDays, text: "Jadwal otomatis terhubung ke setiap pertemuan" },
              { icon: ClipboardCheck, text: "Absensi siswa cukup ubah yang tidak hadir" },
              { icon: NotebookPen, text: "Jurnal tersimpan rapi dengan riwayat perubahan" },
              { icon: BookOpen, text: "Nilai per kegiatan tanpa repot rekap manual" },
            ].map((feature) => (
              <div
                key={feature.text}
                className="flex items-center gap-3 rounded-xl bg-cyan-50/75 px-3 py-2.5 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-cyan-200/70"
              >
                <feature.icon className="h-4 w-4 shrink-0 text-teal-600" />
                <span>{feature.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Panel kanan — form */}
      <div className="flex items-center justify-center bg-slate-50/70 p-6">
        <div className="w-full max-w-sm fade-up">
          <div className="mb-8 text-center lg:hidden">
            <Image
              src="/logo.png"
              alt="Logo Sistem Administrasi Guru"
              width={512}
              height={512}
              className="mx-auto h-20 w-20 rounded-2xl bg-white object-contain p-1.5 shadow-lg ring-1 ring-slate-200"
            />
            <h1 className="mt-3 text-xl font-extrabold text-slate-900">Sistem Administrasi Guru</h1>
            <p className="text-sm text-slate-500">MTs Negeri 2 Kebumen</p>
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Masuk ke akun Anda</h2>
          <p className="mt-1 text-sm text-slate-500">Gunakan akun yang diberikan oleh admin madrasah.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {error && (
              <div role="alert" aria-live="assertive" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
                <AlertCircle className="h-5 w-5 shrink-0" />
                {error}
              </div>
            )}
            <div>
              <label htmlFor="username" className="label">Username</label>
              <input
                id="username"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="mis. guru1"
                autoComplete="username"
                required
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="password" className="label">Password</label>
              <input
                id="password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full !py-3 text-base">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
              Masuk
            </button>
          </form>

          <div className="mt-6">
            <PwaInstallBanner />
          </div>

          {demo.length > 0 && (
            <div className="mt-6 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/60 p-4">
              <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-emerald-700">
                <Sparkles className="h-3.5 w-3.5" /> Akun demo — password: password123
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {demo.map((d) => (
                  <button
                    key={d.user}
                    type="button"
                    onClick={() => masuk(d.user, "password123")}
                    disabled={loading}
                    title={`${d.user} — masuk otomatis`}
                    className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm ring-1 ring-inset ring-emerald-200 transition hover:bg-emerald-600 hover:text-white disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="inline h-3 w-3 animate-spin" /> : d.nama}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
