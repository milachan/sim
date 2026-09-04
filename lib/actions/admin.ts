"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { wajibAdmin, wajibLogin } from "./guard";
import { validasiJadwal } from "@/lib/jadwal-validasi";
import { cariSemesterAktif } from "@/lib/semester";
import { invalidateJamCache } from "@/lib/jam-utils";
import { menitDariWaktu } from "@/lib/constants";
import { catatRiwayatWaliKelas } from "@/lib/wali-kelas";
import { validasiInputUser, tentukanIdentitasAkun } from "@/lib/user-validasi";
import { keputusanHapusSuperadmin, keputusanUbahSuperadmin, validasiPasswordAkun } from "@/lib/superadmin-guard";
import { Prisma, type Hari, type JenisGuru, type Role } from "@prisma/client";

function sukses(path: string, pesan: string) {
  revalidatePath(path);
  redirect(`${path}?sukses=${encodeURIComponent(pesan)}`);
}

// ================= GURU =================

export async function simpanGuru(input: {
  id?: string;
  nama: string;
  kode?: string;
  nip: string;
  telepon: string;
  status: boolean;
  jenisGuru: JenisGuru;
  mapelIds: string[];
}) {
  await wajibAdmin();
  if (!input.nama.trim()) throw new Error("Nama guru wajib diisi.");
  const kode = input.kode?.trim() || null;
  if (kode && !/^[A-Za-z]\d{1,3}$/.test(kode)) {
    throw new Error("Format kode guru tidak valid. Contoh: K5, F2, G7.");
  }
  const telepon = input.telepon?.trim() || null;
  if (telepon && !/^[0-9+\-\s().]{9,15}$/.test(telepon)) {
    throw new Error("Format No. WhatsApp tidak valid. Contoh: 081234567890.");
  }
  const data = {
    nama: input.nama.trim(),
    kode,
    nip: input.nip?.trim() || null,
    telepon,
    status: input.status,
    jenisGuru: input.jenisGuru,
    deletedAt: null,
  };
  if (input.id) {
    await prisma.$transaction(async (tx) => {
      await tx.guru.update({
        where: { id: input.id },
        data: { ...data, mapelDiampu: { set: input.mapelIds.map((id) => ({ id })) } },
      });
      // Sinkronkan nama akun yang terhubung (GURU/WAKA) dengan Data Guru.
      const user = await tx.user.findUnique({ where: { guruId: input.id }, select: { id: true, role: true } });
      if (user && (user.role === "GURU" || user.role === "WAKA")) {
        await tx.user.update({ where: { id: user.id }, data: { nama: input.nama.trim() } });
      }
    });
  } else {
    await prisma.guru.create({
      data: { ...data, mapelDiampu: { connect: input.mapelIds.map((id) => ({ id })) } },
    });
  }
  sukses("/admin/guru", "Data guru berhasil disimpan.");
}

export async function hapusGuru(id: string) {
  await wajibAdmin();
  await prisma.$transaction(async (tx) => {
    await tx.guru.update({ where: { id }, data: { deletedAt: new Date(), status: false } });
    // Nonaktifkan akun GURU/WAKA yang terhubung (tanpa menghapus User/histori).
    await tx.user.updateMany({ where: { guruId: id, role: { in: ["GURU", "WAKA"] } }, data: { aktif: false } });
  });
  sukses("/admin/guru", "Guru dinonaktifkan (soft delete) beserta akun GURU/WAKA terkait.");
}

export async function pulihkanGuru(id: string) {
  await wajibAdmin();
  // Pulihkan hanya Data Guru; akun TIDAK diaktifkan kembali otomatis (admin aktifkan dari Hak Akses).
  await prisma.guru.update({ where: { id }, data: { deletedAt: null, status: true } });
  sukses("/admin/guru", "Guru dipulihkan — akun yang terhubung diaktifkan manual dari Hak Akses bila diperlukan.");
}

// ================= SISWA =================

export async function simpanSiswa(input: {
  id?: string;
  nama: string;
  nisn: string;
  nis: string;
  kelasId: string;
  status: "AKTIF" | "ALUMNI" | "KELUAR";
}) {
  await wajibAdmin();
  if (!input.nama.trim()) throw new Error("Nama siswa wajib diisi.");
  const nisn = input.nisn?.trim() || null;
  if (nisn && !/^\d{10}$/.test(nisn)) throw new Error("Format NISN tidak valid — harus 10 digit angka.");
  const data = {
    nama: input.nama.trim(),
    nisn,
    nis: input.nis?.trim() || null,
    kelasId: input.kelasId || null,
    status: input.status,
    deletedAt: null,
  };
  if (input.id) {
    await prisma.siswa.update({ where: { id: input.id }, data });
  } else {
    await prisma.siswa.create({ data });
  }
  sukses("/admin/siswa", "Data siswa berhasil disimpan.");
}

