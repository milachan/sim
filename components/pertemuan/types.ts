import type { StatusAbsensi, StatusJurnal } from "@prisma/client";

export type DataSiswa = {
  id: string;
  nama: string;
  nis: string | null;
  /** null = belum ditentukan (absensi opsional; siswa tanpa status tidak ikut tersimpan). */
  status: StatusAbsensi | null;
  catatan: string;
};

export type Rekap = Record<StatusAbsensi, number>;

export type JurnalState = {
  materi: string;
  tujuan: string;
  kegiatan: string;
  metode: string;
  media: string;
  hasil: string;
  kendala: string;
  tindakLanjut: string;
  catatan: string;
  dokumentasiUrl: string;
  status: StatusJurnal;
};

/** Isi jurnal yang bisa dipakai ulang (tanpa status). */
export type IsiJurnal = {
  materi: string;
  tujuan: string;
  kegiatan: string;
  metode: string;
  media: string;
  hasil: string;
  kendala: string;
  tindakLanjut: string;
  catatan: string;
  dokumentasiUrl: string;
};

/** Satu entri riwayat pengisian jurnal milik akun ini (2 minggu terakhir). */
export type ItemRiwayatJurnal = IsiJurnal & {
  /** id pertemuan sumber riwayat. */
  pertemuanId: string;
  /** ISO YYYY-MM-DD. */
  tanggal: string;
  mapel: string;
  kelas: string;
  pertemuanKe: number;
};
