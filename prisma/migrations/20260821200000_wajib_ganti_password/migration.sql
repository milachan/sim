-- AlterTable: tambah flag wajib mengganti password awal (opsional, default false).
-- Aman untuk data lama: semua akun existing mendapat default false (tidak wajib ganti password).
ALTER TABLE `User` ADD COLUMN `wajibGantiPassword` BOOLEAN NOT NULL DEFAULT false;
