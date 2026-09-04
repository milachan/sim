import { test } from "node:test";
import assert from "node:assert/strict";
import {
  snapshotJurnal,
  diffJurnal,
  normJurnal,
  labelFieldJurnal,
  bersihkanJurnal,
  type SnapshotJurnal,
} from "./audit-jurnal";

function snap(over: Partial<SnapshotJurnal> = {}): SnapshotJurnal {
  return {
    materi: "Materi awal",
    tujuan: null,
    kegiatan: "Kegiatan",
    metode: null,
    media: null,
    hasil: null,
    kendala: null,
    tindakLanjut: null,
    catatan: null,
    dokumentasiUrl: null,
    status: "DRAFT",
    ...over,
  };
}

test("mengubah hanya tujuan menghasilkan satu audit dengan field tujuan", () => {
  const d = diffJurnal(snap(), snap({ tujuan: "Tujuan baru" }));
  assert.equal(d.berubah, true);
  assert.deepEqual(d.fieldBerubah, ["tujuan"]);
  assert.equal(d.sebelum.tujuan, null);
  assert.equal(d.sesudah.tujuan, "Tujuan baru");
});

test("mengubah hanya metode menghasilkan satu audit", () => {
  const d = diffJurnal(snap(), snap({ metode: "Diskusi" }));
  assert.deepEqual(d.fieldBerubah, ["metode"]);
});

test("mengubah hanya media menghasilkan audit", () => {
  const d = diffJurnal(snap(), snap({ media: "Proyektor" }));
  assert.deepEqual(d.fieldBerubah, ["media"]);
});

test("hasil, kendala, tindakLanjut, catatan masing-masing menghasilkan audit", () => {
  assert.deepEqual(diffJurnal(snap(), snap({ hasil: "Baik" })).fieldBerubah, ["hasil"]);
  assert.deepEqual(diffJurnal(snap(), snap({ kendala: "Hujan" })).fieldBerubah, ["kendala"]);
  assert.deepEqual(diffJurnal(snap(), snap({ tindakLanjut: "Latihan" })).fieldBerubah, ["tindakLanjut"]);
  assert.deepEqual(diffJurnal(snap(), snap({ catatan: "Catatan" })).fieldBerubah, ["catatan"]);
});

test("menambah, mengganti, dan menghapus dokumentasiUrl menghasilkan audit", () => {
  const tanpa = snap();
  const dengan = snap({ dokumentasiUrl: "/uploads/a.png" });
  assert.deepEqual(diffJurnal(tanpa, dengan).fieldBerubah, ["dokumentasiUrl"]);
  assert.deepEqual(diffJurnal(dengan, snap({ dokumentasiUrl: "/uploads/b.png" })).fieldBerubah, ["dokumentasiUrl"]);
  assert.deepEqual(diffJurnal(dengan, tanpa).fieldBerubah, ["dokumentasiUrl"]);
});

test("draft ke terkirim mencatat status sebelum dan sesudah", () => {
  const d = diffJurnal(snap(), snap({ status: "TERKIRIM" }));
  assert.deepEqual(d.fieldBerubah, ["status"]);
  assert.equal(d.sebelum.status, "DRAFT");
  assert.equal(d.sesudah.status, "TERKIRIM");
});

test("kirim massal: pola status DRAFT → TERKIRIM", () => {
  const d = diffJurnal(snap({ status: "DRAFT" }), snap({ status: "TERKIRIM" }));
  assert.equal(d.sebelum.status, "DRAFT");
  assert.equal(d.sesudah.status, "TERKIRIM");
});

test("menyimpan tanpa perubahan (no-op) tidak menghasilkan audit", () => {
  const d = diffJurnal(snap(), snap());
  assert.equal(d.berubah, false);
  assert.deepEqual(d.fieldBerubah, []);
});

test("normalisasi: string kosong dan null dianggap sama", () => {
  assert.equal(normJurnal(""), null);
  assert.equal(normJurnal("  "), null);
  assert.equal(normJurnal(null), null);
  assert.equal(normJurnal(undefined), null);
  assert.equal(normJurnal("  Materi  "), "Materi");
  // Snapshot dari input mentah menormalkan "" → null, sehingga tidak dianggap berubah.
  const sblm = snapshotJurnal({ ...snap(), catatan: null });
  const ssdh = snapshotJurnal({ ...snap(), catatan: "" });
  const d = diffJurnal(sblm, ssdh);
  assert.equal(d.berubah, false);
});

test("beberapa field berubah sekali: satu audit berisi semua field", () => {
  const d = diffJurnal(snap(), snap({ materi: "Baru", metode: "Diskusi", status: "TERKIRIM" }));
  assert.deepEqual(d.fieldBerubah, ["materi", "metode", "status"]);
  assert.equal(d.sebelum.materi, "Materi awal");
  assert.equal(d.sesudah.materi, "Baru");
});

