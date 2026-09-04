export function getBkAppUrl(): string | null {
  const raw = process.env.BK_APP_URL?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch { return null; }
}
