-- CreateTable
CREATE TABLE `JamPelajaran` (
    `id` VARCHAR(191) NOT NULL,
    `hari` ENUM('SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU') NOT NULL,
    `jamKe` INTEGER NOT NULL,
    `mulai` VARCHAR(191) NOT NULL,
    `selesai` VARCHAR(191) NOT NULL,

    INDEX `JamPelajaran_hari_idx`(`hari`),
    UNIQUE INDEX `JamPelajaran_hari_jamKe_key`(`hari`, `jamKe`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordChangeRequest` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `newPaswordHash` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `catatanAdmin` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,

    INDEX `PasswordChangeRequest_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PasswordChangeRequest` ADD CONSTRAINT `PasswordChangeRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
