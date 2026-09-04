"use client";

import { useState } from "react";
import { BookOpen, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import FormAbsensi from "./form-absensi";
import FormJurnal from "./form-jurnal";
import CatatKejadian, { type ItemKejadian } from "./catat-kejadian";
import type { DataSiswa, ItemRiwayatJurnal, JurnalState, Rekap } from "./types";

export default function PertemuanShell({
  pertemuanId,
  sumber,
  alasanManual,
  dataSiswa,
  rekap,
  absensiSudahAda,
  jurnal,
  riwayatPengisian = [],
  kejadian = [],
  userId = "",
  bisaHapusSemua = false,
}: {
  pertemuanId: string;
  sumber: string;
  alasanManual: string | null;
  dataSiswa: DataSiswa[];
  rekap: Rekap;
  absensiSudahAda: boolean;
  jurnal: JurnalState | null;
  /** Riwayat pengisian jurnal akun ini (2 minggu terakhir, mapel sama) — pengganti tombol salin. */
  riwayatPengisian?: ItemRiwayatJurnal[];
  kejadian?: ItemKejadian[];
  userId?: string;
  bisaHapusSemua?: boolean;
}) {
  // Tab absensi pertemuan (AbsensiItem) bersifat opsional — jurnal tetap bisa
  // diisi tanpa mencatat absensi per pertemuan.
  const [tab, setTab] = useState<"absensi" | "jurnal">("jurnal");
  const absensiTerisi = absensiSudahAda;
  const jurnalTerisi = jurnal !== null;

  const tabs = [
    {
      id: "jurnal" as const,
      label: "Jurnal",
      icon: BookOpen,
      done: jurnalTerisi,
      count: 0,
    },
    {
      id: "absensi" as const,
      label: "Absensi (opsional)",
      icon: ClipboardCheck,
      done: absensiTerisi,
      count: dataSiswa.length,
    },
  ];

  return (
    <div>
      {/* Tab bar — status sudah terwakili ikon ✓ & chip jumlah di tiap tab */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:flex sm:flex-row">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition-all sm:px-4",
              tab === t.id
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
            )}
          >
            <t.icon className="h-4 w-4 shrink-0" />
            <span className="break-words text-center">{t.label}</span>
            {t.id === "absensi" && <span className={cn("chip !px-2 shrink-0", tab === t.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")}>{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === "absensi" ? (
        <FormAbsensi pertemuanId={pertemuanId} dataSiswa={dataSiswa} absensiSudahAda={absensiSudahAda} />
      ) : (
        <>
          <FormJurnal
            pertemuanId={pertemuanId}
            rekap={rekap}
            absensiSudahAda={absensiTerisi}
            jurnal={jurnal}
            riwayat={riwayatPengisian}
            sumber={sumber}
            alasanManual={alasanManual}
          />
          {/* Catat Kejadian Siswa — pendukung jurnal, tidak mengubah absensi resmi */}
          <div className="mt-4">
            <CatatKejadian
              pertemuanId={pertemuanId}
              siswaList={dataSiswa.map((s) => ({ id: s.id, nama: s.nama }))}
              kejadian={kejadian}
              userId={userId}
              bisaHapusSemua={bisaHapusSemua}
            />
          </div>
        </>
      )}
    </div>
  );
}
