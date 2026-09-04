"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { wajibLogin } from "./guard";
import {
  adalahPemeriksaDokumen,
  bolehBacaDokumen,
  bolehKelolaDokumenDraf,
  bolehKirimDokumen,
  bolehMengajukanDokumen,
  bolehMintaRevisi,
  bolehRevisiDokumen,
  bolehSetujuiDokumen,
  isTransisiDokumenValid,
  PESAN_TOLAK_MENGAJUKAN,
} from "@/lib/otorisasi";
import { normalisasiDokumen, validasiCatatanRevisi, validasiDokumen } from "@/lib/dokumen-validasi";
import { adalahFinalisator, buatKodeVerifikasi, errIkatanVersi, isStatusBolehFinalisasi, pilihVersiTerbaru, PESAN_TOLAK_SETUJUI, responFinal, validasiKandidatFinal, verifikasiVersiPdf } from "@/lib/administrasi/finalisasi";
import { buatNotifikasiKamad, buatNotifikasiPemilik, kunciEvent } from "@/lib/administrasi/notifikasi";
import { bukaFile } from "@/lib/administrasi/document-storage";
import type { JenisDokumen } from "@prisma/client";

export async function buatDokumen(input: { judul: string; jenis: JenisDokumen | string; ringkasan?: string | null }) {
  const user = await wajibLogin();
  // Guard peran: hanya GURU non-PIKET dan WAKA yang boleh membuat pengajuan.
  // KEPALA/ADMIN/SUPERADMIN/GURU PIKET/user null: ditolak sebelum DB write.
  // Berlaku bahkan ketika action dipanggil langsung tanpa UI.
  if (!bolehMengajukanDokumen(user)) {
    throw new Error(PESAN_TOLAK_MENGAJUKAN);
  }
  const err = validasiDokumen(input);
  if (err) throw new Error(err);
  const n = normalisasiDokumen(input);
  const dok = await prisma.dokumen.create({
    data: {
      judul: n.judul,
      jenis: n.jenis,
      ringkasan: n.ringkasan,
      status: "DRAF",
      pengajuUserId: user.id,
      pengajuGuruId: user.guruId ?? null,
    },
  });
  await prisma.versiDokumen.create({
    data: {
      dokumenId: dok.id,
      nomor: 1,
      judul: n.judul,
      ringkasan: n.ringkasan,
      dibuatOlehUserId: user.id,
    },
  });
  await prisma.riwayatDokumen.create({
    data: {
      dokumenId: dok.id,
      aktorUserId: user.id,
      aksi: "buat",
      keStatus: "DRAF",
      payload: { judul: n.judul, jenis: n.jenis } as never,
    },
  });
  revalidatePath("/administrasi");
  return { ok: true as const, id: dok.id };
}

export async function ubahDokumenDraf(
  id: string,
  input: { judul: string; jenis: JenisDokumen | string; ringkasan?: string | null }
) {
  const user = await wajibLogin();
  if (!bolehMengajukanDokumen(user)) {
    throw new Error(PESAN_TOLAK_MENGAJUKAN);
  }
  const err = validasiDokumen(input);
  if (err) throw new Error(err);
  const d = await prisma.dokumen.findUnique({ where: { id } });
  if (!d) throw new Error("Dokumen tidak ditemukan.");
  if (!bolehKelolaDokumenDraf(user, { pengajuUserId: d.pengajuUserId, status: d.status })) {
    throw new Error("Anda tidak berhak mengubah draf ini.");
  }
  const n = normalisasiDokumen(input);
  const nextVersi = d.versiAktif + 1;
  await prisma.$transaction([
    prisma.dokumen.update({
      where: { id },
      data: { judul: n.judul, jenis: n.jenis, ringkasan: n.ringkasan, versiAktif: nextVersi },
    }),
    prisma.versiDokumen.create({
      data: {
        dokumenId: id,
        nomor: nextVersi,
        judul: n.judul,
        ringkasan: n.ringkasan,
        dibuatOlehUserId: user.id,
      },
    }),
    prisma.riwayatDokumen.create({
      data: {
        dokumenId: id,
        aktorUserId: user.id,
        aksi: "ubah-draf",
        dariStatus: "DRAF",
        keStatus: "DRAF",
        payload: { judul: n.judul, jenis: n.jenis } as never,
      },
    }),
  ]);
  revalidatePath("/administrasi");
  revalidatePath(`/administrasi/${id}`);
  return { ok: true as const };
}

