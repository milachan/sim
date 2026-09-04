-- CreateTable
CREATE TABLE `RiwayatPush` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `judul` VARCHAR(191) NOT NULL,
    `isi` VARCHAR(191) NOT NULL,
    `jenis` VARCHAR(191) NOT NULL DEFAULT 'PENGINGAT',
    `url` VARCHAR(191) NULL,
    `tag` VARCHAR(191) NULL,
    `sasaran` INTEGER NOT NULL DEFAULT 0,
    `perangkat` INTEGER NOT NULL DEFAULT 0,
    `detail` JSON NULL,
    `dikirimPada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RiwayatPush` ADD CONSTRAINT `RiwayatPush_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

