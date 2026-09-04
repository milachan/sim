"use client";

import { useRef, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Download, FileSpreadsheet, Loader2, RefreshCcw, UploadCloud, XCircle } from "lucide-react";

type Hasil = {
  ok: boolean;
  mode?: string;
  siapEksekusi?: boolean;
  rowGagal?: number;
  rowBerhasil?: number;
  status?: "success" | "partial" | "failed";
  preview?: boolean;
  baru?: { nama: string; kode: string; akunAkanDibuat?: boolean }[];
  update?: { kode: string; namaLama: string; namaBaru: string; nipLama: string; nipBaru: string; teleponLama: string; teleponBaru: string; dipulihkan: boolean; hanyaFormat?: boolean }[];
  sama?: number;
  dilewati?: number;
  error?: string[];
  akunBaruRencana?: number;
  akunSudahAda?: number;
  jumlahAkunDibuat?: number;
  kredensialToken?: string;
  teks?: string;
  message?: string;
  errorMsg?: string;
};

export function GuruImport() {
  const [file, setFile] = useState<File | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [bukaDetail, setBukaDetail] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async (exec: boolean) => {
    if (!file) return;
    setSibuk(true);
    setHasil(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (!exec) fd.append("preview", "1");
      const r = await fetch("/api/import/guru", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) {
        setHasil({ ok: false, teks: d?.error ?? d?.teks ?? "Import gagal. Periksa format file.", error: d?.error ? [d.error] : undefined });
        return;
      }
      if (d.ok === false) {
        setHasil({ ok: false, teks: d?.error ?? d?.teks ?? "Import gagal.", error: d?.error ? [String(d.error)] : d?.error });
        return;
      }
      setHasil(d);
    } catch {
      setHasil({ ok: false, teks: "Gagal terhubung ke server." });
    } finally {
      setSibuk(false);
    }
  };

  const totalBaru = hasil?.baru?.length ?? 0;
  const totalUpdate = hasil?.update?.length ?? 0;
  const rowGagal = hasil?.rowGagal ?? 0;
  const rowBerhasil = hasil?.rowBerhasil ?? 0;
  const ringkasan = [
    totalBaru ? `${totalBaru} guru baru` : "",
    hasil?.akunBaruRencana ? `${hasil.akunBaruRencana} akun baru` : "",
    totalUpdate ? `${totalUpdate} diperbarui` : "",
    hasil?.sama ? `${hasil.sama} sama` : "",
    hasil?.akunSudahAda ? `${hasil.akunSudahAda} akun sudah ada` : "",
    hasil?.dilewati ? `${hasil.dilewati} dilewati` : "",
    rowGagal ? `${rowGagal} gagal` : "",
    rowBerhasil ? `${rowBerhasil} berhasil` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const previewValid = !!hasil?.ok && !!hasil?.preview && hasil?.siapEksekusi === true;
  const previewInvalid = !!hasil?.ok && !!hasil?.preview && hasil?.siapEksekusi === false;
  const execPartial = !!hasil?.ok && !hasil?.preview && hasil?.status === "partial";
  const execFailed = !!hasil?.ok && !hasil?.preview && hasil?.status === "failed";
  const execSuccess = !!hasil?.ok && !hasil?.preview && hasil?.status === "success";

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-extrabold text-slate-900">
            <UploadCloud className="h-4 w-4 text-emerald-600" /> Import Data Guru (Excel)
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
            Upload massal Data Guru + pembuatan akun — template 9 kolom:{" "}
            <b>NAMA | KODE | NIP | WHATSAPP | USERNAME | PASSWORD AWAL | PERAN AKUN | AKUN AKTIF | WAJIB GANTI PASSWORD</b>{" "}
            (format .xlsx). Patokan sinkron adalah <b>Kode</b> — guru dengan kode sama diperbarui datanya, yang belum ada dibuat beserta
            akunnya. Username/password kosong dibuat otomatis; import ulang tidak mereset akun lama; kredensial hanya bisa diunduh sekali
            oleh Anda.
          </p>
        </div>
        <a href="/api/import/template?t=guru" className="btn-secondary btn-sm">
          <Download className="h-4 w-4" /> Unduh Template
        </a>
      </div>

      <div
        className="mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 px-4 py-8 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) {
            setFile(f);
            setHasil(null);
            setBukaDetail(false);
          }
        }}
      >
        <p className="font-bold text-slate-700">{file ? file.name : "Tarik file Excel ke sini"}</p>
        <p className="mt-1 text-xs text-slate-400">{file ? `${(file.size / 1024).toFixed(0)} KB · siap diimport` : "atau pilih file (.xlsx)"}</p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setFile(f);
              setHasil(null);
              setBukaDetail(false);
            }
          }}
        />
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button onClick={() => inputRef.current?.click()} className="btn-secondary btn-sm">
            <FileSpreadsheet className="h-4 w-4" /> Pilih File
          </button>
          <button onClick={() => submit(false)} disabled={!file || sibuk} className="btn-primary btn-sm">
            {sibuk ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            {sibuk ? "Memeriksa…" : hasil?.preview ? "Periksa Ulang" : "Periksa & Pratinjau"}
          </button>
          {hasil?.preview && (
            <button onClick={() => submit(true)} disabled={sibuk || hasil?.siapEksekusi !== true} className="btn-primary btn-sm disabled:opacity-40">
              {sibuk ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {sibuk ? "Menyimpan…" : "Konfirmasi Import"}
            </button>
          )}
        </div>
      </div>

      {hasil && (
        <div
          className={`fade-up mt-4 rounded-xl border px-4 py-3 text-sm ${
            !hasil.ok || previewInvalid || execFailed
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : execPartial
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {hasil.ok ? (
            <>
              <p className="flex items-center gap-2 font-extrabold">
                {previewInvalid || execFailed ? (
                  <XCircle className="h-5 w-5 shrink-0" />
                ) : execPartial ? (
                  <XCircle className="h-5 w-5 shrink-0 text-amber-600" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                )}
                {hasil.preview
                  ? previewValid
                    ? "Pratinjau Import Data Guru — siap dieksekusi"
                    : "Pratinjau Import Data Guru — terdapat kesalahan validasi"
                  : execPartial
                    ? "Import selesai sebagian"
                    : execFailed
                      ? "Import gagal — tidak ada baris berhasil"
                      : execSuccess
                        ? "Import Data Guru selesai"
                        : "Import Data Guru selesai"}
              </p>
              {hasil.preview ? (
                <>
                  <p className="mt-2 rounded-lg bg-white/60 px-3 py-2 font-semibold text-slate-700">Rencana: {ringkasan || "tidak ada perubahan"}</p>
                  {previewInvalid && <p className="mt-2 text-xs font-semibold text-rose-700">Perbaiki kesalahan di bawah sebelum konfirmasi. Tombol konfirmasi dinonaktifkan.</p>}
                </>
              ) : (
                <p className="mt-2 font-semibold text-slate-700">
                  Ringkasan: {ringkasan || "tidak ada perubahan"}
                  {typeof hasil.jumlahAkunDibuat === "number" ? ` · ${hasil.jumlahAkunDibuat} akun berhasil dibuat` : ""}
                  {typeof rowGagal === "number" && rowGagal > 0 ? ` · ${rowGagal} baris gagal` : ""}
                </p>
              )}
              {hasil.teks && <p className="mt-2 text-xs text-slate-600">{hasil.teks}</p>}

              {!hasil.preview && hasil.kredensialToken && (
                <div className="mt-3">
                  <a
                    href={`/api/import/kredensial?token=${hasil.kredensialToken}`}
                    className="btn-primary btn-sm inline-flex min-h-11 items-center gap-1.5"
                    onClick={() => window.setTimeout(() => (hasil.kredensialToken = undefined), 100)}
                  >
                    <Download className="h-4 w-4" /> Unduh Kredensial Akun Baru (sekali)
                  </a>
                  {execPartial && <p className="mt-1 text-xs text-slate-600">File hanya berisi akun yang berhasil dibuat.</p>}
                </div>
              )}

              {hasil.preview && (totalBaru > 0 || totalUpdate > 0) && (
                <button onClick={() => setBukaDetail(!bukaDetail)} className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline">
                  {bukaDetail ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {bukaDetail ? "Sembunyikan detail" : "Lihat detail perubahan"}
                </button>
              )}

              {bukaDetail && (
                <div className="mt-3 space-y-3">
                  {totalBaru > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Guru baru (akan dibuat)</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {hasil.baru!.map((b, i) => (
                          <span key={i} className="chip bg-white text-slate-600 ring-1 ring-inset ring-slate-200">
                            {b.nama} <b className="text-slate-900">({b.kode})</b>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {totalUpdate > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-sky-700">Data guru diperbarui</p>
                      <div className="mt-1 max-h-56 space-y-1.5 overflow-y-auto">
                        {hasil.update!.map((u, i) => (
                          <div key={i} className="rounded-lg bg-white/70 px-3 py-2 text-xs leading-5">
                            <p className="font-bold text-slate-800">
                              {u.kode} — {u.namaLama} → <span className="text-emerald-700">{u.namaBaru}</span>
                              {u.hanyaFormat ? (
                                <span className="chip ml-1.5 bg-sky-100 text-sky-700">hanya penulisan nama (format)</span>
                              ) : (
                                !u.dipulihkan && <span className="chip ml-1.5 bg-emerald-100 text-emerald-700">data berubah</span>
                              )}
                              {u.dipulihkan && <span className="chip ml-1.5 bg-amber-100 text-amber-700">dipulihkan</span>}
                            </p>
                            <p className="text-slate-500">
                              NIP: {u.nipLama} → {u.nipBaru} · WA: {u.teleponLama} → {u.teleponBaru}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="flex items-center gap-2 font-extrabold">
              <XCircle className="h-5 w-5 shrink-0" /> Gagal
            </p>
          )}

          {hasil.error && hasil.error.length > 0 && (
            <div className="mt-3 max-h-40 overflow-y-auto rounded-lg bg-white/60 px-3 py-2 text-xs leading-5 text-rose-800">
              {hasil.error.slice(0, 10).map((e, i) => (
                <p key={i}>• {e}</p>
              ))}
              {hasil.error.length > 10 && <p>… dan {hasil.error.length - 10} pesan lainnya.</p>}
            </div>
          )}
          {hasil.teks && !hasil.ok && <p className="mt-2 font-semibold">{hasil.teks}</p>}
        </div>
      )}
      <div className="mt-4 border-t border-slate-200 pt-3 text-[11px] text-slate-500">
        <p className="font-bold uppercase tracking-wide text-slate-400">Baca warna hasil</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="chip bg-emerald-100 text-emerald-700">hijau</span> sukses / siap ·
          <span className="chip bg-amber-100 text-amber-800">kuning</span> sebagian / perlu perhatian ·
          <span className="chip bg-rose-100 text-rose-700">merah</span> gagal / diblokir
        </div>
      </div>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="card card-pad mb-6">{children}</div>;
}
