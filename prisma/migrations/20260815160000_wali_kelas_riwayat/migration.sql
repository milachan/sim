-- CreateTable
CREATE TABLE `WaliKelasRiwayat` (
    `id` VARCHAR(191) NOT NULL,
    `kelasId` VARCHAR(191) NOT NULL,
    `guruId` VARCHAR(191) NOT NULL,
    `semesterId` VARCHAR(191) NULL,
    `mulai` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `selesai` DATETIME(3) NULL,

    INDEX `WaliKelasRiwayat_kelasId_idx`(`kelasId`),
    INDEX `WaliKelasRiwayat_guruId_idx`(`guruId`),
    INDEX `WaliKelasRiwayat_semesterId_idx`(`semesterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WaliKelasRiwayat` ADD CONSTRAINT `WaliKelasRiwayat_kelasId_fkey` FOREIGN KEY (`kelasId`) REFERENCES `Kelas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WaliKelasRiwayat` ADD CONSTRAINT `WaliKelasRiwayat_guruId_fkey` FOREIGN KEY (`guruId`) REFERENCES `Guru`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WaliKelasRiwayat` ADD CONSTRAINT `WaliKelasRiwayat_semesterId_fkey` FOREIGN KEY (`semesterId`) REFERENCES `Semester`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
