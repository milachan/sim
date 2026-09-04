-- AlterTable
ALTER TABLE `pertemuan` ADD COLUMN `kelasId` VARCHAR(191) NULL,
    ADD COLUMN `mapelId` VARCHAR(191) NULL,
    MODIFY `jadwalId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `Pertemuan` ADD CONSTRAINT `Pertemuan_kelasId_fkey` FOREIGN KEY (`kelasId`) REFERENCES `Kelas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pertemuan` ADD CONSTRAINT `Pertemuan_mapelId_fkey` FOREIGN KEY (`mapelId`) REFERENCES `MataPelajaran`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
