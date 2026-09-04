import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { apiAktif } from "@/lib/api-auth";
import { bolehKelolaPertemuan, type InfoUser } from "@/lib/otorisasi";

export const dynamic = "force-dynamic";

const MAKS_UKURAN = 2 * 1024 * 1024; // 2 MB
const MAKS_BODY = 5 * 1024 * 1024; // batas awal body multipart (ada overhead form)
const EKSTENSI_IZIN = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

/** Upload foto dokumentasi kegiatan. File disimpan di public/uploads dan diakses via URL publik. */
export async function POST(req: NextRequest) {
  const auth = await apiAktif();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Tolak sejak awal bila ukuran body sudah jelas terlalu besar
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAKS_BODY) {
    return NextResponse.json({ error: "Ukuran file maksimal 2 MB." }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Data form tidak valid." }, { status: 400 });
  }

  // Dokumentasi hanya boleh diunggah oleh pengelola pertemuan tersebut
  // (guru pemilik jadwal / pembuat pertemuan manual) atau admin — dicek ke
  // database, bukan dari klien.
  const pertemuanId = form.get("pertemuanId")?.toString() ?? "";
  if (!pertemuanId) {
    return NextResponse.json({ error: "pertemuanId wajib diisi." }, { status: 400 });
  }
  const pertemuan = await prisma.pertemuan.findUnique({
    where: { id: pertemuanId },
    select: { dibuatOlehId: true, jadwal: { select: { guruId: true } } },
  });
  if (!pertemuan) {
    return NextResponse.json({ error: "Pertemuan tidak ditemukan." }, { status: 404 });
  }
  // apiAktif memuat user dengan field guru lengkap (jenisGuru/kode) — aman untuk helper otorisasi.
  const pemohon = auth.user as unknown as InfoUser;
  if (!bolehKelolaPertemuan(pemohon, { jadwalGuruId: pertemuan.jadwal?.guruId ?? null, dibuatOlehId: pertemuan.dibuatOlehId })) {
    return NextResponse.json({ error: "Anda tidak berhak mengunggah dokumentasi pertemuan ini." }, { status: 403 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });

  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!EKSTENSI_IZIN.has(ext))
    return NextResponse.json({ error: "Format tidak diizinkan. Gunakan JPG, PNG, WEBP, atau GIF." }, { status: 400 });
  if (file.type && !file.type.startsWith("image/"))
    return NextResponse.json({ error: "File harus berupa gambar." }, { status: 400 });
  if (file.size > MAKS_UKURAN) return NextResponse.json({ error: "Ukuran file maksimal 2 MB." }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const nama = `${randomUUID()}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, nama), buffer);

  return NextResponse.json({ url: `/uploads/${nama}` });
}
