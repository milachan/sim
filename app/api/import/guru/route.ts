import { NextRequest, NextResponse } from "next/server";
import { ImportSafeError, bangunPayloadImport, fileGuruDidukung, prosesGuru } from "@/lib/import-guru";
import { apiAktif } from "@/lib/api-auth";
import { kredensialStore, simpanKredensial } from "@/lib/kredensial-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await apiAktif(["ADMIN", "SUPERADMIN"] as const);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const form = await req.formData();
    const preview = form.get("preview") === "1";
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "File tidak ditemukan." }, { status: 400 });
    }
    if (!fileGuruDidukung(file.name)) {
      return NextResponse.json({ ok: false, error: "Format harus .xlsx." }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const plan = await prosesGuru(bytes, preview ? "preview" : "exec");

    const payload = bangunPayloadImport(plan, preview);

    // Hanya akun yang transaksinya benar-benar commit yang masuk daftar ini
    // (prosesGuru mengisi plan.akunBaru setelah $transaction resolve).
    const akunBaru = plan.akunBaru ?? [];
    const kredensialToken: string | null =
      !preview && akunBaru.length > 0
        ? simpanKredensial(
            kredensialStore,
            auth.user.id,
            akunBaru.map((a) => ({
              nama: a.nama,
              kode: a.kode,
              username: a.username,
              password: a.passwordAwal,
              peran: a.peran,
              wajib: a.wajibGanti ? "YA" : "TIDAK",
            }))
          )
        : null;
    if (kredensialToken) (payload as Record<string, unknown>).kredensialToken = kredensialToken;

    return NextResponse.json(payload, { status: 200 });
  } catch (e) {
    // Hanya error aman-untuk-klien (validasi file/template) yang boleh
    // diteruskan. Error lain (Prisma/infra) disanitasi agar tidak membocorkan
    // query, tabel, constraint, atau konfigurasi database.
    if (e instanceof ImportSafeError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    }
    console.error("[import-guru] error internal:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { ok: false, error: "Gagal memproses file impor. Periksa format file atau coba beberapa saat lagi." },
      { status: 400 }
    );
  }
}