export async function hapusSiswa(id: string) {
  await wajibAdmin();
  await prisma.siswa.update({ where: { id }, data: { deletedAt: new Date(), status: "KELUAR" } });
  sukses("/admin/siswa", "Siswa dinonaktifkan (soft delete).");
}

export async function pulihkanSiswa(id: string) {
  await wajibAdmin();
  await prisma.siswa.update({ where: { id }, data: { deletedAt: null, status: "AKTIF" } });
  sukses("/admin/siswa", "Siswa dipulihkan.");
}

// ================= KELAS =================

export async function simpanKelas(input: { id?: string; nama: string; tingkat: number; waliKelasId: string }) {
  await wajibAdmin();
  if (!input.nama.trim()) throw new Error("Nama kelas wajib diisi.");
  const waliKelasId = input.waliKelasId || null;
  const data = { nama: input.nama.trim(), tingkat: Number(input.tingkat) || 7, waliKelasId };
  if (input.id) {
    const lama = await prisma.kelas.findUnique({ where: { id: input.id }, select: { waliKelasId: true } });
    await prisma.kelas.update({ where: { id: input.id }, data });
    // Catat pergantian wali kelas pada riwayat (periode aktif saat ini).
    if (lama?.waliKelasId !== waliKelasId) {
      const semester = await cariSemesterAktif();
      await catatRiwayatWaliKelas(input.id, waliKelasId, semester?.id ?? null, lama?.waliKelasId);
    }
  } else {
    const kelas = await prisma.kelas.create({ data });
    if (waliKelasId) {
      const semester = await cariSemesterAktif();
      await catatRiwayatWaliKelas(kelas.id, waliKelasId, semester?.id ?? null);
    }
  }
  sukses("/admin/kelas", "Kelas berhasil disimpan.");
}

export async function hapusKelas(id: string) {
  await wajibAdmin();
  const pakai = await prisma.kelas.findUnique({
    where: { id },
    include: { _count: { select: { siswa: true, jadwal: true } } },
  });
  if (pakai && (pakai._count.siswa > 0 || pakai._count.jadwal > 0))
    throw new Error("Kelas masih memiliki siswa atau jadwal. Pindahkan atau nonaktifkan data tersebut dulu.");
  await prisma.kelas.delete({ where: { id } });
  sukses("/admin/kelas", "Kelas dihapus.");
}

// ================= MAPEL =================

export async function simpanMapel(input: { id?: string; nama: string; kode: string }) {
  await wajibAdmin();
  if (!input.nama.trim()) throw new Error("Nama mata pelajaran wajib diisi.");
  const data = { nama: input.nama.trim(), kode: input.kode?.trim() || null };
  if (input.id) {
    await prisma.mataPelajaran.update({ where: { id: input.id }, data });
  } else {
    await prisma.mataPelajaran.create({ data });
  }
  sukses("/admin/mapel", "Mata pelajaran disimpan.");
}

export async function hapusMapel(id: string) {
  await wajibAdmin();
  const pakai = await prisma.mataPelajaran.findUnique({ where: { id }, include: { _count: { select: { jadwal: true } } } });
  if (pakai && pakai._count.jadwal > 0) throw new Error("Mapel masih dipakai jadwal. Hapus jadwal terkait dulu.");
  await prisma.mataPelajaran.delete({ where: { id } });
  sukses("/admin/mapel", "Mata pelajaran dihapus.");
}

// ================= JADWAL =================

