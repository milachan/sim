import { NextRequest, NextResponse } from "next/server";
import { apiAktifDenganPiket, adalahAkunPiket } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { bolehKelolaDokumenDraf, bolehMengajukanDokumen, bolehRevisiDokumen, PESAN_TOLAK_MENGAJUKAN } from "@/lib/otorisasi";
import { cekMagicBytes, cekPathTraversal, ekstensiDariNama, MAKS_BODY_UPLOAD, validasiFile } from "@/lib/administrasi/document-validation";
import { hapusFile, hitungSha256, sanitasiNamaAsli, simpanFile } from "@/lib/administrasi/document-storage";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const auth = await apiAktifDenganPiket();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const user = auth.user;
  // PIKET diblok dari unggah versi meski memiliki session/login valid.
  if (adalahAkunPiket(user)) {
    return NextResponse.json({ error: PESAN_TOLAK_MENGAJUKAN }, { status: 403 });
  }
  const infoUser = { id: user.id, role: user.role, guruId: user.guruId, guru: user.guru };
  // Sumber tunggal aturan pengajuan: tolak KEPALA/ADMIN/SUPERADMIN sebelum
  // query DB. helper bolehKelolaDokumenDraf/bolehRevisiDokumen di bawah
  // sudah memanggil bolehMengajukanDokumen secara internal, tapi guard
  // eksplisit memastikan pesan generik PESAN_TOLAK_MENGAJUKAN dan tidak
  // membocorkan status "DIKIRIM/DISETUJUI" ke pemeriksa.
  if (!bolehMengajukanDokumen(infoUser)) {
    return NextResponse.json({ error: PESAN_TOLAK_MENGAJUKAN }, { status: 403 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAKS_BODY_UPLOAD) {
    return NextResponse.json({ error: "File terlalu besar." }, { status: 413 });
  }

  const dokumenId = ctx.params.id;
  const d = await prisma.dokumen.findUnique({ where: { id: dokumenId } });
  if (!d) return NextResponse.json({ error: "Dokumen tidak ditemukan." }, { status: 404 });

  const bolehDraf = bolehKelolaDokumenDraf(infoUser, { pengajuUserId: d.pengajuUserId, status: d.status });
  const bolehRevisi = bolehRevisiDokumen(infoUser, { pengajuUserId: d.pengajuUserId, status: d.status });
  if (!bolehDraf && !bolehRevisi) {
    if (d.status === "DIKIRIM" || d.status === "DISETUJUI" || d.status === "DIFINALKAN" || d.status === "DIARSIPKAN") {
      return NextResponse.json({ error: "Dokumen pada status ini tidak dapat menerima versi baru." }, { status: 409 });
    }
    return NextResponse.json({ error: "Anda tidak berhak mengunggah file untuk dokumen ini." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Data form tidak valid." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });

  const namaAsliRaw = file.name;
  if (cekPathTraversal(namaAsliRaw)) return NextResponse.json({ error: "Nama file tidak valid." }, { status: 400 });

  const err = validasiFile(namaAsliRaw, file.type, file.size);
  if (err) {
    const status = err.includes("10 MB") ? 413 : 400;
    return NextResponse.json({ error: err }, { status });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = ekstensiDariNama(namaAsliRaw);
  if (!cekMagicBytes(buffer, ext)) {
    return NextResponse.json({ error: "Isi file tidak sesuai dengan extension." }, { status: 400 });
  }

  const sha256 = hitungSha256(buffer);
  const namaAsli = sanitasiNamaAsli(namaAsliRaw);
  const mime = file.type || (() => {
    const m: Record<string, string> = { pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
    return m[ext] ?? "application/octet-stream";
  })();

  let kunci: string | null = null;
  try {
    kunci = await simpanFile(buffer, ext);
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan file." }, { status: 500 });
  }

  try {
    const hasil = await prisma.$transaction(async (tx) => {
      const fresh = await tx.dokumen.findUnique({ where: { id: dokumenId } });
      if (!fresh) throw new Error("Dokumen tidak ditemukan.");
      const ok = bolehKelolaDokumenDraf(infoUser, { pengajuUserId: fresh.pengajuUserId, status: fresh.status }) || bolehRevisiDokumen(infoUser, { pengajuUserId: fresh.pengajuUserId, status: fresh.status });
      if (!ok) throw Object.assign(new Error("Status dokumen telah berubah, upload dibatalkan."), { statusCode: 409 });
      const nextNomor = fresh.versiAktif + 1;
      const versi = await tx.versiDokumen.create({
        data: {
          dokumenId,
          nomor: nextNomor,
          judul: fresh.judul,
          ringkasan: fresh.ringkasan,
          dibuatOlehUserId: user.id,
          namaAsli,
          mime,
          ukuran: buffer.length,
          kunciPenyimpanan: kunci!,
          sha256,
        },
      });
      await tx.dokumen.update({ where: { id: dokumenId }, data: { versiAktif: nextNomor } });
      await tx.riwayatDokumen.create({
        data: {
          dokumenId,
          aktorUserId: user.id,
          aksi: "upload",
          dariStatus: fresh.status,
          keStatus: fresh.status,
          payload: { versiId: versi.id, nomor: nextNomor, namaAsli, mime, ukuran: buffer.length, sha256 } as never,
        },
      });
      return versi;
    });
    return NextResponse.json({ id: hasil.id, nomor: hasil.nomor, sha256 });
  } catch (e: unknown) {
    if (kunci) await hapusFile(kunci);
    const msg = e instanceof Error ? e.message : "Gagal menyimpan metadata.";
    const status = (e as { statusCode?: number }).statusCode ?? (msg.includes("Status dokumen") ? 409 : 500);
    return NextResponse.json({ error: msg }, { status });
  }
}
