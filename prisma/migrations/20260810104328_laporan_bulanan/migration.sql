-- CreateTable
CREATE TABLE `LaporanBulanan` (
    `id` VARCHAR(191) NOT NULL,
    `bulan` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'DIPERIKSA', 'DISETUJUI') NOT NULL DEFAULT 'DRAFT',
    `dibuatOlehId` VARCHAR(191) NULL,
    `diperiksaOlehId` VARCHAR(191) NULL,
    `disetujuiOlehId` VARCHAR(191) NULL,
    `catatanWaka` VARCHAR(191) NULL,
    `catatanKamad` VARCHAR(191) NULL,
    `sampling` JSON NULL,
    `diperiksaPada` DATETIME(3) NULL,
    `disetujuiPada` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LaporanBulanan_bulan_key`(`bulan`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LaporanBulanan` ADD CONSTRAINT `LaporanBulanan_dibuatOlehId_fkey` FOREIGN KEY (`dibuatOlehId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LaporanBulanan` ADD CONSTRAINT `LaporanBulanan_diperiksaOlehId_fkey` FOREIGN KEY (`diperiksaOlehId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LaporanBulanan` ADD CONSTRAINT `LaporanBulanan_disetujuiOlehId_fkey` FOREIGN KEY (`disetujuiOlehId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
