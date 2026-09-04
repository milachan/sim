-- DokumenFinal: bukti finalisasi dokumen Administrasi (satu per dokumen).
-- Additive: hanya CREATE TABLE + index unique; tidak menyentuh tabel jurnal.
-- kodeVerifikasi acak berentropi tinggi, tanpa userId/path/storage key/checksum.

CREATE TABLE `DokumenFinal` (
    `id` VARCHAR(191) NOT NULL,
    `dokumenId` VARCHAR(191) NOT NULL,
    `versiId` VARCHAR(191) NOT NULL,
    `nomorVersi` INTEGER NOT NULL,
    `sha256` VARCHAR(191) NOT NULL,
    `ukuran` INTEGER NOT NULL,
    `mime` VARCHAR(191) NOT NULL,
    `namaAsli` VARCHAR(191) NOT NULL,
    `kodeVerifikasi` VARCHAR(191) NOT NULL,
    `difinalkanOlehId` VARCHAR(191) NOT NULL,
    `difinalkanPada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT `DokumenFinal_pkey` PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `DokumenFinal_dokumenId_key` ON `DokumenFinal`(`dokumenId`);
CREATE UNIQUE INDEX `DokumenFinal_kodeVerifikasi_key` ON `DokumenFinal`(`kodeVerifikasi`);

ALTER TABLE `DokumenFinal` ADD CONSTRAINT `DokumenFinal_dokumenId_fkey` FOREIGN KEY (`dokumenId`) REFERENCES `Dokumen`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;