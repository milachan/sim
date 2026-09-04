import { NextRequest, NextResponse } from "next/server";
import { apiAktif } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { bolehKelolaTemplate } from "@/lib/otorisasi";
import { validasiFileTemplate } from "@/lib/administrasi/template-validasi";
import { MAKS_BODY_UPLOAD } from "@/lib/administrasi/document-validation";
import { unggahVersiTemplate } from "@/lib/administrasi/template-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const auth = await apiAktif();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const user = auth.user as unknown as { id: string; role: string; guruId: string | null };
  if (!bolehKelolaTemplate(user)) {
    return NextResponse.json({ error: "Anda tidak berhak mengunggah versi template." }, { status: 403 });
  }

  const templateId = ctx.params.id;
  const t = await prisma.templateDokumen.findUnique({
    where: { id: templateId },
    select: { id: true },
  });
  if (!t) return NextResponse.json({ error: "Template tidak ditemukan." }, { status: 404 });

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAKS_BODY_UPLOAD) {
    return NextResponse.json({ error: "File terlalu besar." }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Data form tidak valid." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const err = validasiFileTemplate(file.name, file.type, file.size, buffer);
  if (err) {
    const status = err.includes("10 MB") ? 413 : 400;
    return NextResponse.json({ error: err }, { status });
  }

  try {
    const hasil = await unggahVersiTemplate({
      templateId,
      buffer,
      namaAsli: file.name,
      mimeTipe: file.type,
      aktorUserId: user.id,
    });
    // Respons tanpa storage key.
    return NextResponse.json({ id: hasil.id, nomor: hasil.nomor, sha256: hasil.sha256, ukuran: hasil.ukuran });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Gagal menyimpan versi template.";
    const status = (e as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
