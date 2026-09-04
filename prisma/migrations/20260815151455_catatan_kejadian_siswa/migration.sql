-- CreateTable
CREATE TABLE `CatatanKejadian` (
    `id` VARCHAR(191) NOT NULL,
    `pertemuanId` VARCHAR(191) NOT NULL,
    `siswaId` VARCHAR(191) NOT NULL,
    `jenis` ENUM('TERLAMBAT', 'IZIN_KELUAR', 'TIDAK_DI_KELAS', 'SAKIT', 'PULANG', 'LAINNYA') NOT NULL,
    `keterangan` VARCHAR(191) NULL,
    `dibuatOlehId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CatatanKejadian_pertemuanId_idx`(`pertemuanId`),
    INDEX `CatatanKejadian_siswaId_idx`(`siswaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CatatanKejadian` ADD CONSTRAINT `CatatanKejadian_pertemuanId_fkey` FOREIGN KEY (`pertemuanId`) REFERENCES `Pertemuan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CatatanKejadian` ADD CONSTRAINT `CatatanKejadian_siswaId_fkey` FOREIGN KEY (`siswaId`) REFERENCES `Siswa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CatatanKejadian` ADD CONSTRAINT `CatatanKejadian_dibuatOlehId_fkey` FOREIGN KEY (`dibuatOlehId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
