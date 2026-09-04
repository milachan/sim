import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { apiAktif } from "@/lib/api-auth";
import { ambilKredensial, kredensialStore, type BarisKredensial } from "@/lib/kredensial-store";

export const dynamic = "force-dynamic";

// Header anti-cache untuk respons berisi kredensial.
const HEADER_NO_CACHE: Record<string, string> = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(req: NextRequest) {
  const auth = await apiAktif(["ADMIN", "SUPERADMIN"] as const);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const token = req.nextUrl.searchParams.get("token") ?? "";
  // Sekali pakai + terikat ke admin pembuat import. Semua kegagalan
  // (salah/kedaluwarsa/bukan pemilik) memakai pesan generik yang sama agar
  // keberadaan token tidak bocor.
  const hasil = ambilKredensial(kredensialStore, token, auth.user.id);
  if (!hasil.ok) {
    return NextResponse.json(
      { error: "Kredensial tidak ditemukan, sudah kedaluwarsa, atau sudah pernah diunduh. Ulangi import untuk mendapatkan kredensial baru." },
      { status: 404, headers: HEADER_NO_CACHE }
    );
  }

  try {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Kredensial Akun Baru");
    ws.columns = [
      { header: "Nama Guru", key: "nama", width: 34 },
      { header: "Kode Guru", key: "kode", width: 10 },
      { header: "Username", key: "username", width: 18 },
      { header: "Password Awal", key: "password", width: 20 },
      { header: "Peran", key: "peran", width: 10 },
      { header: "Wajib Ganti Password", key: "wajib", width: 14 },
    ];
    const HEAD = { font: { bold: true }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } }, color: { argb: "FFFFFFFF" } } as const;
    ws.getRow(1).eachCell((c) => { c.style = HEAD; });
    for (const r of hasil.data as BarisKredensial[]) {
      ws.addRow({ nama: r.nama, kode: r.kode, username: r.username, password: r.password, peran: r.peran, wajib: r.wajib });
    }
    const catatan = ws.addRow([]);
    catatan.getCell(1).value = "Simpan dengan aman — password polos hanya tampil satu kali ini.";
    catatan.getCell(1).font = { italic: true, color: { argb: "FF94A3B8" } };

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        ...HEADER_NO_CACHE,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="kredensial-akun-baru-guru.xlsx"`,
      },
    });
  } catch {
    // Gagal membuat file: jangan bocorkan isi kredensial; entri sudah dihapus
    // (sekali pakai) sehingga admin harus mengulang import bila perlu.
    return NextResponse.json(
      { error: "Gagal menyiapkan file kredensial. Ulangi import untuk mendapatkan kredensial baru." },
      { status: 500, headers: HEADER_NO_CACHE }
    );
  }
}
