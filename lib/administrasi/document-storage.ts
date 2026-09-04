import { createHash, randomUUID } from "crypto";
import { createReadStream } from "fs";
import { mkdir, readFile, unlink, writeFile, stat } from "fs/promises";
import path from "path";

const ALLOWED_KEY_RE = /^[a-zA-Z0-9_-]+\.[a-z0-9]+$/;

export function hitungSha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function dapatkanStorageDir(namespace?: string): string {
  const env = process.env.DOCUMENT_STORAGE_DIR?.trim();
  const ns = namespace?.replace(/[^a-zA-Z0-9_-]/g, "");
  // Tanpa namespace: perilaku lama utuh (env dir, atau storage/dokumen).
  if (!ns) {
    if (env) {
      const resolved = path.isAbsolute(env) ? env : path.join(process.cwd(), env);
      if (resolved.includes(`${path.sep}public${path.sep}`) || resolved.endsWith(`${path.sep}public`)) {
        throw new Error("DOCUMENT_STORAGE_DIR tidak boleh berada di dalam public.");
      }
      return resolved;
    }
    return path.join(process.cwd(), "storage", "dokumen");
  }
  // Dengan namespace: subdirektori terpisah (mis. "template"), tetap di luar public.
  const base = env
    ? path.isAbsolute(env) ? env : path.join(process.cwd(), env)
    : path.join(process.cwd(), "storage");
  const resolved = path.join(base, ns);
  if (resolved.includes(`${path.sep}public${path.sep}`) || resolved.endsWith(`${path.sep}public`)) {
    throw new Error("Direktori storage tidak boleh berada di dalam public.");
  }
  return resolved;
}

export function buatKunciPenyimpanan(ext: string): string {
  return `${randomUUID()}.${ext}`;
}

export function validasiKunci(kunci: string): string | null {
  if (!kunci || kunci.includes("..") || kunci.includes("/") || kunci.includes("\\")) return "Path traversal terdeteksi.";
  if (!ALLOWED_KEY_RE.test(kunci)) return "Kunci penyimpanan tidak valid.";
  return null;
}

export async function simpanFile(buffer: Buffer, ext: string, namespace?: string): Promise<string> {
  const kunci = buatKunciPenyimpanan(ext);
  const err = validasiKunci(kunci);
  if (err) throw new Error(err);
  const dir = dapatkanStorageDir(namespace);
  await mkdir(dir, { recursive: true });
  const full = path.join(dir, kunci);
  await writeFile(full, buffer);
  return kunci;
}

export async function bukaFile(kunci: string, namespace?: string): Promise<Buffer> {
  const err = validasiKunci(kunci);
  if (err) throw new Error(err);
  const full = path.join(dapatkanStorageDir(namespace), kunci);
  return readFile(full);
}

export function streamFile(kunci: string, namespace?: string) {
  const err = validasiKunci(kunci);
  if (err) throw new Error(err);
  const full = path.join(dapatkanStorageDir(namespace), kunci);
  return createReadStream(full);
}

export async function hapusFile(kunci: string, namespace?: string): Promise<void> {
  const err = validasiKunci(kunci);
  if (err) return;
  const full = path.join(dapatkanStorageDir(namespace), kunci);
  try {
    await unlink(full);
  } catch {}
}

export async function fileAda(kunci: string, namespace?: string): Promise<boolean> {
  const err = validasiKunci(kunci);
  if (err) return false;
  const full = path.join(dapatkanStorageDir(namespace), kunci);
  try {
    await stat(full);
    return true;
  } catch {
    return false;
  }
}

export function sanitasiNamaAsli(nama: string): string {
  const base = path.basename(nama).trim();
  const cleaned = base.replace(/[^a-zA-Z0-9._\-\s()]/g, "_").slice(0, 255);
  return cleaned || "file";
}
