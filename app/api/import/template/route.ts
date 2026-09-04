import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { apiAktif } from "@/lib/api-auth";
import { HARI_LABEL } from "@/lib/constants";

export const dynamic = "force-dynamic";

const HEAD = { font: { bold: true }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } }, color: { argb: "FFFFFFFF" } } as const;
const CONTOH = { fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFECFDF5" } } } as const;

export async function GET(req: NextRequest) {
  const auth = await apiAktif(["ADMIN", "SUPERADMIN"] as const);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const t = req.nextUrl.searchParams.get("t") ?? "siswa";
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistem Administrasi Guru";

  // ---------- Template siswa ----------
  // Kunci sinkron = NISN (10 digit). NIS & KELAS opsional. Saat upload muncul
  // pratinjau: siswa baru dibuat, siswa dengan NISN sama diperbarui, dan nama
  // yang sama tapi NISN beda butuh konfirmasi untuk di-replace.
  if (t === "siswa") {
    const ws = wb.addWorksheet("Data Siswa");
    ws.columns = [
      { header: "NISN", key: "nisn", width: 14 },
      { header: "NIS", key: "nis", width: 14 },
      { header: "NAMA", key: "nama", width: 34 },
      { header: "KELAS", key: "kelas", width: 10 },
    ];
    ws.getRow(1).eachCell((c) => { c.style = HEAD; });
    ws.addRow({ nisn: "3000000001", nis: "24001", nama: "Ahmad Pratama", kelas: "7A" }).eachCell((c) => { c.style = CONTOH; });
    ws.addRow({ nisn: "3000000002", nis: "24002", nama: "Aisyah Ramadhan", kelas: "7A" }).eachCell((c) => { c.style = CONTOH; });
    const catatan = ws.addRow([]);
    catatan.getCell(1).value = "Petunjuk: NISN (10 digit) adalah KUNCI sinkron — siswa dengan NISN sama akan diperbarui. NIS dan KELAS opsional. Baris contoh bisa dihapus.";
    catatan.getCell(1).font = { italic: true, color: { argb: "FF94A3B8" } };

    const petunjuk = wb.addWorksheet("Petunjuk");
    const baris = [
      ["PETUNJUK IMPORT DATA SISWA"],
      [""],
      ["1. Isi sheet 'Data Siswa' — satu baris = satu siswa."],
      ["2. Kolom NISN (10 digit angka) adalah KUNCI sinkron. Siswa dengan NISN yang sama akan diperbarui; yang belum ada akan dibuat."],
      ["3. NIS & KELAS opsional. KELAS harus sudah ada di menu Kelas & Rombel (nama harus persis, mis. 7A); sel kosong berarti mempertahankan kelas yang sudah terdata."],
      ["4. Bila NISN berbeda tapi NAMA sama dengan siswa yang sudah ada, muncul peringatan konflik — periksa dulu di pratinjau, lalu konfirmasi untuk memperbarui/replace data lama."],
      ["5. Sebelum disimpan ada pratinjau (siswa baru / diperbarui / konflik) — periksa lalu konfirmasi. Siswa yang nonaktif dipulihkan otomatis."],
    ];
    baris.forEach((r) => petunjuk.addRow(r));
    petunjuk.getRow(1).eachCell((c) => { c.style = HEAD; });
    return wb.xlsx.writeBuffer().then(
      (buffer) =>
        new NextResponse(buffer, {
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="template-import-siswa.xlsx"`,
          },
        })
    );
  }

  // ---------- Template guru ----------
  if (t === "guru") {
    const ws = wb.addWorksheet("Data Guru");
    ws.columns = [
      { header: "NAMA", key: "nama", width: 34 },
      { header: "KODE", key: "kode", width: 8 },
      { header: "NIP", key: "nip", width: 20 },
      { header: "WHATSAPP", key: "whatsapp", width: 16 },
      { header: "USERNAME", key: "username", width: 18 },
      { header: "PASSWORD AWAL", key: "password", width: 18 },
      { header: "PERAN AKUN", key: "peran", width: 12 },
      { header: "AKUN AKTIF", key: "aktif", width: 10 },
      { header: "WAJIB GANTI PASSWORD", key: "wajib", width: 14 },
    ];
    ws.getRow(1).eachCell((c) => { c.style = HEAD; });
    ws.addRow({ nama: "Akhmadi, S.Pd.", kode: "K5", nip: "198512312010011001", whatsapp: "081234567890", username: "akhmadi", password: "Rahasia123!", peran: "GURU", aktif: "YA", wajib: "YA" }).eachCell((c) => { c.style = CONTOH; });
    ws.addRow({ nama: "Enny MufliKhatun, S.Ag, M.Pd.", kode: "E1", nip: "", whatsapp: "", username: "", password: "", peran: "GURU", aktif: "YA", wajib: "TIDAK" }).eachCell((c) => { c.style = CONTOH; });
    const catatan = ws.addRow([]);
    catatan.getCell(1).value = "Petunjuk: kolom KODE adalah kunci sinkron. NAMA & KODE wajib. USERNAME/PASSWORD/PERAN/STATUS kosong → akun dibuat otomatis (username dari kode, password acak, peran GURU, aktif YA). Baris contoh bisa dihapus.";
    catatan.getCell(1).font = { italic: true, color: { argb: "FF94A3B8" } };

    const petunjuk = wb.addWorksheet("Petunjuk");
    const baris = [
      ["PETUNJUK IMPORT DATA GURU + AKUN"],
      [""],
      ["KOLOM"],
      ["• NAMA (wajib) — nama lengkap & gelar guru."],
      ["• KODE (wajib) — kode singkat, kunci sinkron (mis. K5). Guru dengan kode sama diperbarui, bukan digandakan."],
      ["• NIP / NUPTK — opsional. Kosong = dipertahankan dari data lama."],
      ["• WHATSAPP — opsional (08xx). Kosong = dipertahankan."],
      ["• USERNAME — opsional. Kosong = dibuat otomatis dari KODE (format aman). Bila sudah dipakai akun lain, diberi akhiran unik (mis. k5-2)."],
      ["• PASSWORD AWAL — opsional. Kosong = sistem membuat password acak kuat. HANYA dipakai saat membuat akun BARU."],
      ["• PERAN AKUN — GURU atau WAKA (default GURU). WAKA boleh mengajar sekaligus memantau."],
      ["• AKUN AKTIF — YA atau TIDAK (default YA)."],
      ["• WAJIB GANTI PASSWORD — YA atau TIDAK (default TIDAK)."],
      [""],
      ["PERILAKU IMPORT ULANG"],
      ["• Import ulang file yang sama TIDAK membuat akun duplikat, tidak mereset password, dan tidak mengubah username/role/status akun yang sudah ada."],
      ["• Nilai akun yang kosong tidak mengubah akun lama yang sudah terhubung."],
      ["• Nama akun disinkronkan dari NAMA guru bila guru diperbarui."],
      ["• Guru yang belum punya akun otomatis dibuatkan akun."],
      [""],
      ["PERINGATAN KEAMANAN"],
      ["• File berisi password polos. JANGAN disebarkan; hapus file setelah import selesai."],
      ["• Password hanya digunakan satu kali saat akun baru dibuat dan tidak disimpan di database (hanya hash)."],
      [""],
      ["Versi lama (NAMA|KODE|NIP|WHATSAPP) tetap didukung — akun dibuat otomatis dengan username dari kode & password acak."],
    ];
    baris.forEach((r) => petunjuk.addRow(r));
    petunjuk.getRow(1).eachCell((c) => { c.style = HEAD; });
    return wb.xlsx.writeBuffer().then(
      (buffer) =>
        new NextResponse(buffer, {
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="template-import-guru.xlsx"`,
          },
        })
    );
  }

  // ---------- Template jadwal ----------
  // Kolom Guru dan Kode terpisah. Patokan sinkron = Kode Guru (nama hanya untuk tampilan).
  // Format lama (kode dalam kurung di nama) tetap diterima otomatis saat upload.
  const ws = wb.addWorksheet("Data Jadwal");
  // Kolom Waktu sengaja tidak ada — waktu tampil otomatis dari pengaturan jam
  // pelajaran per hari (hari + Jam Ke sudah cukup). File lama yang masih memuat
  // kolom Waktu tetap diterima saat upload.
  ws.columns = [
    { header: "Guru", key: "guru", width: 30 },
    { header: "Kode", key: "kode", width: 8 },
    { header: "Hari", key: "hari", width: 10 },
    { header: "Jam Ke", key: "jam", width: 8 },
    { header: "Mapel/Kegiatan", key: "mapel", width: 24 },
    { header: "Kelas", key: "kelas", width: 10 },
  ];
  ws.getRow(1).eachCell((c) => { c.style = HEAD; });
  ws.addRow({ guru: "Akhmadi, S.Pd.", kode: "K5", hari: "Senin", jam: 4, mapel: "IPS", kelas: "IX F" }).eachCell((c) => { c.style = CONTOH; });
  ws.addRow({ guru: "Enny MufliKhatun, S.Ag, M.Pd.", kode: "E1", hari: "Jumat", jam: 1, mapel: "Wali Kelas", kelas: "IX A" }).eachCell((c) => { c.style = CONTOH; });
  const catatan = ws.addRow([]);
  catatan.getCell(1).value = `Petunjuk: kolom KODE adalah kunci sinkron guru (harus sama di tiap baris guru yang sama, dan guru harus sudah ada di sistem — buat dulu via Import Guru). HARI salah satu dari ${Object.values(HARI_LABEL).join(", ")}. Mapel "Wali Kelas" mengisi wali kelas rombel, bukan jadwal. Format lama (kode dalam kurung di nama, tanpa kolom Kode) tetap didukung. Baris contoh bisa dihapus.`;
  catatan.getCell(1).font = { italic: true, color: { argb: "FF94A3B8" } };

  // Sheet petunjuk lengkap
  const petunjuk = wb.addWorksheet("Petunjuk");
  const baris = [
    ["PETUNJUK IMPORT JADWAL"],
    [""],
    ["1. Isi sheet 'Data Jadwal' — satu baris = satu jam pelajaran."],
    ["2. Kolom 'Guru' berisi nama (untuk tampilan/pengecekan), kolom 'Kode' berisi kode singkat (mis. K5). KODE adalah patokan sinkron — guru harus SUDAH ADA di sistem (buat dulu via Import Guru / menu Data Guru). Import Jadwal hanya membuat jadwal, mapel, kelas, dan wali kelas."],
    ["3. Format lama 'Akhmadi, S.Pd. (K5)' dalam satu kolom tanpa kolom Kode tetap didukung otomatis."],
    ["4. Kolom 'Jam Ke' bisa angka tunggal (4) atau rentang (1-2). Tidak perlu kolom 'Waktu' — waktu tiap jam tampil otomatis dari pengaturan jam pelajaran per hari. File lama yang masih memakai kolom 'Waktu' tetap diterima."],
    ["5. Mapel & kelas yang belum ada di sistem dibuat otomatis (kelas dikenali dari VII/VIII/IX)."],
    ["6. Baris dengan Mapel/Kegiatan 'Wali Kelas' akan mengisi wali kelas rombel di menu Kelas — bukan jadwal."],
    ["7. Saat upload, wajib pilih tahun ajaran & periode tujuan. Bila periode itu sudah punya jadwal akan muncul peringatan."],
    ["8. Sebelum disimpan ada pratinjau (guru/mapel/kelas baru, jadwal yang akan dibuat) — periksa lalu konfirmasi. Data master guru yang sudah ada TIDAK diubah, hanya jadwalnya yang dibuat."],
  ];
  baris.forEach((r) => petunjuk.addRow(r));
  petunjuk.getRow(1).eachCell((c) => { c.style = HEAD; });
  return wb.xlsx.writeBuffer().then(
    (buffer) =>
      new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="template-import-jadwal.xlsx"`,
        },
      })
  );
}
