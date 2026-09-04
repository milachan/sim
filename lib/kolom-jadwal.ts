import { normText } from "@/lib/constants";

export type FormatJadwal = "terpisah" | "gabung" | "lama";

/**
 * Deteksi format dari baris header:
 *   terpisah : Guru | Kode | Hari | Jam Ke | (Waktu) | Mapel/Kegiatan | Kelas
 *   gabung   : Guru | Hari | Jam Ke | (Waktu) | Mapel/Kegiatan | Kelas
 *              (format lama, kode di dalam kurung pada nama — tanpa kolom Kode)
 *   lama     : HARI | JAM MULAI | JAM SELESAI | NAMA GURU | KELAS | MATA PELAJARAN
 */
export function formatJadwalDariHeader(header: string[]): FormatJadwal {
  if (normText(header[0] ?? "") === "guru") {
    return normText(header[1] ?? "") === "kode" ? "terpisah" : "gabung";
  }
  return "lama";
}

/**
 * Layout internal import jadwal selalu menyertakan slot kolom "Waktu" (isi
 * string kosong) — waktu tampil otomatis di aplikasi dari pengaturan jam
 * pelajaran per hari, jadi isi kolom Waktu memang tidak pernah dipakai.
 *
 * Kolom dipetakan lewat nama header, sehingga file yang menghapus kolom Waktu
 * (atau menyusun ulang kolom) tetap masuk dengan benar. Rows dibentuk ulang ke
 * layout kanonik:
 *   terpisah: [Guru, Kode, Hari, Jam Ke, "", Mapel, Kelas]
 *   gabung  : [Guru, Hari, Jam Ke, "", Mapel, Kelas]
 */
export function susunBarisJadwal(header: string[], rows: string[][]): { format: FormatJadwal; rows: string[][] } {
  const format = formatJadwalDariHeader(header);
  if (format === "lama") return { format, rows };

  const norm = header.map((h) => normText(h));
  const idx = (pred: (n: string) => boolean) => norm.findIndex(pred);
  const iKode = idx((n) => n === "kode");
  const iHari = idx((n) => n === "hari");
  const iJam = idx((n) => n.includes("jam"));
  const iMapel = idx((n) => n.includes("mapel"));
  const iKelas = idx((n) => n === "kelas");
  if (iHari < 0 || iJam < 0 || iMapel < 0 || iKelas < 0) return { format, rows };

  const ambil = (cells: string[], i: number) => (i >= 0 && i < cells.length ? cells[i] : "");
  const kanonik = rows.map((cells) => {
    const guru = ambil(cells, 0);
    const hari = ambil(cells, iHari);
    const jam = ambil(cells, iJam);
    const mapel = ambil(cells, iMapel);
    const kelas = ambil(cells, iKelas);
    if (format === "terpisah") {
      return [guru, ambil(cells, iKode), hari, jam, "", mapel, kelas];
    }
    return [guru, hari, jam, "", mapel, kelas];
  });
  return { format, rows: kanonik };
}