export async function hapusDokumenDraf(id: string) {
  const user = await wajibLogin();
  if (!bolehMengajukanDokumen(user)) {
    throw new Error(PESAN_TOLAK_MENGAJUKAN);
  }
  const d = await prisma.dokumen.findUnique({ where: { id }, select: { pengajuUserId: true, status: true } });
  if (!d) throw new Error("Dokumen tidak ditemukan.");
  if (d.status === "DIFINALKAN") throw new Error("Dokumen yang telah difinalkan tidak dapat dihapus.");
  if (!bolehKelolaDokumenDraf(user, { pengajuUserId: d.pengajuUserId, status: d.status })) {
    throw new Error("Anda tidak berhak menghapus draf ini.");
  }
  await prisma.dokumen.delete({ where: { id } });
  revalidatePath("/administrasi");
  return { ok: true as const };
}

export async function kirimDokumen(id: string) {
  const user = await wajibLogin();
  if (!bolehMengajukanDokumen(user)) {
    throw new Error(PESAN_TOLAK_MENGAJUKAN);
  }
  const d = await prisma.dokumen.findUnique({ where: { id } });
  if (!d) throw new Error("Dokumen tidak ditemukan.");
  if (!bolehKirimDokumen(user, { pengajuUserId: d.pengajuUserId, status: d.status })) {
    throw new Error("Hanya dokumen DRAF / PERLU_REVISI milik Anda yang dapat dikirim.");
  }
  if (!isTransisiDokumenValid(d.status, "DIKIRIM")) throw new Error("Transisi status tidak valid.");
  await prisma.$transaction(async (tx) => {
    await tx.dokumen.update({ where: { id }, data: { status: "DIKIRIM" } });
    const riwayat = await tx.riwayatDokumen.create({
      data: { dokumenId: id, aktorUserId: user.id, aksi: "kirim", dariStatus: d.status, keStatus: "DIKIRIM" },
    });
    await buatNotifikasiKamad(tx, {
      dokumenId: id,
      jenis: "DOKUMEN_DIKIRIM",
      eventKey: kunciEvent("kirim", riwayat.id),
    });
  });
  revalidatePath("/administrasi");
  revalidatePath("/administrasi/kotak-masuk");
  return { ok: true as const };
}

export async function kirimRevisiDokumen(
  id: string,
  input: { judul: string; jenis: JenisDokumen | string; ringkasan?: string | null }
) {
  const user = await wajibLogin();
  if (!bolehMengajukanDokumen(user)) {
    throw new Error(PESAN_TOLAK_MENGAJUKAN);
  }
  const err = validasiDokumen(input);
  if (err) throw new Error(err);
  const d = await prisma.dokumen.findUnique({ where: { id } });
  if (!d) throw new Error("Dokumen tidak ditemukan.");
  if (!bolehRevisiDokumen(user, { pengajuUserId: d.pengajuUserId, status: d.status })) {
    throw new Error("Hanya pemilik dokumen PERLU_REVISI yang dapat mengirim revisi.");
  }
  if (!isTransisiDokumenValid(d.status, "DIKIRIM")) throw new Error("Transisi status tidak valid.");
  const n = normalisasiDokumen(input);
  const nextVersi = d.versiAktif + 1;
  await prisma.$transaction(async (tx) => {
    await tx.dokumen.update({
      where: { id },
      data: { judul: n.judul, jenis: n.jenis, ringkasan: n.ringkasan, status: "DIKIRIM", versiAktif: nextVersi },
    });
    await tx.versiDokumen.create({
      data: { dokumenId: id, nomor: nextVersi, judul: n.judul, ringkasan: n.ringkasan, dibuatOlehUserId: user.id },
    });
    const riwayat = await tx.riwayatDokumen.create({
      data: {
        dokumenId: id,
        aktorUserId: user.id,
        aksi: "kirim-revisi",
        dariStatus: d.status,
        keStatus: "DIKIRIM",
        payload: { judul: n.judul, jenis: n.jenis } as never,
      },
    });
    await buatNotifikasiKamad(tx, {
      dokumenId: id,
      jenis: "REVISI_DIKIRIM",
      eventKey: kunciEvent("kirim-revisi", riwayat.id),
    });
  });
  revalidatePath("/administrasi");
  revalidatePath(`/administrasi/${id}`);
  revalidatePath("/administrasi/kotak-masuk");
  return { ok: true as const };
}

