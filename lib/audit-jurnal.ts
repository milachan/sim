/**
 * Helper audit jurnal: snapshot + diff yang konsisten.
 *
 * Normalisasi: string di-trim; string kosong dianggap sama dengan null
 * (supaya tidak menghasilkan perubahan palsu saat UI mengirim "" padahal
 * DB menyimpan null).
 */

export type FieldJurnal =
  | "materi"
  | "tujuan"
  | "kegiatan"
  | "metode"
  | "media"
  | "hasil"
  | "kendala"
  | "tindakLanjut"
  | "catatan"
  | "dokumentasiUrl";

export const FIELD_JURNAL: FieldJurnal[] = [
  "materi",
  "tujuan",
  "kegiatan",
  "metode",
  "media",
  "hasil",
  "kendala",
  "tindakLanjut",
  "catatan",
  "dokumentasiUrl",
];

export type SnapshotJurnal = {
  materi: string | null;
  tujuan: string | null;
  kegiatan: string | null;
  metode: string | null;
  media: string | null;
  hasil: string | null;
  kendala: string | null;
  tindakLanjut: string | null;
  catatan: string | null;
  dokumentasiUrl: string | null;
  status: string;
};

/** Normalisasi string jurnal: trim, lalu string kosong → null. */
export function normJurnal(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s === "" ? null : s;
}

/** Versi data bersih untuk ditulis ke DB (dipakai juga oleh action jurnal). */
export function bersihkanJurnal(d: {
  materi?: unknown;
  tujuan?: unknown;
  kegiatan?: unknown;
  metode?: unknown;
  media?: unknown;
  hasil?: unknown;
  kendala?: unknown;
  tindakLanjut?: unknown;
  catatan?: unknown;
  dokumentasiUrl?: unknown;
}) {
  return {
    materi: normJurnal(d.materi),
    tujuan: normJurnal(d.tujuan),
    kegiatan: normJurnal(d.kegiatan),
    metode: normJurnal(d.metode),
    media: normJurnal(d.media),
    hasil: normJurnal(d.hasil),
    kendala: normJurnal(d.kendala),
    tindakLanjut: normJurnal(d.tindakLanjut),
    catatan: normJurnal(d.catatan),
    dokumentasiUrl: normJurnal(d.dokumentasiUrl),
  };
}

/** Ambil snapshot dari data mentah (input form / row DB). Status wajib ada. */
export function snapshotJurnal(d: {
  materi?: unknown;
  tujuan?: unknown;
  kegiatan?: unknown;
  metode?: unknown;
  media?: unknown;
  hasil?: unknown;
  kendala?: unknown;
  tindakLanjut?: unknown;
  catatan?: unknown;
  dokumentasiUrl?: unknown;
  status?: unknown;
}): SnapshotJurnal {
  return {
    materi: normJurnal(d.materi),
    tujuan: normJurnal(d.tujuan),
    kegiatan: normJurnal(d.kegiatan),
    metode: normJurnal(d.metode),
    media: normJurnal(d.media),
    hasil: normJurnal(d.hasil),
    kendala: normJurnal(d.kendala),
    tindakLanjut: normJurnal(d.tindakLanjut),
    catatan: normJurnal(d.catatan),
    dokumentasiUrl: normJurnal(d.dokumentasiUrl),
    status: String(d.status ?? ""),
  };
}

export type DiffJurnal = {
  /** Daftar field (termasuk status) yang benar-benar berubah. */
  fieldBerubah: (FieldJurnal | "status")[];
  /** Nilai lama hanya untuk field yang berubah (normalisasi). */
  sebelum: Partial<SnapshotJurnal>;
  /** Nilai baru hanya untuk field yang berubah (normalisasi). */
  sesudah: Partial<SnapshotJurnal>;
  berubah: boolean;
};

/** Diff snapshot jurnal — hanya field yang berubah yang disertakan. */
export function diffJurnal(sebelum: SnapshotJurnal, sesudah: SnapshotJurnal): DiffJurnal {
  const fieldBerubah: (FieldJurnal | "status")[] = [];
  const sblm: Partial<SnapshotJurnal> = {};
  const ssdh: Partial<SnapshotJurnal> = {};

  for (const f of FIELD_JURNAL) {
    if (sebelum[f] !== sesudah[f]) {
      fieldBerubah.push(f);
      sblm[f] = sebelum[f];
      ssdh[f] = sesudah[f];
    }
  }
  if (sebelum.status !== sesudah.status) {
    fieldBerubah.push("status");
    sblm.status = sebelum.status;
    ssdh.status = sesudah.status;
  }

  return { fieldBerubah, sebelum: sblm, sesudah: ssdh, berubah: fieldBerubah.length > 0 };
}

/** Label ramah pembaca untuk sebuah field jurnal. */
export function labelFieldJurnal(f: string): string {
  const map: Record<string, string> = {
    materi: "Materi",
    tujuan: "Tujuan",
    kegiatan: "Kegiatan",
    metode: "Metode",
    media: "Media",
    hasil: "Hasil",
    kendala: "Kendala",
    tindakLanjut: "Tindak Lanjut",
    catatan: "Catatan",
    dokumentasiUrl: "Dokumentasi",
    status: "Status",
  };
  return map[f] ?? f;
}
