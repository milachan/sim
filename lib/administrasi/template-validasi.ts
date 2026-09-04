import { isJenisDokumen } from "@/lib/dokumen-validasi";
import { cekMagicBytes, cekPathTraversal, ekstensiDariNama, validasiFile } from "@/lib/administrasi/document-validation";

// Validasi server bersama untuk backend Template Dokumen.
// File: PDF/DOC/DOCX/XLS/XLSX, maks 10 MB — extension + MIME + magic bytes.
// Metadata client TIDAK dipercaya: mime fallback diturunkan dari ekstensi.

export const BATAS_NAMA_TEMPLATE = 190;
export const BATAS_DESKRIPSI_TEMPLATE = 2000;

/** Namespace storage terpisah dari dokumen pengajuan. */
export const NAMESPACE_TEMPLATE = "template";

export type MetadataTemplateInput = {
  nama: string;
  deskripsi?: string | null;
  jenis: string;
};

export function validasiMetadataTemplate(input: MetadataTemplateInput): string | null {
  const nama = input.nama?.trim() ?? "";
  if (nama.length < 3) return "Nama template minimal 3 karakter.";
  if (nama.length > BATAS_NAMA_TEMPLATE) return `Nama template maksimal ${BATAS_NAMA_TEMPLATE} karakter.`;
  if (!isJenisDokumen(input.jenis)) return "Jenis dokumen tidak valid.";
  const deskripsi = input.deskripsi?.trim() ?? "";
  if (deskripsi.length > BATAS_DESKRIPSI_TEMPLATE) {
    return `Deskripsi maksimal ${BATAS_DESKRIPSI_TEMPLATE} karakter.`;
  }
  return null;
}

/**
 * Validasi file template lengkap: extension, MIME, ukuran (10 MB), magic bytes,
 * dan nama bebas traversal. Mengembalikan null bila valid.
 */
export function validasiFileTemplate(
  namaAsli: string,
  mimeTipe: string,
  ukuran: number,
  buffer: Buffer
): string | null {
  if (cekPathTraversal(namaAsli)) return "Nama file tidak valid.";
  const err = validasiFile(namaAsli, mimeTipe, ukuran);
  if (err) return err;
  const ext = ekstensiDariNama(namaAsli);
  if (!cekMagicBytes(buffer, ext)) return "Isi file tidak sesuai dengan extension.";
  return null;
}

/** MIME fallback dari ekstensi — metadata client tidak dipercaya. */
export function mimeDariEkstensi(ext: string): string {
  const m: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return m[ext] ?? "application/octet-stream";
}

// ====== Filter katalog & label audit (murni, testable) ======

export type ItemDaftarTemplate = {
  id: string;
  jenis: string;
  nama: string;
  deskripsi: string | null;
  aktif: boolean;
  jumlahVersi: number;
  versiTerbaru: { id: string; nomor: number; namaAsli: string; ukuran: number; sha256: string; createdAt: Date | string } | null;
};

export type FilterDaftarTemplate = { q?: string | null; jenis?: string | null; status?: string | null };

/**
 * Filter server-side daftar template:
 * - q: nama atau deskripsi mengandung kata (case-insensitive); kosong → tanpa filter.
 * - jenis: harus jenis valid; asing → diabaikan.
 * - status: "aktif"/"nonaktif" (untuk admin); asing/kosong → semua.
 * Hasil diurutkan jenis lalu nama.
 */
export function saringDaftarTemplate(
  items: ItemDaftarTemplate[],
  filter: FilterDaftarTemplate
): ItemDaftarTemplate[] {
  const q = (filter.q ?? "").trim().toLowerCase();
  const jenis = isJenisDokumen(filter.jenis) ? filter.jenis : null;
  const status = filter.status === "aktif" || filter.status === "nonaktif" ? filter.status : null;
  return items
    .filter((it) => (status ? (status === "aktif" ? it.aktif : !it.aktif) : true))
    .filter((it) => (jenis ? it.jenis === jenis : true))
    .filter((it) =>
      q
        ? it.nama.toLowerCase().includes(q) || (it.deskripsi ?? "").toLowerCase().includes(q)
        : true
    )
    .sort((a, b) => (a.jenis === b.jenis ? a.nama.localeCompare(b.nama) : a.jenis.localeCompare(b.jenis)));
}

const LABEL_AKSI_TEMPLATE: Record<string, string> = {
  dibuat: "Template dibuat",
  metadata_diubah: "Informasi diperbarui",
  versi_diunggah: "Versi diunggah",
  diaktifkan: "Template diaktifkan",
  dinonaktifkan: "Template dinonaktifkan",
};

/** Label manusiawi audit template. Aksi tak dikenal → label generik tanpa dump JSON. */
export function labelAksiTemplate(aksi: string): { label: string; dikenal: true } | { label: string; dikenal: false } {
  const label = LABEL_AKSI_TEMPLATE[aksi];
  if (label) return { label, dikenal: true };
  return { label: "Aktivitas template", dikenal: false };
}

/** Unduhan template selalu lewat endpoint template berbasis versiId — bukan endpoint dokumen. */
export function hrefUnduhVersiTemplate(versiId: string): string {
  return `/api/administrasi/template/versi/${versiId}/download`;
}
