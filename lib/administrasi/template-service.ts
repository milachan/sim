import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ekstensiDariNama } from "@/lib/administrasi/document-validation";
import {
  hapusFile,
  hitungSha256,
  sanitasiNamaAsli,
  simpanFile,
} from "@/lib/administrasi/document-storage";
import { mimeDariEkstensi, NAMESPACE_TEMPLATE } from "@/lib/administrasi/template-validasi";

// Service backend Template Dokumen: storage privat, versioning immutable
// dengan nomor atomik (unique templateId+nomor + retry P2002), dan audit.

export type AksiTemplate =
  | "dibuat"
  | "metadata_diubah"
  | "versi_diunggah"
  | "diaktifkan"
  | "dinonaktifkan";

export async function catatRiwayatTemplate(
  templateId: string,
  aksi: AksiTemplate,
  aktorUserId: string,
  payload?: Record<string, unknown>
): Promise<void> {
  await prisma.riwayatTemplateDokumen.create({
    data: {
      templateId,
      aksi,
      aktorUserId,
      payload: (payload ?? {}) as never,
    },
  });
}

export type HasilUnggahVersi = {
  id: string;
  nomor: number;
  sha256: string;
  ukuran: number;
};

/**
 * Menyimpan file versi baru untuk sebuah template.
 * - File ditulis ke storage privat namespace "template".
 * - Nomor versi = (nomor tertinggi) + 1, atomik via transaksi + unique
 *   constraint (templateId, nomor); bentrok P2002 di-retry maks 3 kali.
 * - Versi lama TIDAK pernah ditimpa/dihapus (immutable).
 * - Jika metadata gagal, file yang sudah tertulis dibersihkan.
 * - Versi aktif template = versi dengan nomor tertinggi (diambil saat baca).
 */
export async function unggahVersiTemplate(input: {
  templateId: string;
  buffer: Buffer;
  namaAsli: string;
  mimeTipe: string;
  aktorUserId: string;
}): Promise<HasilUnggahVersi> {
  const ext = ekstensiDariNama(input.namaAsli);
  const sha256 = hitungSha256(input.buffer);
  const namaAsli = sanitasiNamaAsli(input.namaAsli);
  const mime = input.mimeTipe || mimeDariEkstensi(ext);

  let kunci: string | null = null;
  try {
    kunci = await simpanFile(input.buffer, ext, NAMESPACE_TEMPLATE);
  } catch {
    throw new Error("Gagal menyimpan file.");
  }

  const COBA_MAKS = 3;
  for (let percobaan = 0; percobaan < COBA_MAKS; percobaan++) {
    try {
      const hasil = await prisma.$transaction(async (tx) => {
        const template = await tx.templateDokumen.findUnique({ where: { id: input.templateId } });
        if (!template) {
          throw Object.assign(new Error("Template tidak ditemukan."), { statusCode: 404 });
        }
        const terakhir = await tx.versiTemplateDokumen.findFirst({
          where: { templateId: input.templateId },
          orderBy: { nomor: "desc" },
          select: { nomor: true },
        });
        const nomor = (terakhir?.nomor ?? 0) + 1;
        const versi = await tx.versiTemplateDokumen.create({
          data: {
            templateId: input.templateId,
            nomor,
            namaAsli,
            mime,
            ukuran: input.buffer.length,
            kunciPenyimpanan: kunci!,
            sha256,
            dibuatOlehId: input.aktorUserId,
          },
          select: { id: true, nomor: true },
        });
        await tx.riwayatTemplateDokumen.create({
          data: {
            templateId: input.templateId,
            aksi: "versi_diunggah",
            aktorUserId: input.aktorUserId,
            payload: { versiId: versi.id, nomor, namaAsli, mime, ukuran: input.buffer.length, sha256 } as never,
          },
        });
        return { id: versi.id, nomor: versi.nomor, sha256, ukuran: input.buffer.length };
      });
      return hasil;
    } catch (e: unknown) {
      const kode = e instanceof Prisma.PrismaClientKnownRequestError ? e.code : null;
      if (kode === "P2002" && percobaan < COBA_MAKS - 1) {
        // Dua upload bersamaan berebut nomor — coba lagi (nomor dihitung ulang).
        continue;
      }
      if (kunci) await hapusFile(kunci, NAMESPACE_TEMPLATE);
      const status = (e as { statusCode?: number }).statusCode;
      throw Object.assign(new Error(e instanceof Error && e.message ? e.message : "Gagal menyimpan versi template."), {
        statusCode: status ?? 500,
      });
    }
  }
  if (kunci) await hapusFile(kunci, NAMESPACE_TEMPLATE);
  throw Object.assign(new Error("Terjadi bentrok versi, coba lagi."), { statusCode: 409 });
}
