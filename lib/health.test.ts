import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buatHealthHandler } from "./health";

/**
 * Test memakai handler yang sama dengan route production
 * (app/api/health/route.ts = buatHealthHandler(() => prisma.$queryRaw`SELECT 1`))
 * — hanya fungsi cek DB-nya yang diinjeksi, tanpa menyentuh database production.
 */

async function bacaBody(res: Response): Promise<Record<string, unknown>> {
  return JSON.parse(await res.text()) as Record<string, unknown>;
}

describe("GET /api/health (handler aktual)", () => {
  it("DB sehat → HTTP 200 dan {status:'ok'}", async () => {
    const GET = buatHealthHandler(async () => [{ "1": 1 }]);
    const res = await GET();
    assert.equal(res.status, 200);
    assert.deepEqual(await bacaBody(res), { status: "ok" });
  });

  it("DB gagal → HTTP 503 dan {status:'error'}", async () => {
    const GET = buatHealthHandler(async () => {
      throw new Error("Koneksi database gagal");
    });
    const res = await GET();
    assert.equal(res.status, 503);
    assert.deepEqual(await bacaBody(res), { status: "error" });
  });

  it("selalu mengirim Cache-Control: no-store (sukses & gagal)", async () => {
    const okHandler = buatHealthHandler(async () => null);
    const gagalHandler = buatHealthHandler(async () => {
      throw new Error("x");
    });
    assert.equal((await okHandler()).headers.get("Cache-Control"), "no-store");
    assert.equal((await gagalHandler()).headers.get("Cache-Control"), "no-store");
  });

  it("tidak membocorkan stack, hostname, DATABASE_URL, query, atau detail sensitif", async () => {
    const rahasia = "mysql://admin:SANGAT_RAHASIA@db-host-rahasia:3306/jurnal?connection_limit=5";
    const GET = buatHealthHandler(async () => {
      throw new Error(
        `PrismaClientKnownRequestError — Invalid datasource: ${rahasia}\n    at /app/src/query.ts:12\n    hostname: server-produksi-01`
      );
    });
    const res = await GET();
    const raw = await res.text();
    assert.ok(!raw.includes("RAHASIA"));
    assert.ok(!raw.includes("db-host-rahasia"));
    assert.ok(!raw.includes("DATABASE_URL"));
    assert.ok(!raw.includes("stack"));
    assert.ok(!raw.toLowerCase().includes("hostname"));
    assert.ok(!raw.includes("server-produksi-01"));
    assert.equal(Object.keys(JSON.parse(raw) as Record<string, unknown>).length, 1);
  });
});
