import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiAktif } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** Simpan / perbarui langganan push milik user yang sedang login. */
export async function POST(req: NextRequest) {
  const auth = await apiAktif();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const userId = auth.user.id;

  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint as string | undefined;
  const keys = body?.keys as { p256dh?: string; auth?: string } | undefined;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Data langganan tidak lengkap." }, { status: 400 });
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 255) ?? null;
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    update: { userId, p256dh: keys.p256dh, auth: keys.auth, userAgent },
  });
  return NextResponse.json({ ok: true });
}

/** Hapus langganan push (saat user menonaktifkan notifikasi). */
export async function DELETE(req: NextRequest) {
  const auth = await apiAktif();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const userId = auth.user.id;

  const body = await req.json().catch(() => null);
  const endpoint = body?.endpoint as string | undefined;
  if (endpoint) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
  }
  return NextResponse.json({ ok: true });
}
