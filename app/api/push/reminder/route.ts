import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { kirimPengingatJurnal } from "@/lib/push";
import { apiAktif } from "@/lib/api-auth";
import { cronBearerValid } from "@/lib/account-auth";

export const dynamic = "force-dynamic";

/**
 * Akses: admin/superadmin lewat sesi (user TERBARU dari DB), ATAU cron/job
 * terjadwal dengan header `Authorization: Bearer <PUSH_CRON_SECRET>`.
 * Role JWT tidak dipakai sebagai otorisasi.
 */
export async function GET(req: NextRequest) {
  return jalankan(req);
}

export async function POST(req: NextRequest) {
  return jalankan(req);
}

async function jalankan(req: NextRequest) {
  const authSecret = process.env.PUSH_CRON_SECRET;
  const viaCron = cronBearerValid(req.headers.get("authorization"), authSecret);

  let userId: string | undefined;
  if (!viaCron) {
    const auth = await apiAktif(["ADMIN", "SUPERADMIN"] as const);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    userId = auth.user.id;
  }

  // Mode statistik: jumlah guru & perangkat yang terdaftar push
  if (req.nextUrl.searchParams.get("stats") === "1") {
    const [guru, perangkat] = await Promise.all([
      prisma.user.count({ where: { pushSubscriptions: { some: {} } } }),
      prisma.pushSubscription.count(),
    ]);
    return NextResponse.json({ ok: true, guruTerdaftar: guru, perangkatTerdaftar: perangkat });
  }

  const hasil = await kirimPengingatJurnal({
    paksa: req.nextUrl.searchParams.get("force") === "1",
    testOnly: req.nextUrl.searchParams.get("test") === "1",
    userId,
  });
  return NextResponse.json(hasil);
}