export async function mintaRevisiDokumen(id: string, catatan: string) {
  const user = await wajibLogin();
  if (!adalahPemeriksaDokumen(user.role)) throw new Error("Anda tidak berhak meminta revisi.");
  const vc = validasiCatatanRevisi(catatan);
  if (vc) throw new Error(vc);
  const d = await prisma.dokumen.findUnique({ where: { id } });
  if (!d) throw new Error("Dokumen tidak ditemukan.");
  if (d.pengajuUserId === user.id) {
    throw new Error("Dokumen ini Anda ajukan sendiri. Pemeriksaan harus dilakukan oleh pemeriksa lain.");
  }
  if (!bolehMintaRevisi(user, { pengajuUserId: d.pengajuUserId, status: d.status })) {
    throw new Error("Hanya dokumen DIKIRIM yang dapat diminta revisi.");
  }
  if (!isTransisiDokumenValid(d.status, "PERLU_REVISI")) throw new Error("Transisi status tidak valid.");
  await prisma.$transaction(async (tx) => {
    await tx.dokumen.update({ where: { id }, data: { status: "PERLU_REVISI" } });
    const riwayat = await tx.riwayatDokumen.create({
      data: {
        dokumenId: id,
        aktorUserId: user.id,
        aksi: "minta-revisi",
        dariStatus: d.status,
        keStatus: "PERLU_REVISI",
        payload: { catatan: catatan.trim() } as never,
      },
    });
    await buatNotifikasiPemilik(tx, {
      dokumenId: id,
      penerimaUserId: d.pengajuUserId,
      jenis: "PERLU_REVISI",
      eventKey: kunciEvent("minta-revisi", riwayat.id),
    });
  });
  revalidatePath("/administrasi/kotak-masuk");
  revalidatePath(`/administrasi/kotak-masuk/${id}`);
  revalidatePath("/administrasi");
  return { ok: true as const };
}

export async function setujuiDokumen(id: string) {
  const user = await wajibLogin();
  if (!adalahPemeriksaDokumen(user.role)) throw new Error("Anda tidak berhak menyetujui dokumen.");
  const d = await prisma.dokumen.findUnique({ where: { id } });
  if (!d) throw new Error("Dokumen tidak ditemukan.");
  if (d.pengajuUserId === user.id) {
    throw new Error("Dokumen ini Anda ajukan sendiri. Persetujuan harus dilakukan oleh pemeriksa lain.");
  }
  if (!bolehSetujuiDokumen(user, { pengajuUserId: d.pengajuUserId, status: d.status })) {
    throw new Error("Hanya dokumen DIKIRIM yang dapat disetujui.");
  }
  if (!isTransisiDokumenValid(d.status, "DISETUJUI")) throw new Error("Transisi status tidak valid.");

  const versi = pilihVersiTerbaru(
    await prisma.versiDokumen.findMany({
      where: { dokumenId: id },
      select: { id: true, nomor: true, namaAsli: true, mime: true, ukuran: true, kunciPenyimpanan: true, sha256: true },
    })
  );
  const integritas = await verifikasiVersiPdf(versi, () => bukaFile(versi!.kunciPenyimpanan!));
  if (!integritas.ok) throw new Error(PESAN_TOLAK_SETUJUI);

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.dokumen.findUnique({ where: { id }, select: { status: true } });
    if (!fresh || fresh.status !== "DIKIRIM") throw new Error("Status dokumen telah berubah. Persetujuan dibatalkan.");
    await tx.dokumen.update({ where: { id }, data: { status: "DISETUJUI" } });
    const riwayat = await tx.riwayatDokumen.create({
      data: { dokumenId: id, aktorUserId: user.id, aksi: "setujui", dariStatus: "DIKIRIM", keStatus: "DISETUJUI" },
    });
    await buatNotifikasiPemilik(tx, {
      dokumenId: id,
      penerimaUserId: d.pengajuUserId,
      jenis: "DISETUJUI",
      eventKey: kunciEvent("setujui", riwayat.id),
    });
  });
  revalidatePath("/administrasi/kotak-masuk");
  revalidatePath(`/administrasi/kotak-masuk/${id}`);
  revalidatePath("/administrasi");
  return { ok: true as const };
}

export async function daftarDokumenSaya(): Promise<unknown[]> {
  const user = await wajibLogin();
  const rows = await prisma.dokumen.findMany({
    where: { pengajuUserId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, judul: true, jenis: true, status: true, pengajuUserId: true, createdAt: true, updatedAt: true },
  });
  return rows.filter((r) => bolehBacaDokumen(user, { pengajuUserId: r.pengajuUserId ?? user.id, status: r.status }));
}

