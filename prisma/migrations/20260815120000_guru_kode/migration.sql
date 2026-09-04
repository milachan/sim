-- AlterTable
ALTER TABLE `Guru` ADD COLUMN `kode` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Guru_kode_key` ON `Guru`(`kode`);
