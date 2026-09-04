/* ============================================================
 * Service Worker — Sistem Administrasi Guru
 * Strategi:
 *   - Navigasi (halaman): network-only, fallback offline sederhana
 *   - Aset statis (_next/static, gambar, font): stale-while-revalidate
 *   - API (/api/*) & request non-GET: network-only (tidak pernah di-cache)
 * ============================================================ */
const VERSION = "v1.3.0";
const CACHE_STATIC = `sag-static-${VERSION}`;

// Shell inti — hanya aset statis publik (selalu 200 tanpa autentikasi).
// HTML/RSC privat tidak di-cache agar data dan module graph selalu konsisten.
const PRECACHE = [
  "/manifest.json",
  "/icon.svg",
  "/logo.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];

function offlineResponse() {
  return new Response(
    "<!doctype html><html lang='id'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>" +
      "<body style='font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;background:#f1f5f9;color:#0f172a;text-align:center'>" +
      "<div><h1>Anda sedang offline</h1><p>Periksa koneksi internet lalu coba muat ulang halaman.</p>" +
      "<button onclick='location.reload()' style='margin-top:1rem;padding:.6rem 1.4rem;border:0;border-radius:.75rem;background:#059669;color:#fff;font-weight:600;cursor:pointer'>Muat Ulang</button></div></body></html>",
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_STATIC)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("sag-") && k !== CACHE_STATIC)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Ambil aset statis dari cache dulu, lalu perbarui cache di latar belakang
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    fetch(request)
      .then((response) => {
        if (response.ok) cache.put(request, response.clone());
      })
      .catch(() => {});
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // POST dll. selalu lewat jaringan

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // jangan sentuh domain lain

  // API & autentikasi: tidak pernah di-cache
  if (url.pathname.startsWith("/api/")) return;

  // Aset statis Next.js & file publik: stale-while-revalidate
  if (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:png|svg|jpg|jpeg|webp|gif|ico|css|woff2?|json)$/.test(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(request, CACHE_STATIC));
    return;
  }

  // Navigasi autentikasi selalu lewat jaringan; jangan cache HTML/RSC.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => offlineResponse()));
  }
});

// ---------- Notifikasi Web Push ----------

self.addEventListener("push", (event) => {
  let data = {
    title: "Sistem Administrasi Guru",
    body: "",
    url: "/",
    tag: "notifikasi",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
  };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* payload bukan JSON — pakai default */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      renotify: true,
      vibrate: [100, 50, 100],
      data: { url: data.url },
      actions: [{ action: "buka", title: "Buka Jurnal" }],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    (async () => {
      const semua = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of semua) {
        if ("focus" in client && "navigate" in client) {
          await client.focus();
          try {
            await client.navigate(url);
            return;
          } catch {
            /* gagal navigasi — coba jendela berikutnya atau buka baru */
          }
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});

// Terima pesan "skipWaiting" (misal dari tombol "Perbarui" di UI)
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
