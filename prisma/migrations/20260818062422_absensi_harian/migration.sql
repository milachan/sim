-- CreateTable
CREATE TABLE `AbsensiHarian` (
    `id` VARCHAR(191) NOT NULL,
    `kelasId` VARCHAR(191) NOT NULL,
    `tanggal` DATE NOT NULL,
    `pengisiId` VARCHAR(191) NOT NULL,
    `peranPengisi` ENUM('GURU_JAM_PERTAMA', 'GURU_PIKET') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AbsensiHarian_tanggal_kelasId_idx`(`tanggal`, `kelasId`),
    INDEX `AbsensiHarian_pengisiId_idx`(`pengisiId`),
    UNIQUE INDEX `AbsensiHarian_kelasId_tanggal_key`(`kelasId`, `tanggal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AbsensiHarianItem` (
    `id` VARCHAR(191) NOT NULL,
    `absensiHarianId` VARCHAR(191) NOT NULL,
    `siswaId` VARCHAR(191) NOT NULL,
    `status` ENUM('HADIR', 'SAKIT', 'IZIN', 'ALPA', 'TERLAMBAT', 'DISPENSASI') NOT NULL,
    `catatan` VARCHAR(191) NULL,

    INDEX `AbsensiHarianItem_siswaId_idx`(`siswaId`),
    UNIQUE INDEX `AbsensiHarianItem_absensiHarianId_siswaId_key`(`absensiHarianId`, `siswaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AbsensiHarian` ADD CONSTRAINT `AbsensiHarian_kelasId_fkey` FOREIGN KEY (`kelasId`) REFERENCES `Kelas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AbsensiHarian` ADD CONSTRAINT `AbsensiHarian_pengisiId_fkey` FOREIGN KEY (`pengisiId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AbsensiHarianItem` ADD CONSTRAINT `AbsensiHarianItem_absensiHarianId_fkey` FOREIGN KEY (`absensiHarianId`) REFERENCES `AbsensiHarian`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AbsensiHarianItem` ADD CONSTRAINT `AbsensiHarianItem_siswaId_fkey` FOREIGN KEY (`siswaId`) REFERENCES `Siswa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
