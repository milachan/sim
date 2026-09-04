import {
  FilePlus2,
  FileText,
  History,
  Lock,
  PenLine,
  RotateCcw,
  Send,
  UploadCloud,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  catatanTimeline,
  labelAksiTimeline,
  nomorVersiTimeline,
} from "@/lib/administrasi/pemeriksaan";
import { cn, formatTanggal } from "@/lib/utils";
import type { ItemTimeline } from "@/lib/administrasi/pemeriksaan";

// Timeline riwayat manusiawi — dipakai di detail guru dan detail Kamad.
// Tidak pernah menampilkan JSON mentah, ID internal, atau storage key.

const IKON_AKSI: Record<string, LucideIcon> = {
  buat: FilePlus2,
  ubah: PenLine,
  "ubah-draf": PenLine,
  upload: UploadCloud,
  kirim: Send,
  revisi: History,
  "minta-revisi": History,
  kirim_revisi: RotateCcw,
  "kirim-revisi": RotateCcw,
  setujui: FileText,
  finalisasi: Lock,
};

const TONAL_IKON: Record<string, string> = {
  buat: "bg-slate-100 text-slate-600",
  ubah: "bg-slate-100 text-slate-600",
  "ubah-draf": "bg-slate-100 text-slate-600",
  upload: "bg-blue-50 text-blue-700",
  kirim: "bg-blue-50 text-blue-700",
  revisi: "bg-amber-50 text-amber-700",
  "minta-revisi": "bg-amber-50 text-amber-700",
  kirim_revisi: "bg-blue-50 text-blue-700",
  "kirim-revisi": "bg-blue-50 text-blue-700",
  setujui: "bg-emerald-50 text-emerald-700",
  finalisasi: "bg-violet-50 text-violet-700",
};

export default function TimelineDokumen({ items }: { items: ItemTimeline[] }) {
  if (items.length === 0) {
    return <p className="text-xs text-slate-500">Belum ada riwayat.</p>;
  }

  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5">
      {items.map((item) => {
        const { label, dikenal } = labelAksiTimeline(item.aksi);
        const Ikon = dikenal ? (IKON_AKSI[item.aksi] ?? History) : History;
        const catatan = catatanTimeline(item.payload);
        const nomor = nomorVersiTimeline(item.payload);
        return (
          <li key={item.id} className="relative">
            <span
              aria-hidden="true"
              className={cn(
                "absolute -left-[30px] flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-white",
                TONAL_IKON[item.aksi] ?? "bg-slate-100 text-slate-500"
              )}
            >
              <Ikon className="h-3.5 w-3.5" />
            </span>
            <p className="text-sm font-bold leading-snug text-slate-900">{label}</p>
            {(item.dariStatus || item.keStatus) && (
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                {item.dariStatus ?? "—"} → {item.keStatus ?? "—"}
              </p>
            )}
            {typeof nomor === "number" && <p className="mt-0.5 text-xs text-slate-500">Versi {nomor}</p>}
            {catatan && (
              <p className="mt-1 break-words rounded-xl bg-amber-50 px-2.5 py-1.5 text-xs leading-relaxed text-amber-800">
                “{catatan}”
              </p>
            )}
            <p className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-slate-400">
              <span>{formatTanggal(item.waktu, "d MMM yyyy, HH:mm")}</span>
              {item.aktorNama && <span>· {item.aktorNama}</span>}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