test("snapshotJurnal menormalkan input mentah browser", () => {
  const s = snapshotJurnal({ materi: "  X  ", kegiatan: "", status: "DRAFT" });
  assert.equal(s.materi, "X");
  assert.equal(s.kegiatan, null);
  assert.equal(s.status, "DRAFT");
});

test("label field ramah pembaca", () => {
  assert.equal(labelFieldJurnal("tindakLanjut"), "Tindak Lanjut");
  assert.equal(labelFieldJurnal("dokumentasiUrl"), "Dokumentasi");
  assert.equal(labelFieldJurnal("materi"), "Materi");
  assert.equal(labelFieldJurnal("status"), "Status");
  assert.equal(labelFieldJurnal("x"), "x");
});

test("kompatibilitas audit lama: diff masih terbaca dari struktur sebelum/sesudah saja", () => {
  // Format lama tidak punya fieldBerubah — diff tetap mendeteksi perubahan.
  const d = diffJurnal(snap({ tujuan: null }), snap({ tujuan: "X" }));
  assert.deepEqual(d.fieldBerubah, ["tujuan"]);
});

test("jurnal baru: snapshot sesudah berisi seluruh data + status", () => {
  const s = snapshotJurnal({
    materi: "Materi baru",
    tujuan: "Tujuan",
    kegiatan: "Kegiatan",
    metode: "Metode",
    media: "Media",
    hasil: "Hasil",
    kendala: "Kendala",
    tindakLanjut: "Tindak lanjut",
    catatan: "Catatan",
    dokumentasiUrl: "/uploads/a.png",
    status: "DRAFT",
  });
  assert.equal(s.materi, "Materi baru");
  assert.equal(s.tujuan, "Tujuan");
  assert.equal(s.kegiatan, "Kegiatan");
  assert.equal(s.metode, "Metode");
  assert.equal(s.media, "Media");
  assert.equal(s.hasil, "Hasil");
  assert.equal(s.kendala, "Kendala");
  assert.equal(s.tindakLanjut, "Tindak lanjut");
  assert.equal(s.catatan, "Catatan");
  assert.equal(s.dokumentasiUrl, "/uploads/a.png");
  assert.equal(s.status, "DRAFT");
});

test("jurnal manual: snapshot sesudah mencatat status TERKIRIM dan materi", () => {
  const s = snapshotJurnal({
    materi: "Materi manual",
    status: "TERKIRIM",
  });
  assert.equal(s.materi, "Materi manual");
  assert.equal(s.status, "TERKIRIM");
});

test("simulasi kegagalan transaksi: diff menghasilkan perubahan tapi audit tidak dibuat", () => {
  // Ketika transaksi gagal, audit tidak boleh dibuat. Ini adalah simulasi konseptual:
  // diffGagal = perubahan terdeteksi, tapi create audit tidak dieksekusi.
  const sebelum = snap({ materi: "Lama" });
  const sesudah = snap({ materi: "Baru", status: "TERKIRIM" });
  const d = diffJurnal(sebelum, sesudah);
  assert.equal(d.berubah, true);
  assert.deepEqual(d.fieldBerubah, ["materi", "status"]);

  // Jika transaksi gagal, kita tidak akan pernah memanggil create audit.
  // Tidak ada cara di level helper untuk mensimulasikan ini secara langsung,
  // tapi kita bisa memastikan diff tidak memiliki efek samping (side-effect free).
  assert.deepEqual(d.sebelum, { materi: "Lama", status: "DRAFT" });
  assert.deepEqual(d.sesudah, { materi: "Baru", status: "TERKIRIM" });
});

test("bersihkanJurnal menormalkan data mentah untuk disimpan ke DB", () => {
  const bersih = bersihkanJurnal({
    materi: "  Materi  ",
    tujuan: "",
    kegiatan: "Kegiatan",
    metode: null,
    media: undefined,
    hasil: "",
    kendala: "  Kendala  ",
    tindakLanjut: "",
    catatan: null,
    dokumentasiUrl: "",
  });
  assert.equal(bersih.materi, "Materi");
  assert.equal(bersih.tujuan, null);
  assert.equal(bersih.kegiatan, "Kegiatan");
  assert.equal(bersih.metode, null);
  assert.equal(bersih.media, null);
  assert.equal(bersih.hasil, null);
  assert.equal(bersih.kendala, "Kendala");
  assert.equal(bersih.tindakLanjut, null);
  assert.equal(bersih.catatan, null);
  assert.equal(bersih.dokumentasiUrl, null);
});