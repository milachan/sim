/*
  Warnings:

  - You are about to alter the column `jenis` on the `dokumen` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(18))`.
  - You are about to alter the column `status` on the `dokumen` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(17))`.

*/
-- AlterTable
ALTER TABLE `dokumen` MODIFY `jenis` ENUM('PROPOSAL', 'RPP_MODUL_AJAR', 'LAPORAN_KEGIATAN', 'DOKUMEN_UMUM') NOT NULL,
    MODIFY `status` ENUM('DRAF', 'DIKIRIM', 'PERLU_REVISI', 'DISETUJUI', 'DIFINALKAN', 'DIARSIPKAN') NOT NULL DEFAULT 'DRAF';

-- AlterTable
ALTER TABLE `siswa` ADD COLUMN `jenisKelamin` ENUM('L', 'P') NULL;