export async function ambilDokumenSaya(id: string) {
  const user = await wajibLogin();
  const d = await prisma.dokumen.findUnique({ where: { id } });
  if (!d) return null;
  if (!bolehBacaDokumen(user, { pengajuUserId: d.pengajuUserId, status: d.status })) return null;
  return d;
}

export async function finalisasiDokumen(dokumenId: string) {
  const user = await wajibLogin();
  if (!adalahFinalisator(user.role)) throw new Error("Hanya Kepala Madrasah, Admin, atau Superadmin yang dapat memfinalisasi dokumen.");

  const d = await prisma.dokumen.findUnique({ where: { id: dokumenId } });
  if (!d) throw new Error("Dokumen tidak ditemukan.");
  if (d.pengajuUserId === user.id) {
    throw new Error("Dokumen ini Anda ajukan sendiri. Finalisasi harus dilakukan oleh pemeriksa lain.");
  }
  if (!isStatusBolehFinalisasi(d.status)) throw new Error("Hanya dokumen yang telah disetujui yang dapat difinalisasi.");

  const sudah = await prisma.dokumenFinal.findUnique({ where: { dokumenId } });
  if (sudah) return responFinal(sudah, true);

  const pilihanAwal = pilihVersiTerbaru(
    await prisma.versiDokumen.findMany({
      where: { dokumenId },
      select: { id: true, nomor: true, namaAsli: true, mime: true, ukuran: true, kunciPenyimpanan: true, sha256: true },
    })
  );
  const errValidasiAwal = validasiKandidatFinal(pilihanAwal);
  if (errValidasiAwal) throw new Error(errValidasiAwal);

  try {
    const hasil = await prisma.$transaction(async (tx) => {
      const fresh = await tx.dokumen.findUnique({ where: { id: dokumenId } });
      if (!fresh) throw new Error("Dokumen tidak ditemukan.");
      if (fresh.status !== "DISETUJUI") throw new Error("Status dokumen telah berubah. Finalisasi dibatalkan.");

      const existing = await tx.dokumenFinal.findUnique({ where: { dokumenId } });
      if (existing) return { final: existing, idempotent: true as const };

      const versi = pilihVersiTerbaru(
        await tx.versiDokumen.findMany({
          where: { dokumenId },
          select: {
            id: true,
            dokumenId: true,
            nomor: true,
            namaAsli: true,
            mime: true,
            ukuran: true,
            kunciPenyimpanan: true,
            sha256: true,
          },
        })
      );

      const errIkatan = errIkatanVersi(versi, dokumenId);
      if (errIkatan) throw new Error(errIkatan);

      const integritas = await verifikasiVersiPdf(versi, () => bukaFile(versi!.kunciPenyimpanan!));
      if (!integritas.ok) throw new Error(integritas.alasan);
      const { buffer, sha256Aktual } = integritas;

      const final = await tx.dokumenFinal.create({
        data: {
          dokumenId,
          versiId: versi!.id,
          nomorVersi: versi!.nomor,
          sha256: sha256Aktual,
          ukuran: versi!.ukuran ?? buffer.length,
          mime: versi!.mime ?? "application/pdf",
          namaAsli: versi!.namaAsli ?? "file.pdf",
          kodeVerifikasi: buatKodeVerifikasi(16),
          difinalkanOlehId: user.id,
        },
      });
      await tx.dokumen.update({ where: { id: dokumenId }, data: { status: "DIFINALKAN" } });
      const riwayat = await tx.riwayatDokumen.create({
        data: {
          dokumenId,
          aktorUserId: user.id,
          aksi: "finalisasi",
          dariStatus: "DISETUJUI",
          keStatus: "DIFINALKAN",
          payload: { versiId: versi!.id, nomorVersi: versi!.nomor, sha256: sha256Aktual, kodeVerifikasi: final.kodeVerifikasi } as never,
        },
      });
      await buatNotifikasiPemilik(tx, {
        dokumenId,
        penerimaUserId: fresh.pengajuUserId,
        jenis: "DIFINALKAN",
        eventKey: kunciEvent("finalisasi", riwayat.id),
      });
      return { final, idempotent: false as const };
    });
    revalidatePath("/administrasi");
    revalidatePath(`/administrasi/${dokumenId}`);
    revalidatePath("/administrasi/kotak-masuk");
    return responFinal(hasil.final, hasil.idempotent);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Gagal memfinalisasi dokumen.";
    throw new Error(msg);
  }
}