export async function simpanJadwal(input: {
  id?: string;
  guruId: string;
  kelasId: string;
  mapelId: string;
  hari: Hari;
  jamKeMulai: number;
  jamKeSelesai: number;
}) {
  await wajibAdmin();
  const mulai = Number(input.jamKeMulai);
  const selesai = Number(input.jamKeSelesai);

  let semesterId: string | null = null;
  let guruLamaId: string | null = null;
  if (!input.id) {
    // Resolusi semester aktif di luar transaksi (fungsi ini menulis flag sendiri).
    const semester = await cariSemesterAktif();
    if (!semester) throw new Error("Belum ada semester aktif. Atur tahun ajaran dulu.");
    semesterId = semester.id;
  }

  // Seluruh baca–cek–tulis dalam SATU transaksi Serializable: mencegah dua admin
  // menyimpan jadwal bentrok pada saat bersamaan sama-sama lolos validasi (race).
  // Bila admin lain menyimpan lebih dulu, transaksi ini menunggu lalu membaca
  // baris barunya → tabrakan/duplikat terdeteksi dan penyimpanan ditolak.
  await prisma.$transaction(
    async (tx) => {
      if (input.id) {
        const lama = await tx.jadwal.findUnique({ where: { id: input.id }, select: { semesterId: true, guruId: true } });
        if (!lama) throw new Error("Jadwal tidak ditemukan.");
        semesterId = lama.semesterId;
        guruLamaId = lama.guruId;
      }
      const smtId = semesterId!;

      // Validasi referensi master di sisi server (bukan hanya UI): kelas & mapel
      // harus benar-benar ada, dan guru harus aktif. Pengecualian: saat mengubah
      // jadwal yang guru lamanya sudah dinonaktifkan/soft-delete, guru tersebut
      // tetap boleh dipertahankan (tidak mengganti guru) — tapi tidak boleh
      // memindahkan jadwal ke guru nonaktif lain.
      const [guruRef, kelasRef, mapelRef] = await Promise.all([
        tx.guru.findUnique({ where: { id: input.guruId }, select: { status: true, deletedAt: true } }),
        tx.kelas.findUnique({ where: { id: input.kelasId }, select: { id: true } }),
        tx.mataPelajaran.findUnique({ where: { id: input.mapelId }, select: { id: true } }),
      ]);
      if (!kelasRef) throw new Error("Kelas tidak ditemukan. Pilih kelas lain.");
      if (!mapelRef) throw new Error("Mata pelajaran tidak ditemukan. Pilih mapel lain.");
      if (!guruRef) throw new Error("Guru tidak ditemukan. Pilih guru lain.");
      const gantiGuru = !input.id || input.guruId !== guruLamaId;
      if (gantiGuru && (!guruRef.status || guruRef.deletedAt)) {
        throw new Error("Guru nonaktif tidak bisa dijadwalkan. Aktifkan dulu lewat Data Guru.");
      }

      const existing = await tx.jadwal.findMany({
        where: { semesterId: smtId, hari: input.hari },
        select: { id: true, guruId: true, kelasId: true, hari: true, jamKeMulai: true, jamKeSelesai: true, semesterId: true },
      });

      const hasil = await validasiJadwal(
        { guruId: input.guruId, kelasId: input.kelasId, mapelId: input.mapelId, hari: input.hari, jamKeMulai: mulai, jamKeSelesai: selesai, semesterId: smtId },
        existing,
        { excludeId: input.id }
      );
      if (!hasil.ok) throw new Error(hasil.error);

      const duplikat = await tx.jadwal.findFirst({
        where: {
          id: input.id ? { not: input.id } : undefined,
          semesterId: smtId,
          guruId: input.guruId,
          kelasId: input.kelasId,
          mapelId: input.mapelId,
          hari: input.hari,
          jamKeMulai: mulai,
          jamKeSelesai: selesai,
        },
      });
      if (duplikat) throw new Error("Jadwal identik (guru, kelas, mapel, hari & jam sama) sudah ada di periode ini.");

      const data = {
        guruId: input.guruId,
        kelasId: input.kelasId,
        mapelId: input.mapelId,
        hari: input.hari,
        jamKeMulai: mulai,
        jamKeSelesai: selesai,
      };
      if (input.id) {
        await tx.jadwal.update({ where: { id: input.id }, data });
      } else {
        await tx.jadwal.create({ data: { ...data, semesterId: smtId } });
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  sukses("/admin/jadwal", "Jadwal disimpan.");
}

export async function hapusJadwal(id: string) {
  await wajibAdmin();
  const pakai = await prisma.jadwal.findUnique({ where: { id }, include: { _count: { select: { pertemuan: true, kegiatan: true } } } });
  if (pakai && (pakai._count.pertemuan > 0 || pakai._count.kegiatan > 0))
    throw new Error("Jadwal memiliki riwayat pertemuan/penilaian. Nonaktifkan melalui periode baru, jangan hapus.");
  await prisma.jadwal.delete({ where: { id } });
  sukses("/admin/jadwal", "Jadwal dihapus.");
}

/**
 * Hapus paksa jadwal beserta seluruh riwayatnya — pertemuan (beserta absensi &
 * jurnal) dan kegiatan penilaian (beserta nilai siswa) ikut terhapus permanen
 * via cascade di level database. Hanya untuk admin yang memahami konsekuensinya.
 */
export async function hapusJadwalPaksa(id: string) {
  const admin = await wajibAdmin();
  if (admin.role !== "SUPERADMIN") throw new Error("Hanya Super Admin yang boleh menghapus jadwal secara permanen.");
  const pakai = await prisma.jadwal.findUnique({
    where: { id },
    include: { _count: { select: { pertemuan: true, kegiatan: true } } },
  });
  if (!pakai) throw new Error("Jadwal tidak ditemukan.");
  const pertemuan = pakai._count.pertemuan;
  const kegiatan = pakai._count.kegiatan;
  await prisma.jadwal.delete({ where: { id } });
  sukses(
    "/admin/jadwal",
    pertemuan + kegiatan > 0
      ? `Jadwal dihapus permanen beserta ${pertemuan} pertemuan (absensi & jurnal) dan ${kegiatan} kegiatan penilaian.`
      : "Jadwal dihapus permanen."
  );
}

/**
 * Salin seluruh jadwal dari satu semester/periode ke semester lain.
 * Dipakai saat pergantian jadwal berkala: buat periode baru (semester) lalu
 * salin jadwal lama ke sana — jadwal yang bentrok dengan slot yang sudah ada
 * di semester target dilewati. Riwayat pertemuan periode lama tetap aman.
 */
export async function salinJadwalDariSemester(input: {
  sumberId: string;
  targetId: string;
}): Promise<{ disalin: number; dilewati: number }> {
  await wajibAdmin();
  if (!input.sumberId || !input.targetId) throw new Error("Pilih semester sumber dan target.");
  if (input.sumberId === input.targetId) throw new Error("Semester sumber dan target tidak boleh sama.");

  const [sumber, target] = await Promise.all([
    prisma.semester.findUnique({ where: { id: input.sumberId }, include: { jadwal: true } }),
    prisma.semester.findUnique({ where: { id: input.targetId } }),
  ]);
  if (!sumber || !target) throw new Error("Semester tidak ditemukan.");
  if (sumber.deletedAt || target.deletedAt) throw new Error("Periode yang telah diarsipkan tidak bisa dipakai untuk salin jadwal.");
  if (sumber.jadwal.length === 0) throw new Error(`Semester "${sumber.nama}" belum punya jadwal apa pun.`);

  let disalin = 0;
  let dilewati = 0;
  for (const j of sumber.jadwal) {
    const bentrok = await prisma.jadwal.findFirst({
      where: {
        semesterId: input.targetId,
        kelasId: j.kelasId,
        hari: j.hari,
        jamKeMulai: { lt: j.jamKeSelesai },
        jamKeSelesai: { gt: j.jamKeMulai },
      },
      select: { id: true },
    });
    if (bentrok) {
      dilewati++;
      continue;
    }
    await prisma.jadwal.create({
      data: {
        guruId: j.guruId,
        kelasId: j.kelasId,
        mapelId: j.mapelId,
        semesterId: input.targetId,
        hari: j.hari,
        jamKeMulai: j.jamKeMulai,
        jamKeSelesai: j.jamKeSelesai,
      },
    });
    disalin++;
  }
  revalidatePath("/admin/jadwal");
  return { disalin, dilewati };
}

export async function hapusJadwalMasal(ids: string[], paksa = false): Promise<{ dihapus: number; dilewati: number }> {
  const admin = await wajibAdmin();
  if (paksa && admin.role !== "SUPERADMIN") throw new Error("Hanya Super Admin yang boleh menghapus jadwal secara permanen.");
  const unik = [...new Set(ids.filter(Boolean))];
  if (unik.length === 0) return { dihapus: 0, dilewati: 0 };

  const daftar = await prisma.jadwal.findMany({
    where: { id: { in: unik } },
    select: { id: true, _count: { select: { pertemuan: true, kegiatan: true } } },
  });
  // Tanpa paksa: jadwal ber-riwayat dilewati. Dengan paksa: semua dihapus
  // (pertemuan, absensi, jurnal & penilaian ikut terhapus via cascade).
  const bisaHapus = (paksa ? daftar : daftar.filter((j) => j._count.pertemuan === 0 && j._count.kegiatan === 0)).map(
    (j) => j.id
  );
  const dilewati = unik.length - bisaHapus.length;

  if (bisaHapus.length > 0) {
    await prisma.jadwal.deleteMany({ where: { id: { in: bisaHapus } } });
  }
  revalidatePath("/admin/jadwal");
  return { dihapus: bisaHapus.length, dilewati };
}

// ================= TAHUN AJARAN & SEMESTER =================

export async function simpanTahunAjaran(input: { id?: string; nama: string; aktif: boolean }) {
  await wajibAdmin();
  if (!input.nama.trim()) throw new Error("Nama tahun ajaran wajib diisi.");
  if (input.id) {
    await prisma.tahunAjaran.update({ where: { id: input.id }, data: { nama: input.nama.trim() } });
  } else {
    await prisma.tahunAjaran.create({ data: { nama: input.nama.trim() } });
  }
  sukses("/admin/tahun-ajaran", "Tahun ajaran disimpan.");
}



export async function simpanSemester(input: {
  id?: string;
  tahunAjaranId: string;
  nama: string;
  aktif: boolean;
  mulai?: string;
  selesai?: string;
}) {
  await wajibAdmin();
  if (!input.nama.trim()) throw new Error("Nama periode wajib diisi.");
  const duplikat = await prisma.semester.findFirst({
    where: {
      tahunAjaranId: input.tahunAjaranId,
      nama: input.nama.trim(),
      deletedAt: null,
      id: input.id ? { not: input.id } : undefined,
    },
  });
  if (duplikat) throw new Error(`Periode "${input.nama.trim()}" sudah ada di tahun ajaran ini.`);
  // undefined = jangan ubah kolom (mis. tombol "Aktifkan"), "" = kosongkan tanggal, "YYYY-MM-DD" = set
  const mulai = input.mulai === undefined ? undefined : input.mulai ? new Date(input.mulai) : null;
  const selesai = input.selesai === undefined ? undefined : input.selesai ? new Date(input.selesai) : null;
  if (mulai && selesai && mulai > selesai) throw new Error("Tanggal mulai tidak boleh setelah tanggal selesai.");
  let semesterId = input.id;
  if (input.id) {
    // Saat mengubah, jangan hapus tanggal yang tidak dikirim (field absen = pertahankan)
    await prisma.semester.update({
      where: { id: input.id },
      data: {
        nama: input.nama.trim(),
        ...(mulai !== undefined ? { mulai } : {}),
        ...(selesai !== undefined ? { selesai } : {}),
      },
    });
  } else {
    const created = await prisma.semester.create({
      data: { nama: input.nama.trim(), tahunAjaranId: input.tahunAjaranId, mulai: mulai ?? null, selesai: selesai ?? null },
    });
    semesterId = created.id;
  }
  if (input.aktif && semesterId) {
    // Aktifkan periode sekaligus menandai tahun ajarannya sebagai tahun berjalan.
    // Periode aktif adalah satu-satunya sumber kebenaran untuk periode yang dipakai,
    // jadi semua periode di semua tahun dinonaktifkan dulu (hindari dua periode aktif).
    await prisma.$transaction([
      prisma.semester.updateMany({ where: { deletedAt: null }, data: { aktif: false } }),
      prisma.semester.update({ where: { id: semesterId }, data: { aktif: true } }),
      prisma.tahunAjaran.updateMany({ data: { aktif: false } }),
      prisma.tahunAjaran.update({ where: { id: input.tahunAjaranId }, data: { aktif: true } }),
    ]);
  }
  sukses("/admin/tahun-ajaran", "Semester disimpan.");
}

// ================= KALENDER =================

// ================= PERIODE (SEMESTER) =================

/**
 * Hapus periode (soft delete / arsip): periode disembunyikan dari daftar,
 * tapi seluruh jadwal, pertemuan, absensi & jurnal guru tetap aman dan tetap
 * dihitung dalam laporan bulanan. Periode yang sedang aktif tidak bisa dihapus.
 */
export async function hapusSemester(id: string) {
  await wajibAdmin();
  const semester = await prisma.semester.findUnique({ where: { id } });
  if (!semester) throw new Error("Periode tidak ditemukan.");
  if (semester.aktif) throw new Error("Periode yang sedang aktif tidak bisa dihapus. Aktifkan periode lain dulu.");
  await prisma.semester.update({ where: { id }, data: { deletedAt: new Date() } });
  sukses("/admin/tahun-ajaran", `Periode "${semester.nama}" diarsipkan — seluruh jurnal & data guru tetap aman.`);
}

export async function pulihkanSemester(id: string) {
  await wajibAdmin();
  const semester = await prisma.semester.findUnique({ where: { id } });
  if (!semester) throw new Error("Periode tidak ditemukan.");
  await prisma.semester.update({ where: { id }, data: { deletedAt: null } });
  sukses("/admin/tahun-ajaran", `Periode "${semester.nama}" dipulihkan.`);
}

export async function simpanKalender(input: {
  id?: string;
  tanggal: string;
  keterangan: string;
  tipe: string;
  tahunAjaranId: string;
}) {
  await wajibAdmin();
  if (!input.keterangan.trim() || !input.tanggal) throw new Error("Tanggal dan keterangan wajib diisi.");
  const data = { tanggal: new Date(input.tanggal), keterangan: input.keterangan.trim(), tipe: input.tipe, tahunAjaranId: input.tahunAjaranId || null };
  if (input.id) {
    await prisma.kalenderAkademik.update({ where: { id: input.id }, data });
  } else {
    await prisma.kalenderAkademik.create({ data });
  }
  sukses("/admin/kalender", "Kalender akademik disimpan.");
}

export async function hapusKalender(id: string) {
  await wajibAdmin();
  await prisma.kalenderAkademik.delete({ where: { id } });
  sukses("/admin/kalender", "Kalender dihapus.");
}

// ================= USER / HAK AKSES =================

export async function simpanUser(input: {
  id?: string;
  username: string;
  nama?: string;
  role: Role;
  guruId?: string;
  aktif: boolean;
  password?: string;
  wajibGantiPassword?: boolean;
}) {
  const admin = await wajibAdmin();
  const v = validasiInputUser(input);
  if (!v.ok) throw new Error(v.error);
  const roleTervalidasi = v.role;

  const cekPw = validasiPasswordAkun(input.password, !input.id);
  if (!cekPw.ok) throw new Error(cekPw.error);

  if (roleTervalidasi === "SUPERADMIN" && admin.role !== "SUPERADMIN") {
    throw new Error("Hanya Super Admin yang boleh membuat atau mengubah akun menjadi Super Admin.");
  }

  let harusSuksesPath = "";

  if (input.id) {
    // Transaksi interaktif SERIALIZABLE: hitungan SUPERADMIN aktif dan update
    // berada dalam satu transaksi sehingga dua perubahan bersamaan tidak
    // mungkin menghasilkan nol SUPERADMIN aktif.
    await prisma.$transaction(
      async (tx) => {
        const existing = await tx.user.findUnique({ where: { id: input.id! } });
        if (!existing) throw new Error("Akun tidak ditemukan.");
        if (existing.role === "SUPERADMIN" && admin.role !== "SUPERADMIN" && existing.id !== admin.id) {
          throw new Error("Anda tidak memiliki hak untuk mengubah akun Super Admin.");
        }
        const keputusan = keputusanUbahSuperadmin(
          existing,
          { role: roleTervalidasi, aktif: input.aktif },
          await tx.user.count({ where: { role: "SUPERADMIN", aktif: true } })
        );
        if (!keputusan.boleh) throw new Error(keputusan.pesan);

        const bentrokUsername = await tx.user.findUnique({ where: { username: v.username }, select: { id: true } });
        if (bentrokUsername && bentrokUsername.id !== input.id) {
          throw new Error(`Username "${v.username}" sudah digunakan akun lain. Pilih username yang berbeda.`);
        }

        let guruIdFinal: string | null = null;
        let namaFinal = v.namaClient;
        if (v.perluGuru) {
          const guru = await tx.guru.findUnique({
            where: { id: v.guruIdMentah },
            select: { id: true, nama: true, status: true, deletedAt: true, user: { select: { id: true, username: true } } },
          });
          if (!guru) throw new Error("Data Guru tidak ditemukan.");
          if (guru.deletedAt) throw new Error("Data Guru tersebut sudah dihapus.");
          if (!guru.status) throw new Error("Guru tersebut sedang nonaktif — tidak dapat dipakai untuk akun baru.");
          if (guru.user && guru.user.id !== input.id) {
            throw new Error(`Data Guru tersebut sudah terhubung dengan akun @${guru.user.username}. Satu Guru hanya boleh satu akun.`);
          }
          guruIdFinal = v.guruIdMentah;
          namaFinal = guru.nama;
        }
        const cekNama = tentukanIdentitasAkun({ perluGuru: false, namaClient: namaFinal, namaGuruDb: null });
        if (!cekNama.ok) throw new Error(cekNama.error);
        namaFinal = cekNama.nama;

        const data: Record<string, unknown> = {
          username: v.username,
          nama: namaFinal,
          role: roleTervalidasi,
          guruId: guruIdFinal,
          aktif: input.aktif,
          wajibGantiPassword: !!input.wajibGantiPassword,
        };
        const pwTrim = input.password?.trim() ?? "";
        if (pwTrim) data.password = await bcrypt.hash(pwTrim, 10);

        await tx.user.update({ where: { id: input.id! }, data });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    harusSuksesPath = "Akun pengguna diperbarui.";
  } else {
    await prisma.$transaction(async (tx) => {
      const bentrokUsername = await tx.user.findUnique({ where: { username: v.username }, select: { id: true } });
      if (bentrokUsername) {
        throw new Error(`Username "${v.username}" sudah digunakan akun lain. Pilih username yang berbeda.`);
      }

      let guruIdFinal: string | null = null;
      let namaFinal = v.namaClient;
      if (v.perluGuru) {
        const guru = await tx.guru.findUnique({
          where: { id: v.guruIdMentah },
          select: { id: true, nama: true, status: true, deletedAt: true, user: { select: { id: true, username: true } } },
        });
        if (!guru) throw new Error("Data Guru tidak ditemukan.");
        if (guru.deletedAt) throw new Error("Data Guru tersebut sudah dihapus.");
        if (!guru.status) throw new Error("Guru tersebut sedang nonaktif — tidak dapat dipakai untuk akun baru.");
        if (guru.user) {
          throw new Error(`Data Guru tersebut sudah terhubung dengan akun @${guru.user.username}. Satu Guru hanya boleh satu akun.`);
        }
        guruIdFinal = v.guruIdMentah;
        namaFinal = guru.nama;
      }
      const cekNama = tentukanIdentitasAkun({ perluGuru: false, namaClient: namaFinal, namaGuruDb: null });
      if (!cekNama.ok) throw new Error(cekNama.error);
      namaFinal = cekNama.nama;

      const data: Record<string, unknown> = {
        username: v.username,
        nama: namaFinal,
        role: roleTervalidasi,
        guruId: guruIdFinal,
        aktif: input.aktif,
        wajibGantiPassword: !!input.wajibGantiPassword,
      };
      const pwTrim = input.password?.trim() ?? "";
      if (pwTrim) data.password = await bcrypt.hash(pwTrim, 10);

      await tx.user.create({ data: data as never });
    });
    harusSuksesPath = "Akun pengguna dibuat.";
  }

  sukses("/admin/users", harusSuksesPath);
}

export async function hapusUser(id: string) {
  const admin = await wajibAdmin();
  // Transaksi interaktif SERIALIZABLE: status target, hitungan SUPERADMIN
  // aktif, dan delete berada dalam satu transaksi — dua penghapusan
  // bersamaan tidak mungkin menghabiskan SUPERADMIN aktif terakhir.
  await prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) throw new Error("Akun tidak ditemukan.");
      if (user.role === "SUPERADMIN" && admin.role !== "SUPERADMIN") {
        throw new Error("Hanya Super Admin yang boleh menghapus akun Super Admin.");
      }
      const keputusan = keputusanHapusSuperadmin(user, await tx.user.count({ where: { role: "SUPERADMIN", aktif: true } }));
      if (!keputusan.boleh) throw new Error(keputusan.pesan);
      await tx.user.delete({ where: { id } });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
  sukses("/admin/users", "Akun dihapus.");
}

// ================= PENGATURAN =================

export async function simpanPengaturan(input: {
  namaAplikasi: string;
  namaSekolah: string;
  jamSelesai: string;
  batasLaporan: number;
}) {
  await wajibAdmin();
  const entries = [
    ["nama_aplikasi", input.namaAplikasi],
    ["nama_sekolah", input.namaSekolah],
    ["jam_sekolah_selesai", input.jamSelesai],
    ["batas_laporan_bulanan", String(input.batasLaporan)],
  ];
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
    )
  );
  sukses("/admin/pengaturan", "Pengaturan disimpan.");
}

export async function simpanPengaturanWhatsApp(input: { waToken: string; waAktif: boolean }) {
  await wajibAdmin();
  const entries: [string, string][] = [
    ["wa_token", input.waToken.trim()],
    ["wa_aktif", input.waAktif ? "1" : "0"],
  ];
  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
    )
  );
  sukses("/admin/pengaturan", "Pengaturan WhatsApp disimpan.");
}

