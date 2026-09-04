import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatJadwalDariHeader, susunBarisJadwal } from "./kolom-jadwal";

describe("formatJadwalDariHeader", () => {
  test("header template baru (Guru | Kode) → terpisah", () => {
    assert.equal(formatJadwalDariHeader(["Guru", "Kode", "Hari", "Jam Ke", "Mapel/Kegiatan", "Kelas"]), "terpisah");
  });
  test("header tanpa Kode (kode di dalam nama) → gabung", () => {
    assert.equal(formatJadwalDariHeader(["Guru", "Hari", "Jam Ke", "Mapel/Kegiatan", "Kelas"]), "gabung");
  });
  test("header non-guru → lama", () => {
    assert.equal(formatJadwalDariHeader(["HARI", "JAM MULAI", "JAM SELESAI", "NAMA GURU", "KELAS", "MATA PELAJARAN"]), "lama");
  });
});

describe("susunBarisJadwal — kolom Waktu opsional", () => {
  test("gabung tanpa kolom Waktu: mapel & kelas tidak bergeser", () => {
    const header = ["Guru", "Hari", "Jam Ke", "Mapel/Kegiatan", "Kelas"];
    const rows = [["Akhmadi, S.Pd. (K5)", "Senin", "4", "IPS", "IX F"]];
    const hasil = susunBarisJadwal(header, rows);
    assert.equal(hasil.format, "gabung");
    // Kanonik: [Guru, Hari, Jam Ke, "", Mapel, Kelas]
    assert.deepEqual(hasil.rows, [["Akhmadi, S.Pd. (K5)", "Senin", "4", "", "IPS", "IX F"]]);
  });

  test("gabung dengan kolom Waktu tetap diterima (isi tidak dipakai)", () => {
    const header = ["Guru", "Hari", "Jam Ke", "Waktu", "Mapel/Kegiatan", "Kelas"];
    const rows = [["Akhmadi, S.Pd. (K5)", "Senin", "4", "9:15 - 9:55", "IPS", "IX F"]];
    const hasil = susunBarisJadwal(header, rows);
    assert.equal(hasil.format, "gabung");
    assert.deepEqual(hasil.rows, [["Akhmadi, S.Pd. (K5)", "Senin", "4", "", "IPS", "IX F"]]);
  });

  test("terpisah tanpa kolom Waktu: kode tetap di kolomnya", () => {
    const header = ["Guru", "Kode", "Hari", "Jam Ke", "Mapel/Kegiatan", "Kelas"];
    const rows = [["Akhmadi, S.Pd.", "K5", "Senin", "4", "IPS", "IX F"]];
    const hasil = susunBarisJadwal(header, rows);
    assert.equal(hasil.format, "terpisah");
    assert.deepEqual(hasil.rows, [["Akhmadi, S.Pd.", "K5", "Senin", "4", "", "IPS", "IX F"]]);
  });

  test("terpisah dengan kolom Waktu di posisi lama → kanonik sama", () => {
    const header = ["Guru", "Kode", "Hari", "Jam Ke", "Waktu", "Mapel/Kegiatan", "Kelas"];
    const rows = [["Akhmadi, S.Pd.", "K5", "Senin", "4", "9:15 - 9:55", "IPS", "IX F"]];
    const hasil = susunBarisJadwal(header, rows);
    assert.equal(hasil.format, "terpisah");
    assert.deepEqual(hasil.rows, [["Akhmadi, S.Pd.", "K5", "Senin", "4", "", "IPS", "IX F"]]);
  });

  test("format lama tidak disentuh", () => {
    const header = ["HARI", "JAM MULAI", "JAM SELESAI", "NAMA GURU", "KELAS", "MATA PELAJARAN"];
    const rows = [["Senin", "4", "4", "Akhmadi, S.Pd.", "IX F", "IPS"]];
    const hasil = susunBarisJadwal(header, rows);
    assert.equal(hasil.format, "lama");
    assert.deepEqual(hasil.rows, rows);
  });

  test("header guru tapi kolom inti hilang → rows dibiarkan apa adanya", () => {
    const header = ["Guru", "Kode", "Hari"];
    const rows = [["Akhmadi, S.Pd.", "K5", "Senin"]];
    const hasil = susunBarisJadwal(header, rows);
    assert.equal(hasil.format, "terpisah");
    assert.deepEqual(hasil.rows, rows);
  });
});
