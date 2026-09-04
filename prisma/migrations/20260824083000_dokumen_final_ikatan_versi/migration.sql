-- DokumenFinal: ikatan eksplisit ke VersiDokumen (FK versiId, RESTRICT)
-- dan satu VersiDokumen hanya boleh menjadi final untuk satu record.
-- Additive: tabel kosong saat penerapan; tidak menyentuh tabel jurnal.

ALTER TABLE `DokumenFinal` ADD CONSTRAINT `DokumenFinal_versiId_fkey` FOREIGN KEY (`versiId`) REFERENCES `VersiDokumen`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX `DokumenFinal_versiId_key` ON `DokumenFinal`(`versiId`);
