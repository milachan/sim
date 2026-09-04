export const STATUS_UPLOAD_TERBUKA = new Set(["DRAF", "PERLU_REVISI"]);
export const STATUS_TERKUNCI = new Set(["DIKIRIM", "DISETUJUI", "DIFINALKAN", "DIARSIPKAN"]);
export const ACCEPT_DOKUMEN = ".pdf,.doc,.docx,.xls,.xlsx";

const MIME_LABEL: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
};

export function formatUkuran(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function labelMime(mime: string | null): string {
  if (!mime) return "—";
  return MIME_LABEL[mime] ?? mime;
}

export function bolehTampilUpload(status: string, isPemilik: boolean): boolean {
  return isPemilik && STATUS_UPLOAD_TERBUKA.has(status);
}

export function isDokumenTerkunci(status: string): boolean {
  return STATUS_TERKUNCI.has(status);
}

export function urutVersiTerbaru<T extends { nomor: number }>(versi: T[]): T[] {
  return [...versi].sort((a, b) => b.nomor - a.nomor);
}

export function potongHash(hash: string | null, len = 12): string {
  if (!hash) return "—";
  return hash.slice(0, len);
}
