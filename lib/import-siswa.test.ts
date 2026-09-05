import test from "node:test";
import assert from "node:assert/strict";
import { bacaJenisKelamin, cariKolom } from "./import-siswa";

test("cariKolom mendeteksi kolom JENIS KELAMIN dari berbagai header", () => {
  const a = cariKolom(["NISN", "NIS", "NAMA", "JENIS KELAMIN", "KELAS"]);
  assert.equal(a.jk, 3);
  const b = cariKolom(["NISN", "NIS", "NAMA", "JK", "KELAS"]);
  assert.equal(b.jk, 3);
  const c = cariKolom(["NISN", "NIS", "NAMA", "Jenis Kelamin", "Kelas"]);
  assert.equal(c.jk, 3);
  const d = cariKolom(["NISN", "NIS", "NAMA", "JENIS_KELAMIN", "KELAS"]);
  assert.equal(d.jk, 3);
  const e = cariKolom(["NISN", "NIS", "NAMA", "GENDER", "KELAS"]);
  assert.equal(e.jk, 3);
  // Tanpa kolom JK → -1 (opsional)
  const f = cariKolom(["NISN", "NIS", "NAMA", "KELAS"]);
  assert.equal(f.jk, -1);
});

test("bacaJenisKelamin menormalkan L/P & varian lainnya", () => {
  assert.deepEqual(bacaJenisKelamin("L"), { nilai: "L" });
  assert.deepEqual(bacaJenisKelamin("l"), { nilai: "L" });
  assert.deepEqual(bacaJenisKelamin("Laki-laki"), { nilai: "L" });
  assert.deepEqual(bacaJenisKelamin("LAKI LAKI"), { nilai: "L" });
  assert.deepEqual(bacaJenisKelamin("P"), { nilai: "P" });
  assert.deepEqual(bacaJenisKelamin("p"), { nilai: "P" });
  assert.deepEqual(bacaJenisKelamin("Perempuan"), { nilai: "P" });
  assert.deepEqual(bacaJenisKelamin(""), { nilai: null });
  assert.deepEqual(bacaJenisKelamin("   "), { nilai: null });
});

test("bacaJenisKelamin menolak nilai tak dikenal", () => {
  const hasil = bacaJenisKelamin("X");
  assert.ok("error" in hasil);
  assert.match(hasil.error, /tidak dikenal/);
});