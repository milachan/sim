-- CreateIndex
CREATE INDEX `AbsensiItem_siswaId_status_idx` ON `AbsensiItem`(`siswaId`, `status`);

-- CreateIndex
CREATE INDEX `AbsensiItem_pertemuanId_status_idx` ON `AbsensiItem`(`pertemuanId`, `status`);

-- CreateIndex
CREATE INDEX `Jadwal_guruId_semesterId_hari_idx` ON `Jadwal`(`guruId`, `semesterId`, `hari`);

-- CreateIndex
CREATE INDEX `Jadwal_kelasId_semesterId_hari_idx` ON `Jadwal`(`kelasId`, `semesterId`, `hari`);

-- CreateIndex
CREATE INDEX `Jurnal_status_diubahPada_idx` ON `Jurnal`(`status`, `diubahPada`);

-- CreateIndex
CREATE INDEX `PenilaianKegiatan_jadwalId_tanggal_idx` ON `PenilaianKegiatan`(`jadwalId`, `tanggal`);

-- CreateIndex
CREATE INDEX `Pertemuan_tanggal_status_idx` ON `Pertemuan`(`tanggal`, `status`);

-- CreateIndex
CREATE INDEX `Pertemuan_jadwalId_status_tanggal_idx` ON `Pertemuan`(`jadwalId`, `status`, `tanggal`);

-- CreateIndex
CREATE INDEX `Siswa_kelasId_status_idx` ON `Siswa`(`kelasId`, `status`);
