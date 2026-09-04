import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Kunci publik VAPID — aman diekspos, dipakai browser untuk subscribe. */
export async function GET() {
  try {
    const publicKey = await getVapidPublicKey();
    return NextResponse.json({ publicKey });
  } catch {
    return NextResponse.json({ error: "Gagal mengambil kunci VAPID." }, { status: 500 });
  }
}
