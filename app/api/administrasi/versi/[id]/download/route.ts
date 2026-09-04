import { NextRequest, NextResponse } from "next/server";
import { apiAktif } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { bolehBacaDokumen } from "@/lib/otorisasi";
import { bukaFile } from "@/lib/administrasi/document-storage";

export const dynamic = "force-dynamic";

function safeContentDisposition(namaAsli: string | null): string {
  const fallback = "file";
  const name = (namaAsli ?? fallback).replace(/[\r\n"]/g, "_").slice(0, 200) || fallback;
  const encoded = encodeURIComponent(name).replace(/'/g, "%27");
  return `attachment; filename="${name.replace(/"/g, "_")}"; filename*=UTF-8''${encoded}`;
}

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const auth = await apiAktif();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const user = auth.user as unknown as { id: string; role: string; guruId: string | null };
  const infoUser = { id: user.id, role: user.role, guruId: user.guruId };

  const versi = await prisma.versiDokumen.findUnique({ where: { id: ctx.params.id }, include: { dokumen: true } });
  if (!versi || !versi.dokumen) return NextResponse.json({ error: "Versi tidak ditemukan." }, { status: 404 });
  if (!versi.kunciPenyimpanan) return NextResponse.json({ error: "Versi ini tidak memiliki file." }, { status: 404 });
  if (!bolehBacaDokumen(infoUser, { pengajuUserId: versi.dokumen.pengajuUserId, status: versi.dokumen.status })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let buffer: Buffer;
  try {
    buffer = await bukaFile(versi.kunciPenyimpanan);
  } catch {
    return NextResponse.json({ error: "File tidak ditemukan di penyimpanan." }, { status: 404 });
  }

  const headers = new Headers();
  headers.set("Content-Type", versi.mime ?? "application/octet-stream");
  headers.set("Content-Length", String(buffer.length));
  headers.set("Content-Disposition", safeContentDisposition(versi.namaAsli));
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  if (versi.sha256) headers.set("X-Checksum-Sha256", versi.sha256);
  return new NextResponse(new Uint8Array(buffer), { status: 200, headers });
}
