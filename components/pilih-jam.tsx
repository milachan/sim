"use client";

import { useEffect, useRef, useState } from "react";
import { HARI, HARI_LABEL, jamMaksHari } from "@/lib/constants";
import { getJamPelajaran, type ItemJamPelajaran } from "@/lib/actions/admin";
import type { Hari } from "@prisma/client";

/**
 * Pemilih Hari + Jam Mulai/Selesai untuk form jadwal admin.
 * Opsi jam mengikuti database (JamPelajaran) untuk hari yang sudah diatur
 * sekolah; bila suatu hari BELUM punya baris jam di DB, dipakai jam default
 * dari lib/constants (jamMaksHari) — fallback yang sama dengan validasi server
 * (jamMaksHariFromDb) — sehingga form selalu punya pilihan yang masuk akal.
 * Data jam dimuat async saat mount.
 */
export function PilihJam({
  hariAwal,
  jamMulaiAwal,
  jamSelesaiAwal,
}: {
  hariAwal?: string;
  jamMulaiAwal?: number;
  jamSelesaiAwal?: number;
}) {
  const [jadwalJam, setJadwalJam] = useState<ItemJamPelajaran[]>([]);

  // Fetch jam pelajaran dari database saat mount
  useEffect(() => {
    getJamPelajaran().then(setJadwalJam).catch(() => setJadwalJam([]));
  }, []);

  const hariAwalResolved = (hariAwal as Hari) ?? "SENIN";

  const [hari, setHari] = useState<Hari>(hariAwalResolved);
  const [mulai, setMulai] = useState(1);
  const [selesai, setSelesai] = useState(2);
  // true bila pengguna sudah menyentuh pilihan apa pun sebelum data DB termuat
  // — mencegah efek di bawah menimpa pilihannya.
  const pernahDiubah = useRef(false);

  /** Jumlah jam maksimal hari h: baris DB bila ada, else jam default (constants). */
  const jumlahMaksHari = (h: Hari): number => {
    const n = jadwalJam.filter((j) => j.hari === h).length;
    return n > 0 ? n : Math.max(jamMaksHari(h), 1);
  };

  const jamHari = jadwalJam.filter((j) => j.hari === hari);
  const maks = jumlahMaksHari(hari);

  // Setelah data jam DB termuat:
  // 1. Bila belum ada interaksi, terapkan nilai awal dari props (mode Ubah)
  //    dengan batas asli DB — mencegah nilai baris jatuh ke 1–2 diam-diam.
  // 2. Bila pilihan terlanjur diambil saat data belum termuat, sesuaikan agar
  //    tetap dalam rentang jam yang terdefinisi DB.
  useEffect(() => {
    if (jadwalJam.length === 0) return;
    if (!pernahDiubah.current) {
      pernahDiubah.current = true;
      const m = jumlahMaksHari(hariAwalResolved);
      const mulaiBaru = Math.min(jamMulaiAwal ?? 1, Math.max(m - 1, 1));
      const selesaiBaru = Math.max(Math.min(jamSelesaiAwal ?? 2, m), mulaiBaru + 1);
      setHari(hariAwalResolved);
      setMulai(mulaiBaru);
      setSelesai(selesaiBaru);
      return;
    }
    const n = jadwalJam.filter((j) => j.hari === hari).length;
    if (n === 0) return; // hari ini tidak terdefinisi DB → biarkan fallback
    const mulaiBaru = Math.min(mulai, Math.max(n - 1, 1));
    const selesaiBaru = Math.min(Math.max(selesai, mulaiBaru + 1), n);
    if (mulaiBaru !== mulai || selesaiBaru !== selesai) {
      setMulai(mulaiBaru);
      setSelesai(selesaiBaru);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jadwalJam]);

  function gantiHari(h: Hari) {
    pernahDiubah.current = true;
    setHari(h);
    const n = jumlahMaksHari(h);
    const mulaiBaru = Math.min(mulai, Math.max(n - 1, 1));
    setMulai(mulaiBaru);
    setSelesai(Math.max(Math.min(selesai, n), mulaiBaru + 1));
  }

  function gantiMulai(j: number) {
    pernahDiubah.current = true;
    setMulai(j);
    setSelesai((prev) => Math.max(prev, j + 1));
  }

  const waktuMulai = jamHari.find((j) => j.jamKe === mulai);
  const waktuSelesai = jamHari.find((j) => j.jamKe === selesai);
  const rentang = waktuMulai && waktuSelesai ? `${waktuMulai.mulai}–${waktuSelesai.selesai}` : null;

  return (
    <>
      <div>
        <label className="label">Hari *</label>
        <select className="input" name="hari" value={hari} onChange={(e) => gantiHari(e.target.value as Hari)}>
          {HARI.map((h) => (
            <option key={h} value={h}>
              {HARI_LABEL[h]}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-slate-400">
          {maks} jam pelajaran{rentang ? ` · ${rentang}` : ""}
        </p>
        {hari === "SENIN" && (
          <p className="mt-1 text-[11px] text-amber-600">Senin jam ke-1 biasanya untuk upacara bendera.</p>
        )}
      </div>
      <div>
        <label className="label">Jam Mulai (ke-)</label>
        <select className="input" name="jamMulai" value={mulai} onChange={(e) => gantiMulai(Number(e.target.value))}>
          {Array.from({ length: Math.max(maks - 1, 1) }, (_, i) => i + 1).map((j) => {
            const w = jamHari.find((x) => x.jamKe === j);
            return (
              <option key={j} value={j}>
                {j} · {w ? `${w.mulai}–${w.selesai}` : ""}
              </option>
            );
          })}
        </select>
      </div>
      <div>
        <label className="label">Jam Selesai (ke-)</label>
        <select
          className="input"
          name="jamSelesai"
          value={selesai}
          onChange={(e) => {
            pernahDiubah.current = true;
            setSelesai(Number(e.target.value));
          }}
        >
          {Array.from({ length: Math.max(maks - mulai, 1) }, (_, i) => mulai + i + 1).map((j) => {
            const w = jamHari.find((x) => x.jamKe === j);
            return (
              <option key={j} value={j}>
                {j} · {w ? `${w.mulai}–${w.selesai}` : ""}
              </option>
            );
          })}
        </select>
      </div>
    </>
  );
}
