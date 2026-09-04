export const MAKS_UKURAN_FILE = 10 * 1024 * 1024; // 10 MB
export const MAKS_BODY_UPLOAD = 12 * 1024 * 1024;

export const EXT_IZIN = new Set(["pdf", "doc", "docx", "xls", "xlsx"]);

export const MIME_IZIN: Record<string, string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
};

const ALL_MIME_IZIN = new Set(Object.values(MIME_IZIN).flat());

export function ekstensiDariNama(nama: string): string {
  return (nama.split(".").pop() ?? "").toLowerCase();
}

export function isExtIzin(ext: string): boolean {
  return EXT_IZIN.has(ext);
}

export function isMimeIzin(mime: string): boolean {
  return ALL_MIME_IZIN.has(mime);
}

export function isMimetypeSesuaiExt(mime: string, ext: string): boolean {
  const allowed = MIME_IZIN[ext];
  if (!allowed) return false;
  return allowed.includes(mime);
}

export function validasiFile(namaAsli: string, mimeTipe: string, ukuran: number): string | null {
  const ext = ekstensiDariNama(namaAsli);
  if (!isExtIzin(ext)) return "Extension tidak diizinkan. Gunakan PDF, DOC, DOCX, XLS, atau XLSX.";
  if (mimeTipe && !isMimeIzin(mimeTipe)) return "MIME type tidak diizinkan.";
  if (mimeTipe && !isMimetypeSesuaiExt(mimeTipe, ext)) return "MIME tidak sesuai dengan extension file.";
  if (ukuran > MAKS_UKURAN_FILE) return "Ukuran file maksimal 10 MB.";
  if (ukuran === 0) return "File kosong.";
  return null;
}

const SIGNATURE: { ext: string; magic: number[]; offset?: number }[] = [
  { ext: "pdf", magic: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { ext: "docx", magic: [0x50, 0x4b, 0x03, 0x04] }, // ZIP (OOXML)
  { ext: "xlsx", magic: [0x50, 0x4b, 0x03, 0x04] },
  { ext: "doc", magic: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }, // OLE
  { ext: "xls", magic: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
];

export function cekMagicBytes(buf: Buffer, ext: string): boolean {
  const sigs = SIGNATURE.filter((s) => s.ext === ext);
  if (sigs.length === 0) return true;
  return sigs.some((s) => {
    const off = s.offset ?? 0;
    if (buf.length < off + s.magic.length) return false;
    return s.magic.every((b, i) => buf[off + i] === b);
  });
}

export function cekPathTraversal(nama: string): boolean {
  return nama.includes("..") || nama.includes("/") || nama.includes("\\") || nama.includes("\x00");
}