// ================= JAM PELAJARAN =================

export type ItemJamPelajaran = { hari: Hari; jamKe: number; mulai: string; selesai: string };

/** Ambil seluruh jadwal jam pelajaran dari database. */
export async function getJamPelajaran(): Promise<ItemJamPelajaran[]> {
  const rows = await prisma.jamPelajaran.findMany({ orderBy: [{ hari: "asc" }, { jamKe: "asc" }] });
  return rows.map((r) => ({ hari: r.hari, jamKe: r.jamKe, mulai: r.mulai, selesai: r.selesai }));
}

/** Simpan seluruh jadwal jam pelajaran (replace all). */
export async function simpanJamPelajaran(items: ItemJamPelajaran[]) {
  await wajibAdmin();
  // Validasi: minimal 1 item, tidak ada duplikat hari+jamKe
  if (!items.length) throw new Error("Minimal harus ada satu jam pelajaran.");
  const duplikat = items.find((a, i) => items.some((b, j) => i < j && a.hari === b.hari && a.jamKe === b.jamKe));
  if (duplikat) throw new Error(`Duplikat: ${duplikat.hari} jam ke-${duplikat.jamKe} muncul lebih dari sekali.`);
  // Validasi format & urutan waktu
  for (const item of items) {
    if (!/^\d{2}:\d{2}$/.test(item.mulai) || !/^\d{2}:\d{2}$/.test(item.selesai)) {
      throw new Error(`Format waktu tidak valid pada ${item.hari} jam ke-${item.jamKe}. Gunakan format HH:mm.`);
    }
    if (menitDariWaktu(item.selesai) <= menitDariWaktu(item.mulai)) {
      throw new Error(`Jam selesai harus setelah jam mulai pada ${item.hari} jam ke-${item.jamKe}.`);
    }
  }
  await prisma.$transaction([
    prisma.jamPelajaran.deleteMany(),
    prisma.jamPelajaran.createMany({ data: items }),
  ]);
  // Invalidasi cache jam (lib/jam-utils) — tanpa ini, halaman/aksi lain
  // (validasi form jadwal, rentang waktu) memakai data jam LAMA sampai cache
  // kedaluwarsa (±60 detik) setelah jam pelajaran diubah.
  invalidateJamCache();
  revalidatePath("/admin/jam-pelajaran");
  revalidatePath("/admin/jadwal");
}

