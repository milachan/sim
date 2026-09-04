-- Rumah Administrasi - tabel baru saja; tidak mengubah tabel jurnal (Jurnal, Pertemuan, Jadwal, NilaiSiswa, dsb).
-- Aman additive: hanya CREATE TABLE + CREATE INDEX untuk model Dokumen/Versi/Lampiran/Riwayat baru.
-- Enum JenisDokumen/StatusDokumen disimpan sebagai VARCHAR oleh Prisma MySQL; tidak ada ALTER pada enum existing.

-- CreateTable Dokumen
CREATE TABLE `Dokumen` (
    `id` VARCHAR(191) NOT NULL,
    `jenis` VARCHAR(191) NOT NULL,
    `judul` VARCHAR(191) NOT NULL,
    `ringkasan` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAF',
    `pengajuUserId` VARCHAR(191) NOT NULL,
    `pengajuGuruId` VARCHAR(191) NULL,
    `arsip` BOOLEAN NOT NULL DEFAULT false,
    `versiAktif` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    CONSTRAINT `Dokumen_pkey` PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable VersiDokumen
CREATE TABLE `VersiDokumen` (
    `id` VARCHAR(191) NOT NULL,
    `dokumenId` VARCHAR(191) NOT NULL,
    `nomor` INTEGER NOT NULL,
    `judul` VARCHAR(191) NOT NULL,
    `ringkasan` TEXT NULL,
    `snapshotLampiranIds` JSON NULL,
    `dibuatOlehUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT `VersiDokumen_pkey` PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable LampiranDokumen
CREATE TABLE `LampiranDokumen` (
    `id` VARCHAR(191) NOT NULL,
    `dokumenId` VARCHAR(191) NOT NULL,
    `namaAsli` VARCHAR(191) NOT NULL,
    `mime` VARCHAR(191) NOT NULL,
    `ukuran` INTEGER NOT NULL,
    `kunciPenyimpanan` VARCHAR(191) NOT NULL,
    `sha256` VARCHAR(191) NOT NULL,
    `diunggahOlehUserId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT `LampiranDokumen_pkey` PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable RiwayatDokumen
CREATE TABLE `RiwayatDokumen` (
    `id` VARCHAR(191) NOT NULL,
    `dokumenId` VARCHAR(191) NOT NULL,
    `aksi` VARCHAR(191) NOT NULL,
    `dariStatus` VARCHAR(191) NULL,
    `keStatus` VARCHAR(191) NULL,
    `aktorUserId` VARCHAR(191) NULL,
    `payload` JSON NULL,
    `waktu` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    CONSTRAINT `RiwayatDokumen_pkey` PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Dokumen_pengajuUserId_idx` ON `Dokumen`(`pengajuUserId`);
CREATE INDEX `Dokumen_status_jenis_idx` ON `Dokumen`(`status`, `jenis`);
CREATE INDEX `Dokumen_arsip_status_idx` ON `Dokumen`(`arsip`, `status`);
CREATE UNIQUE INDEX `VersiDokumen_dokumenId_nomor_key` ON `VersiDokumen`(`dokumenId`, `nomor`);
CREATE INDEX `VersiDokumen_dokumenId_idx` ON `VersiDokumen`(`dokumenId`);
CREATE INDEX `LampiranDokumen_dokumenId_idx` ON `LampiranDokumen`(`dokumenId`);
CREATE INDEX `RiwayatDokumen_dokumenId_waktu_idx` ON `RiwayatDokumen`(`dokumenId`, `waktu`);

-- AddForeignKey
ALTER TABLE `VersiDokumen` ADD CONSTRAINT `VersiDokumen_dokumenId_fkey` FOREIGN KEY (`dokumenId`) REFERENCES `Dokumen`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LampiranDokumen` ADD CONSTRAINT `LampiranDokumen_dokumenId_fkey` FOREIGN KEY (`dokumenId`) REFERENCES `Dokumen`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `RiwayatDokumen` ADD CONSTRAINT `RiwayatDokumen_dokumenId_fkey` FOREIGN KEY (`dokumenId`) REFERENCES `Dokumen`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;