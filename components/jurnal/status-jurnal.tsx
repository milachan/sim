import { cn } from "@/lib/utils";

/**
 * Status jurnal yang disederhanakan:
 * - Lengkap     : jurnal sudah dikirim (TERKIRIM)
 * - Belum Diisi : jurnal kosong (null) atau masih draft lama (DRAFT) — karena
 *                 tidak ada lagi tombol "Simpan Konsep", draft digabung tampilannya.
 */
export function StatusJurnalSederhana({ status }: { status: "DRAFT" | "TERKIRIM" | null }) {
  if (status === "TERKIRIM") {
    return <span className={cn("chip bg-emerald-100 text-emerald-700")}>Lengkap</span>;
  }
  return <span className={cn("chip bg-rose-100 text-rose-600")}>Belum Diisi</span>;
}
