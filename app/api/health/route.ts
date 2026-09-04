import { prisma } from "@/lib/prisma";
import { buatHealthHandler } from "@/lib/health";

export const dynamic = "force-dynamic";

// Handler produksi: cek kesehatan DB via Prisma SELECT 1 (logika di lib/health.ts
// agar test menguji handler yang sama, bukan tiruan).
export const GET = buatHealthHandler(() => prisma.$queryRaw`SELECT 1`);
