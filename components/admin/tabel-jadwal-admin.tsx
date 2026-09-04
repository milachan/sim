"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckSquare, Loader2, Lock, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState, TableRow, TableShell, Td, Th } from "@/components/ui";
import { UpacaraBadge } from "@/components/status-badge";
import { TombolHapus } from "@/components/tombol-hapus";
import { hapusJadwalMasal } from "@/lib/actions/admin";
import { formHapusJadwal, formHapusJadwalPaksa } from "@/lib/actions/admin-forms";

export type BarisJadwalAdmin = {
  id: string;
  semester: string;
  hariLabel: string;
  jamKeMulai: number;
  jamKeSelesai: number;
  rentang: string | null;
  mapel: string;
  kelas: string;
  guru: string;
  punyaRiwayat: boolean;
  upacara: boolean;
};

const PESAN_HAPUS_PAKSA =
  "Hapus paksa jadwal ini? Seluruh riwayatnya (pertemuan, absensi, jurnal & penilaian) akan ikut terhapus PERMANEN dan tidak bisa dikembalikan.";

export function TabelJadwalAdmin({
  jadwal,
  filterAktif,
  semesterParam = "aktif",
  role = null,
}: {
  jadwal: BarisJadwalAdmin[];
  filterAktif: boolean;
  /** Nilai filter semester saat ini — dipertahankan di tautan Ubah agar jadwal periode lain tetap bisa diedit. */
  semesterParam?: string;
  role?: string | null;
}) {
  const isSuperAdmin = role === "SUPERADMIN";
  const router = useRouter();
  const [terpilih, setTerpilih] = useState<Set<string>>(new Set());
  const [paksa, setPaksa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState<{ oke: boolean; teks: string } | null>(null);

  const jumlahDilindungi = jadwal.filter((j) => j.punyaRiwayat).length;
  // Tanpa mode paksa, jadwal ber-riwayat tidak bisa dipilih untuk hapus massal.
  const bisaDipilih = paksa ? jadwal : jadwal.filter((j) => !j.punyaRiwayat);
  const jumlahBisaDihapus = bisaDipilih.length;
  const semuaBisaTerpilih = jumlahBisaDihapus > 0 && terpilih.size === jumlahBisaDihapus;

  function toggle(id: string) {
    const j = jadwal.find((x) => x.id === id);
    if (!j) return;
    if (j.punyaRiwayat && !paksa) return; // terkunci kecuali mode hapus paksa aktif
    setTerpilih((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleSemua() {
    if (jumlahBisaDihapus === 0) return;
    setTerpilih(semuaBisaTerpilih ? new Set() : new Set(bisaDipilih.map((j) => j.id)));
  }

  function gantiModePaksa() {
    setPaksa((v) => !v);
    setTerpilih(new Set());
  }

  async function hapusTerpilih() {
    if (!terpilih.size) return;
    const jumlahBerRiwayat = jadwal.filter((j) => terpilih.has(j.id) && j.punyaRiwayat).length;
    const konfirmasi = paksa
      ? `Hapus paksa ${terpilih.size} jadwal? ${jumlahBerRiwayat > 0 ? `${jumlahBerRiwayat} di antaranya ber-riwayat — ` : ""}seluruh data pertemuan, absensi, jurnal & penilaian ikut terhapus PERMANEN dan tidak bisa dikembalikan.`
      : `Hapus ${terpilih.size} jadwal terpilih?`;
    if (!window.confirm(konfirmasi)) return;
    setLoading(true);
    setPesan(null);
    try {
      const hasil = await hapusJadwalMasal(Array.from(terpilih), paksa);
      setPesan({
        oke: true,
        teks:
          `${hasil.dihapus} jadwal berhasil dihapus.` +
          (hasil.dilewati > 0 ? ` ${hasil.dilewati} dilewati karena sudah punya riwayat pertemuan/penilaian.` : ""),
      });
      setTerpilih(new Set());
      router.refresh();
    } catch (e) {
      setPesan({ oke: false, teks: e instanceof Error ? e.message : "Gagal menghapus jadwal." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {pesan && (
        <div
          role="status"
          className={
            pesan.oke
              ? "fade-up rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
              : "fade-up rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700"
          }
        >
          {pesan.teks}
        </div>
      )}

      {/* Bar aksi hapus masal */}
      <div
        className={`sticky top-[var(--shell-header-h)] z-10 transition-all ${
          terpilih.size ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <div className="card flex flex-wrap items-center gap-2 border-blue-300 bg-blue-50/95 p-2.5 shadow-md backdrop-blur">
          <button
            onClick={toggleSemua}
            className="btn-secondary btn-sm"
            disabled={loading || jumlahBisaDihapus === 0}
            title={jumlahBisaDihapus === 0 ? "Semua jadwal dilindungi riwayat — aktifkan 'Hapus paksa' untuk ikut menghapus" : undefined}
          >
            <CheckSquare className="h-4 w-4" />
            {semuaBisaTerpilih ? "Batal semua" : "Pilih semua"}
          </button>
          <span className="px-1 text-sm font-bold text-blue-900">
            {terpilih.size} jadwal dipilih
            {paksa ? (
              <span className="ml-1 font-semibold text-rose-600">(hapus paksa — riwayat ikut terhapus)</span>
            ) : jumlahDilindungi > 0 ? (
              <span className="ml-1 font-semibold text-slate-500">
                ({jumlahBisaDihapus} bisa dihapus · {jumlahDilindungi} dilindungi)
              </span>
            ) : null}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {isSuperAdmin && (
              <label
                className="flex cursor-pointer select-none items-center gap-1.5 rounded-lg border border-rose-200 bg-white/70 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 transition-colors hover:bg-rose-50"
                title="Aktifkan untuk ikut memilih & menghapus jadwal ber-riwayat beserta seluruh datanya (permanen)."
              >
                <input
                  type="checkbox"
                  checked={paksa}
                  onChange={gantiModePaksa}
                  disabled={loading || jumlahDilindungi === 0}
                  className="h-3.5 w-3.5 accent-rose-600"
                />
                <AlertTriangle className="h-3.5 w-3.5" />
                Hapus paksa
              </label>
            )}
            <button onClick={() => setTerpilih(new Set())} className="btn-ghost btn-sm" disabled={loading}>
              <X className="h-4 w-4" /> Batal
            </button>
            <button onClick={hapusTerpilih} disabled={loading || terpilih.size === 0} className="btn-danger btn-sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Hapus Terpilih
            </button>
          </div>
        </div>
      </div>

      {jadwal.length === 0 ? (
        <EmptyState
          title={filterAktif ? "Tidak ada jadwal yang cocok dengan filter" : "Belum ada jadwal"}
          desc={
            filterAktif
              ? "Coba ubah atau kosongkan filter di atas."
              : "Tambahkan jadwal pelajaran lewat form di atas."
          }
          action={
            filterAktif ? (
              <Link href="/admin/jadwal" className="btn-secondary btn-sm">
                Reset Filter
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          {jumlahDilindungi > 0 && isSuperAdmin && (
            <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-500">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <b>{jumlahDilindungi} jadwal ber-riwayat</b> tidak ikut hapus massal biasa. Untuk menghapusnya beserta
                seluruh data pertemuan, absensi, jurnal &amp; penilaian, centang <b>Hapus paksa</b> di bar aksi atau
                gunakan tombol <b>Hapus paksa</b> per baris — data terhapus permanen.
              </span>
            </p>
          )}
          {jumlahDilindungi > 0 && !isSuperAdmin && (
            <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-500">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <b>{jumlahDilindungi} jadwal ber-riwayat</b> tidak bisa dihapus. Hubungi Super Admin untuk menghapus jadwal tersebut beserta seluruh riwayatnya.
              </span>
            </p>
          )}
          <TableShell>
            <thead>
              <tr>
                <Th className="w-12">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-blue-700"
                    checked={semuaBisaTerpilih}
                    onChange={toggleSemua}
                    disabled={jumlahBisaDihapus === 0}
                    aria-label="Pilih semua jadwal"
                    title={jumlahBisaDihapus === 0 ? "Tidak ada jadwal yang bisa dihapus (aktifkan 'Hapus paksa' untuk semua)" : undefined}
                  />
                </Th>
                <Th>Periode</Th>
                <Th>Hari</Th>
                <Th>Jam</Th>
                <Th>Mapel</Th>
                <Th>Kelas</Th>
                <Th>Guru</Th>
                <Th className="text-right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {jadwal.map((j) => {
                const terkunci = j.punyaRiwayat && !paksa;
                return (
                  <TableRow key={j.id} className={cn(j.punyaRiwayat && "bg-slate-50/60")}>
                    <Td>
                      <input
                        type="checkbox"
                        className={cn("h-5 w-5 accent-blue-700", terkunci && "cursor-not-allowed opacity-40")}
                        checked={terpilih.has(j.id)}
                        onChange={() => toggle(j.id)}
                        disabled={terkunci}
                        aria-label={`Pilih ${j.mapel} ${j.kelas}`}
                        title={
                          terkunci
                            ? "Memiliki riwayat pertemuan/penilaian. Aktifkan 'Hapus paksa' untuk ikut menghapus."
                            : undefined
                        }
                      />
                    </Td>
                    <Td className="text-xs text-slate-500">{j.semester}</Td>
                    <Td className="font-bold text-slate-900">{j.hariLabel}</Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        ke-{j.jamKeMulai}–{j.jamKeSelesai}
                        {j.upacara && <UpacaraBadge />}
                      </div>
                      <span className="block text-xs font-normal text-slate-400">{j.rentang ?? "—"}</span>
                    </Td>
                    <Td className="font-semibold">{j.mapel}</Td>
                    <Td>{j.kelas}</Td>
                    <Td>{j.guru}</Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/jadwal?edit=${j.id}&semester=${encodeURIComponent(semesterParam)}`}
                          className="btn-ghost btn-sm !px-2.5 text-emerald-700"
                        >
                          Ubah
                        </Link>
                        {j.punyaRiwayat && !isSuperAdmin ? (
                          <span className="text-[11px] font-semibold text-slate-400" title="Hanya Super Admin yang bisa menghapus jadwal ber-riwayat">
                            Ada riwayat
                          </span>
                        ) : (
                          <TombolHapus
                            action={j.punyaRiwayat ? formHapusJadwalPaksa : formHapusJadwal}
                            id={j.id}
                            label={j.punyaRiwayat ? "Hapus paksa" : "Hapus"}
                            pesan={j.punyaRiwayat ? PESAN_HAPUS_PAKSA : "Hapus jadwal ini? (hanya jika belum ada riwayat)"}
                          />
                        )}
                      </div>
                    </Td>
                  </TableRow>
                );
              })}
            </tbody>
          </TableShell>
        </>
      )}
    </div>
  );
}
