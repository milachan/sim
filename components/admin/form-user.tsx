"use client";

import { useMemo, useState } from "react";
import { ROLE_LABEL } from "@/lib/constants";
import { formUser } from "@/lib/actions/admin-forms";

export function FormUser({
  edit,
  guruAwal,
  guruList,
  guruTerpakai,
}: {
  edit?: { id?: string; username?: string; nama?: string; role?: string; guruId?: string | null; aktif?: boolean; wajibGantiPassword?: boolean } | null;
  guruAwal?: string;
  guruList: { id: string; nama: string; status: boolean }[];
  guruTerpakai: Set<string>;
}) {
  const [role, setRole] = useState(edit?.role ?? "GURU");
  const [guruId, setGuruId] = useState(edit?.guruId ?? guruAwal ?? "");
  const [aktif, setAktif] = useState(edit?.aktif ?? true);
  const [wajibGanti, setWajibGanti] = useState(edit?.wajibGantiPassword ?? false);

  const perluGuru = role === "GURU" || role === "WAKA";

  const opsiGuru = useMemo(() => {
    const dipakai = new Set(guruTerpakai);
    if (edit?.guruId) dipakai.delete(edit.guruId);
    return guruList
      .filter((g) => g.status === true && !dipakai.has(g.id))
      .sort((a, b) => a.nama.localeCompare(b.nama));
  }, [guruList, guruTerpakai, edit]);

  // Nama yang tampil mengikuti Guru terpilih secara reaktif (bukan input
  // disabled — field disabled tidak ikut dikirim browser dan tidak reaktif).
  const namaTampil = useMemo(() => {
    if (perluGuru) return guruList.find((g) => g.id === guruId)?.nama ?? "";
    return "";
  }, [perluGuru, guruList, guruId]);

  return (
    <form action={formUser} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={edit?.id ?? ""} />
      <div>
        <label className="label">Username *</label>
        <input className="input" name="username" defaultValue={edit?.username ?? ""} required />
      </div>
      {perluGuru ? (
        <div>
          <label className="label">Nama Lengkap</label>
          <div className="input min-h-[42px] bg-slate-100 text-slate-600">
            {namaTampil || <span className="text-slate-400">— pilih Guru di bawah —</span>}
          </div>
          <p className="mt-1 text-xs text-slate-400">Nama akun otomatis diambil dari Data Guru yang dipilih.</p>
        </div>
      ) : (
        <div>
          <label className="label">Nama Lengkap *</label>
          <input className="input" name="nama" defaultValue={edit?.nama ?? ""} required />
        </div>
      )}
      <div>
        <label className="label">Peran</label>
        <select className="input" name="role" value={role} onChange={(e) => setRole(e.target.value)}>
          {(Object.keys(ROLE_LABEL) as (keyof typeof ROLE_LABEL)[]).map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
      </div>
      {perluGuru && (
        <div>
          <label className="label">Terhubung ke Guru *</label>
          <select className="input" name="guruId" value={guruId} onChange={(e) => setGuruId(e.target.value)} required>
            <option value="">— pilih Guru —</option>
            {opsiGuru.map((g) => (
              <option key={g.id} value={g.id}>{g.nama}</option>
            ))}
          </select>
          {edit && !edit.guruId && (
            <p className="mt-1 text-xs text-amber-600">
              Akun ini belum terhubung ke data Guru. Pilih Guru pejabat yang bersangkutan.
            </p>
          )}
        </div>
      )}
      <div>
        <label className="label">{edit ? "Password Baru (kosongkan jika tetap)" : "Password *"}</label>
        <input type="password" className="input" name="password" placeholder="min. 6 karakter" />
      </div>
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" name="aktif" value="1" checked={aktif} onChange={(e) => setAktif(e.target.checked)} className="accent-emerald-600" />
          Akun aktif
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" name="wajibGantiPassword" value="1" checked={wajibGanti} onChange={(e) => setWajibGanti(e.target.checked)} className="accent-amber-600" />
          Wajib mengganti password saat login berikutnya
        </label>
      </div>
      <div className="sm:col-span-2">
        <button className="btn-primary">Simpan</button>
      </div>
    </form>
  );
}
