-- CreateTable
CREATE TABLE `NotifikasiAdministrasi` (
    `id` VARCHAR(191) NOT NULL,
    `penerimaUserId` VARCHAR(191) NOT NULL,
    `dokumenId` VARCHAR(191) NOT NULL,
    `jenis` ENUM('DOKUMEN_DIKIRIM', 'REVISI_DIKIRIM', 'PERLU_REVISI', 'DISETUJUI', 'DIFINALKAN') NOT NULL,
    `judul` VARCHAR(191) NOT NULL,
    `isi` VARCHAR(400) NOT NULL,
    `eventKey` VARCHAR(191) NOT NULL,
    `dibacaPada` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `NotifikasiAdministrasi_penerimaUserId_eventKey_key`(`penerimaUserId`, `eventKey`),
    INDEX `NotifikasiAdministrasi_penerimaUserId_dibacaPada_createdAt_idx`(`penerimaUserId`, `dibacaPada`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `NotifikasiAdministrasi` ADD CONSTRAINT `NotifikasiAdministrasi_penerimaUserId_fkey` FOREIGN KEY (`penerimaUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotifikasiAdministrasi` ADD CONSTRAINT `NotifikasiAdministrasi_dokumenId_fkey` FOREIGN KEY (`dokumenId`) REFERENCES `Dokumen`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
