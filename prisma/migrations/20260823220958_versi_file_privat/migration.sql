-- VersiDokumen: metadata file privat versi baru (immutable per versi).
-- Additive: hanya menambah kolom nullable pada VersiDokumen; tidak menyentuh tabel jurnal.

ALTER TABLE `VersiDokumen` ADD COLUMN `namaAsli` VARCHAR(191) NULL;
ALTER TABLE `VersiDokumen` ADD COLUMN `mime` VARCHAR(191) NULL;
ALTER TABLE `VersiDokumen` ADD COLUMN `ukuran` INTEGER NULL;
ALTER TABLE `VersiDokumen` ADD COLUMN `kunciPenyimpanan` VARCHAR(191) NULL;
ALTER TABLE `VersiDokumen` ADD COLUMN `sha256` VARCHAR(191) NULL;