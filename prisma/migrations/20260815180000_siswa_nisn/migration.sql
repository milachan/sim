-- AlterTable
ALTER TABLE `Siswa` ADD COLUMN `nisn` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Siswa_nisn_key` ON `Siswa`(`nisn`);
