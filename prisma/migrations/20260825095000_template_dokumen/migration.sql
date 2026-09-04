-- CreateTable
CREATE TABLE `TemplateDokumen` (
    `id` VARCHAR(191) NOT NULL,
    `jenis` ENUM('PROPOSAL', 'RPP_MODUL_AJAR', 'LAPORAN_KEGIATAN', 'DOKUMEN_UMUM') NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `deskripsi` TEXT NULL,
    `aktif` BOOLEAN NOT NULL DEFAULT false,
    `dibuatOlehId` VARCHAR(191) NOT NULL,
    `diperbaruiOlehId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TemplateDokumen_jenis_aktif_idx`(`jenis`, `aktif`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VersiTemplateDokumen` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `nomor` INTEGER NOT NULL,
    `namaAsli` VARCHAR(191) NOT NULL,
    `mime` VARCHAR(191) NOT NULL,
    `ukuran` INTEGER NOT NULL,
    `kunciPenyimpanan` VARCHAR(191) NOT NULL,
    `sha256` VARCHAR(191) NOT NULL,
    `dibuatOlehId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `VersiTemplateDokumen_templateId_nomor_key`(`templateId`, `nomor`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RiwayatTemplateDokumen` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `aksi` VARCHAR(191) NOT NULL,
    `payload` JSON NULL,
    `aktorUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RiwayatTemplateDokumen_templateId_createdAt_idx`(`templateId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VersiTemplateDokumen` ADD CONSTRAINT `VersiTemplateDokumen_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `TemplateDokumen`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