// ================= PASSWORD CHANGE REQUEST =================

/** Guru mengajukan permintaan ganti password. */
export async function ajukanGantiPassword(input: { passwordLama: string; passwordBaru: string }) {
  const user = await wajibLogin();
  if (!input.passwordLama || !input.passwordBaru) throw new Error("Password lama dan baru wajib diisi.");
  if (input.passwordBaru.length < 6) throw new Error("Password baru minimal 6 karakter.");
  if (input.passwordLama === input.passwordBaru) throw new Error("Password baru harus berbeda dari password lama.");
  // Verifikasi password lama
  const fullUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!fullUser) throw new Error("Akun tidak ditemukan.");
  const valid = await bcrypt.compare(input.passwordLama, fullUser.password);
  if (!valid) throw new Error("Password lama salah.");
  // Cek apakah ada request PENDING yang belum diproses
  const pending = await prisma.passwordChangeRequest.findFirst({
    where: { userId: user.id, status: "PENDING" },
  });
  if (pending) throw new Error("Anda sudah memiliki permintaan ganti password yang belum diproses. Hubungi admin.");
  // Simpan request
  await prisma.passwordChangeRequest.create({
    data: {
      userId: user.id,
      newPaswordHash: await bcrypt.hash(input.passwordBaru, 10),
    },
  });
  revalidatePath("/profil");
}

/** Admin/SuperAdmin menyetujui atau menolak permintaan ganti password. */
export async function prosesPasswordChange(input: { requestId: string; setujui: boolean; catatan?: string }) {
  await wajibAdmin();
  const request = await prisma.passwordChangeRequest.findUnique({ where: { id: input.requestId } });
  if (!request) throw new Error("Permintaan tidak ditemukan.");
  if (request.status !== "PENDING") throw new Error("Permintaan ini sudah diproses.");
  if (input.setujui) {
    // Terapkan password baru
    await prisma.user.update({ where: { id: request.userId }, data: { password: request.newPaswordHash } });
    await prisma.passwordChangeRequest.update({
      where: { id: input.requestId },
      data: { status: "APPROVED", catatanAdmin: input.catatan ?? null, resolvedAt: new Date() },
    });
    revalidatePath("/admin/users");
  } else {
    await prisma.passwordChangeRequest.update({
      where: { id: input.requestId },
      data: { status: "REJECTED", catatanAdmin: input.catatan ?? null, resolvedAt: new Date() },
    });
    revalidatePath("/admin/users");
  }
}
