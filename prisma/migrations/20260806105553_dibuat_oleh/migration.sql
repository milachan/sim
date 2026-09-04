-- AlterTable
ALTER TABLE `pertemuan` ADD COLUMN `dibuatOlehId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `Pertemuan` ADD CONSTRAINT `Pertemuan_dibuatOlehId_fkey` FOREIGN KEY (`dibuatOlehId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
