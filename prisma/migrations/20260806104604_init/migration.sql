-- CreateTable
CREATE TABLE `Sekolah` (
    `id` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `npsn` VARCHAR(191) NULL,
    `alamat` VARCHAR(191) NULL,
    `telepon` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `role` ENUM('GURU', 'WAKA', 'ADMIN', 'SUPERADMIN', 'KEPALA') NOT NULL DEFAULT 'GURU',
    `aktif` BOOLEAN NOT NULL DEFAULT true,
    `guruId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    UNIQUE INDEX `User_guruId_key`(`guruId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Guru` (
    `id` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `nip` VARCHAR(191) NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Guru_nip_key`(`nip`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Siswa` (
    `id` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `nis` VARCHAR(191) NULL,
    `kelasId` VARCHAR(191) NULL,
    `status` ENUM('AKTIF', 'ALUMNI', 'KELUAR') NOT NULL DEFAULT 'AKTIF',
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Siswa_nis_key`(`nis`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Kelas` (
    `id` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `tingkat` INTEGER NOT NULL,
    `waliKelasId` VARCHAR(191) NULL,

    UNIQUE INDEX `Kelas_nama_key`(`nama`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MataPelajaran` (
    `id` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `kode` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TahunAjaran` (
    `id` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `aktif` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `TahunAjaran_nama_key`(`nama`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Semester` (
    `id` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `aktif` BOOLEAN NOT NULL DEFAULT false,
    `tahunAjaranId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Jadwal` (
    `id` VARCHAR(191) NOT NULL,
    `guruId` VARCHAR(191) NOT NULL,
    `kelasId` VARCHAR(191) NOT NULL,
    `mapelId` VARCHAR(191) NOT NULL,
    `semesterId` VARCHAR(191) NOT NULL,
    `hari` ENUM('SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU') NOT NULL,
    `jamKeMulai` INTEGER NOT NULL,
    `jamKeSelesai` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Pertemuan` (
    `id` VARCHAR(191) NOT NULL,
    `jadwalId` VARCHAR(191) NOT NULL,
    `tanggal` DATE NOT NULL,
    `pertemuanKe` INTEGER NOT NULL,
    `status` ENUM('BELUM_DIMULAI', 'ABSENSI_TERISI', 'JURNAL_TERISI', 'LENGKAP', 'TIDAK_TERLAKSANA') NOT NULL DEFAULT 'BELUM_DIMULAI',
    `sumber` ENUM('OTOMATIS', 'MANUAL') NOT NULL DEFAULT 'OTOMATIS',
    `alasanManual` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Pertemuan_jadwalId_tanggal_key`(`jadwalId`, `tanggal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AbsensiItem` (
    `id` VARCHAR(191) NOT NULL,
    `pertemuanId` VARCHAR(191) NOT NULL,
    `siswaId` VARCHAR(191) NOT NULL,
    `status` ENUM('HADIR', 'SAKIT', 'IZIN', 'ALPA', 'TERLAMBAT', 'DISPENSASI') NOT NULL DEFAULT 'HADIR',
    `catatan` VARCHAR(191) NULL,

    UNIQUE INDEX `AbsensiItem_pertemuanId_siswaId_key`(`pertemuanId`, `siswaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Jurnal` (
    `id` VARCHAR(191) NOT NULL,
    `pertemuanId` VARCHAR(191) NOT NULL,
    `materi` VARCHAR(191) NULL,
    `tujuan` VARCHAR(191) NULL,
    `kegiatan` VARCHAR(191) NULL,
    `metode` VARCHAR(191) NULL,
    `media` VARCHAR(191) NULL,
    `hasil` VARCHAR(191) NULL,
    `kendala` VARCHAR(191) NULL,
    `tindakLanjut` VARCHAR(191) NULL,
    `catatan` VARCHAR(191) NULL,
    `dokumentasiUrl` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'TERKIRIM') NOT NULL DEFAULT 'DRAFT',
    `dibuatPada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `diubahPada` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Jurnal_pertemuanId_key`(`pertemuanId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PenilaianKegiatan` (
    `id` VARCHAR(191) NOT NULL,
    `jadwalId` VARCHAR(191) NOT NULL,
    `jenis` ENUM('TUGAS', 'KUIS', 'ULANGAN_HARIAN', 'PRAKTIK', 'PROYEK', 'PRESENTASI', 'PORTOFOLIO', 'PTS', 'PAS', 'REMEDIAL', 'PENGAYAAN') NOT NULL,
    `judul` VARCHAR(191) NOT NULL,
    `tanggal` DATE NOT NULL,
    `nilaiMaksimal` INTEGER NOT NULL DEFAULT 100,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NilaiSiswa` (
    `id` VARCHAR(191) NOT NULL,
    `kegiatanId` VARCHAR(191) NOT NULL,
    `siswaId` VARCHAR(191) NOT NULL,
    `nilai` DOUBLE NULL,
    `catatan` VARCHAR(191) NULL,
    `statusKumpul` ENUM('DIKUMPULKAN', 'BELUM', 'TERLAMBAT') NOT NULL DEFAULT 'BELUM',

    UNIQUE INDEX `NilaiSiswa_kegiatanId_siswaId_key`(`kegiatanId`, `siswaId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RiwayatPerubahan` (
    `id` VARCHAR(191) NOT NULL,
    `entitas` VARCHAR(191) NOT NULL,
    `entitasId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `perubahan` JSON NOT NULL,
    `waktu` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KalenderAkademik` (
    `id` VARCHAR(191) NOT NULL,
    `tanggal` DATE NOT NULL,
    `keterangan` VARCHAR(191) NOT NULL,
    `tipe` VARCHAR(191) NOT NULL DEFAULT 'KEGIATAN',
    `tahunAjaranId` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Setting` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Setting_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_GuruToMataPelajaran` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_GuruToMataPelajaran_AB_unique`(`A`, `B`),
    INDEX `_GuruToMataPelajaran_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_guruId_fkey` FOREIGN KEY (`guruId`) REFERENCES `Guru`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Siswa` ADD CONSTRAINT `Siswa_kelasId_fkey` FOREIGN KEY (`kelasId`) REFERENCES `Kelas`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Kelas` ADD CONSTRAINT `Kelas_waliKelasId_fkey` FOREIGN KEY (`waliKelasId`) REFERENCES `Guru`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Semester` ADD CONSTRAINT `Semester_tahunAjaranId_fkey` FOREIGN KEY (`tahunAjaranId`) REFERENCES `TahunAjaran`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Jadwal` ADD CONSTRAINT `Jadwal_guruId_fkey` FOREIGN KEY (`guruId`) REFERENCES `Guru`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Jadwal` ADD CONSTRAINT `Jadwal_kelasId_fkey` FOREIGN KEY (`kelasId`) REFERENCES `Kelas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Jadwal` ADD CONSTRAINT `Jadwal_mapelId_fkey` FOREIGN KEY (`mapelId`) REFERENCES `MataPelajaran`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Jadwal` ADD CONSTRAINT `Jadwal_semesterId_fkey` FOREIGN KEY (`semesterId`) REFERENCES `Semester`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pertemuan` ADD CONSTRAINT `Pertemuan_jadwalId_fkey` FOREIGN KEY (`jadwalId`) REFERENCES `Jadwal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AbsensiItem` ADD CONSTRAINT `AbsensiItem_pertemuanId_fkey` FOREIGN KEY (`pertemuanId`) REFERENCES `Pertemuan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AbsensiItem` ADD CONSTRAINT `AbsensiItem_siswaId_fkey` FOREIGN KEY (`siswaId`) REFERENCES `Siswa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Jurnal` ADD CONSTRAINT `Jurnal_pertemuanId_fkey` FOREIGN KEY (`pertemuanId`) REFERENCES `Pertemuan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PenilaianKegiatan` ADD CONSTRAINT `PenilaianKegiatan_jadwalId_fkey` FOREIGN KEY (`jadwalId`) REFERENCES `Jadwal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NilaiSiswa` ADD CONSTRAINT `NilaiSiswa_kegiatanId_fkey` FOREIGN KEY (`kegiatanId`) REFERENCES `PenilaianKegiatan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NilaiSiswa` ADD CONSTRAINT `NilaiSiswa_siswaId_fkey` FOREIGN KEY (`siswaId`) REFERENCES `Siswa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RiwayatPerubahan` ADD CONSTRAINT `RiwayatPerubahan_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KalenderAkademik` ADD CONSTRAINT `KalenderAkademik_tahunAjaranId_fkey` FOREIGN KEY (`tahunAjaranId`) REFERENCES `TahunAjaran`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_GuruToMataPelajaran` ADD CONSTRAINT `_GuruToMataPelajaran_A_fkey` FOREIGN KEY (`A`) REFERENCES `Guru`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_GuruToMataPelajaran` ADD CONSTRAINT `_GuruToMataPelajaran_B_fkey` FOREIGN KEY (`B`) REFERENCES `MataPelajaran`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
