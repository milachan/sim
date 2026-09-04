import { NextRequest, NextResponse } from "next/server";
import { apiAktif } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { bolehKelolaTemplate } from "@/lib/otorisasi";
import { sanitasiNamaAsli } from "@/lib/administrasi/document-storage";
import { NAMESPACE_TEMPLATE } from "@/lib/administrasi/template-validasi";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const auth = await apiAktif();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const user = auth.user as unknown as { id: string; role: string; guruId: string | null };
  const kelola = bolehKelolaTemplate(user);

  const versi = await prisma.versiTemplateDokumen.findUnique({
    where: { id: ctx.params.id },
    select: {
      id: true,
      nomor: true,
      namaAsli: true,
      mime: true,
      kunciPenyimpanan: true,
      template: { select: { id: true, aktif: true } },
    },
  });
  if (!versi) return NextResponse.json({ error: "Versi template tidak ditemukan." }, { status: 404 });

  if (!kelola) {
    // Pengguna biasa: hanya versi TERBARU (nomor tertinggi) dari template AKTIF.
    if (!versi.template.aktif) {
      return NextResponse.json({ error: "Template tidak tersedia." }, { status: 404 });
    }
    const terbaru = await prisma.versiTemplateDokumen.findFirst({
      where: { templateId: versi.template.id },
      orderBy: { nomor: "desc" },
      select: { id: true },
    });
    if (!terbaru || terbaru.id !== versi.id) {
      return NextResponse.json({ error: "Versi template tidak tersedia." }, { status: 404 });
    }
  }

  let isi: Buffer;
  try {
    const { bukaFile } = await import("@/lib/administrasi/document-storage");
    isi = await bukaFile(versi.kunciPenyimpanan, NAMESPACE_TEMPLATE);
  } catch {
    return NextResponse.json({ error: "File versi tidak dapat dibaca." }, { status: 500 });
  }

  const namaAman = sanitasiNamaAsli(versi.namaAsli || `template-v${versi.nomor}`);
  // Content-Disposition aman: nama ASCII tersanitasi + filename* UTF-8.
  const ascii = namaAman.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  const body = new Uint8Array(isi);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": versi.mime || "application/octet-stream",
      "Content-Length": String(body.byteLength),
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(namaAman)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
