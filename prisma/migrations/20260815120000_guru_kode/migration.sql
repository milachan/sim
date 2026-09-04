-- AlterTable
ALTER TABLE `guru` ADD COLUMN `kode` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Guru_kode_key` ON `guru`(`kode`);
