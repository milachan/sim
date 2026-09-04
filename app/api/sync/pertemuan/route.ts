import { NextRequest, NextResponse } from "next/server";
import { sinkronkanPertemuan } from "@/lib/pertemuan";
import { apiAktif } from "@/lib/api-auth";
import { cronBearerValid } from "@/lib/account-auth";

export const dynamic = "force-dynamic";

/**
 * Sinkronisasi / backfill pertemuan otomatis dari jadwal.
 *
 * Akses: cron/job terjadwal dengan `Authorization: Bearer <PUSH_CRON_SECRET>`
 * ATAU admin/superadmin lewat sesi (dijalankan manual).
 *
 * Query param:
 * - `dryRun=1` → hanya audit (tidak menulis apa pun).
 * - `jadwalId=...` / `guruId=...` → batasi subset (opsional).
 *
 * Aman dijalankan berulang/paralel (createMany skipDuplicates + unique
 * [jadwalId, tanggal]).
 */
export async function GET(req: NextRequest) {
  return jalankan(req);
}

export async function POST(req: NextRequest) {
  return jalankan(req);
}

async function jalankan(req: NextRequest) {
  const viaCron = cronBearerValid(req.headers.get("authorization"), process.env.PUSH_CRON_SECRET);
  if (!viaCron) {
    const auth = await apiAktif(["ADMIN", "SUPERADMIN"] as const);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const sp = req.nextUrl.searchParams;
  const hasil = await sinkronkanPertemuan({
    dryRun: sp.get("dryRun") === "1",
    jadwalId: sp.get("jadwalId") || undefined,
    guruId: sp.get("guruId") || undefined,
  });

  return NextResponse.json({
    ok: true,
    kunciPushDigunakan: viaCron,
    perintahDijalankan: sp.get("dryRun") === "1" ? "dry-run" : "sinkronisasi",
    ...hasil,
  });
}