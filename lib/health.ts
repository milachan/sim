/**
 * Handler /api/health yang benar-benar dipakai route production.
 * Dibuat sebagai factory dengan pengecekan DB yang dapat diinjeksi agar test
 * menguji logika handler yang sama (bukan tiruan terpisah), tanpa menyentuh
 * database production.
 */

export type CekDb = () => Promise<unknown>;

const HEADER_NO_STORE = { "Cache-Control": "no-store" };

export function buatHealthHandler(cekDb: CekDb) {
  return async function GET(): Promise<Response> {
    try {
      await cekDb();
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: HEADER_NO_STORE,
      });
    } catch {
      // Tanpa stack, hostname, DATABASE_URL, query, atau detail sensitif apa pun.
      return new Response(JSON.stringify({ status: "error" }), {
        status: 503,
        headers: HEADER_NO_STORE,
      });
    }
  };
}
