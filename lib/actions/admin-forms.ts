"use server";

import { redirect } from "next/navigation";
import type { JenisGuru } from "@prisma/client";
import {
  hapusGuru,
  hapusJadwal,
  hapusJadwalPaksa,
  hapusKalender,
  hapusKelas,
  hapusMapel,
  hapusSemester,
  hapusSiswa,
  hapusUser,
  pulihkanSemester,
  pulihkanGuru,
  pulihkanSiswa,

  simpanPengaturanWhatsApp,
  simpanGuru,
  simpanJadwal,
  simpanKalender,
  simpanKelas,
  simpanMapel,
  simpanPengaturan,
  simpanSemester,
  simpanSiswa,
  simpanTahunAjaran,
  simpanUser,
  ajukanGantiPassword,
  prosesPasswordChange,
} from "./admin";
import type { Hari, Role } from "@prisma/client";

async function jalan(fn: () => Promise<void>, path: string) {
  try {
    await fn();
  } catch (e) {
    if (e instanceof Error && "digest" in e && String((e as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")) {
      throw e;
    }
    redirect(`${path}?error=${encodeURIComponent(e instanceof Error ? e.message : "Terjadi kesalahan.")}`);
  }
}

export async function formGuru(formData: FormData) {
  await jalan(
    () =>
      simpanGuru({
        id: (formData.get("id") as string) || undefined,
        nama: (formData.get("nama") as string) ?? "",
        kode: (formData.get("kode") as string) ?? "",
        nip: (formData.get("nip") as string) ?? "",
        telepon: (formData.get("telepon") as string) ?? "",
        status: formData.get("status") === "1",
        jenisGuru: (formData.get("jenisGuru") as JenisGuru) ?? "BIASA",
        mapelIds: formData.getAll("mapelId").map(String),
      }),
    "/admin/guru"
  );
}

export async function formHapusGuru(formData: FormData) {
  await jalan(() => hapusGuru(formData.get("id") as string), "/admin/guru");
}

export async function formPulihkanGuru(formData: FormData) {
  await jalan(() => pulihkanGuru(formData.get("id") as string), "/admin/guru");
}

export async function formSiswa(formData: FormData) {
  await jalan(
    () =>
      simpanSiswa({
        id: (formData.get("id") as string) || undefined,
        nama: (formData.get("nama") as string) ?? "",
        nisn: (formData.get("nisn") as string) ?? "",
        nis: (formData.get("nis") as string) ?? "",
        jenisKelamin: ((formData.get("jenisKelamin") as string) || null) as "L" | "P" | null,
        kelasId: (formData.get("kelasId") as string) ?? "",
        status: (formData.get("status") as "AKTIF") ?? "AKTIF",
      }),
    "/admin/siswa"
  );
}

export async function formHapusSiswa(formData: FormData) {
  await jalan(() => hapusSiswa(formData.get("id") as string), "/admin/siswa");
}

export async function formPulihkanSiswa(formData: FormData) {
  await jalan(() => pulihkanSiswa(formData.get("id") as string), "/admin/siswa");
}

export async function formKelas(formData: FormData) {
  await jalan(
    () =>
      simpanKelas({
        id: (formData.get("id") as string) || undefined,
        nama: (formData.get("nama") as string) ?? "",
        tingkat: Number(formData.get("tingkat") ?? 7),
        waliKelasId: (formData.get("waliKelasId") as string) ?? "",
      }),
    "/admin/kelas"
  );
}

export async function formHapusKelas(formData: FormData) {
  await jalan(() => hapusKelas(formData.get("id") as string), "/admin/kelas");
}

export async function formMapel(formData: FormData) {
  await jalan(
    () =>
      simpanMapel({
        id: (formData.get("id") as string) || undefined,
        nama: (formData.get("nama") as string) ?? "",
        kode: (formData.get("kode") as string) ?? "",
      }),
    "/admin/mapel"
  );
}

export async function formHapusMapel(formData: FormData) {
  await jalan(() => hapusMapel(formData.get("id") as string), "/admin/mapel");
}

export async function formJadwal(formData: FormData) {
  await jalan(
    () =>
      simpanJadwal({
        id: (formData.get("id") as string) || undefined,
        guruId: (formData.get("guruId") as string) ?? "",
        kelasId: (formData.get("kelasId") as string) ?? "",
        mapelId: (formData.get("mapelId") as string) ?? "",
        hari: (formData.get("hari") as Hari) ?? "SENIN",
        jamKeMulai: Number(formData.get("jamMulai") ?? 1),
        jamKeSelesai: Number(formData.get("jamSelesai") ?? 2),
      }),
    "/admin/jadwal"
  );
}

export async function formHapusJadwal(formData: FormData) {
  await jalan(() => hapusJadwal(formData.get("id") as string), "/admin/jadwal");
}

export async function formHapusJadwalPaksa(formData: FormData) {
  await jalan(() => hapusJadwalPaksa(formData.get("id") as string), "/admin/jadwal");
}

export async function formTahunAjaran(formData: FormData) {
  await jalan(
    () =>
      simpanTahunAjaran({
        id: (formData.get("id") as string) || undefined,
        nama: (formData.get("nama") as string) ?? "",
        aktif: false,
      }),
    "/admin/tahun-ajaran"
  );
}


export async function formSemester(formData: FormData) {
  await jalan(
    () =>
      simpanSemester({
        id: (formData.get("id") as string) || undefined,
        tahunAjaranId: (formData.get("tahunAjaranId") as string) ?? "",
        nama: (formData.get("nama") as string) ?? "Ganjil",
        aktif: formData.get("aktif") === "1",
        // "" (kosong) = hapus tanggal; absen (null) = pertahankan tanggal lama
        mulai: (formData.get("mulai") as string) ?? undefined,
        selesai: (formData.get("selesai") as string) ?? undefined,
      }),
    "/admin/tahun-ajaran"
  );
}

export async function formKalender(formData: FormData) {
  await jalan(
    () =>
      simpanKalender({
        id: (formData.get("id") as string) || undefined,
        tanggal: (formData.get("tanggal") as string) ?? "",
        keterangan: (formData.get("keterangan") as string) ?? "",
        tipe: (formData.get("tipe") as string) ?? "KEGIATAN",
        tahunAjaranId: (formData.get("tahunAjaranId") as string) ?? "",
      }),
    "/admin/kalender"
  );
}

export async function formHapusKalender(formData: FormData) {
  await jalan(() => hapusKalender(formData.get("id") as string), "/admin/kalender");
}

export async function formHapusSemester(formData: FormData) {
  await jalan(() => hapusSemester(formData.get("id") as string), "/admin/tahun-ajaran");
}

export async function formPulihkanSemester(formData: FormData) {
  await jalan(() => pulihkanSemester(formData.get("id") as string), "/admin/tahun-ajaran");
}

export async function formUser(formData: FormData) {
  await jalan(
    () =>
      simpanUser({
        id: (formData.get("id") as string) || undefined,
        username: (formData.get("username") as string) ?? "",
        nama: (formData.get("nama") as string) ?? "",
        role: (formData.get("role") as Role) ?? "GURU",
        guruId: (formData.get("guruId") as string) ?? "",
        aktif: formData.get("aktif") === "1",
        password: (formData.get("password") as string) || undefined,
        wajibGantiPassword: formData.get("wajibGantiPassword") === "1",
      }),
    "/admin/users"
  );
}

export async function formHapusUser(formData: FormData) {
  await jalan(() => hapusUser(formData.get("id") as string), "/admin/users");
}

export async function formPengaturan(formData: FormData) {
  await jalan(
    () =>
      simpanPengaturan({
        namaAplikasi: (formData.get("namaAplikasi") as string) ?? "",
        namaSekolah: (formData.get("namaSekolah") as string) ?? "",
        jamSelesai: (formData.get("jamSelesai") as string) ?? "15:00",
        batasLaporan: Number(formData.get("batasLaporan") ?? 5),
      }),
    "/admin/pengaturan"
  );
}

export async function formPengaturanWhatsApp(formData: FormData) {
  await jalan(
    () =>
      simpanPengaturanWhatsApp({
        waToken: (formData.get("waToken") as string) ?? "",
        waAktif: formData.get("waAktif") === "1",
      }),
    "/admin/pengaturan"
  );
}

export async function formAjukanGantiPassword(formData: FormData) {
  await jalan(
    () =>
      ajukanGantiPassword({
        passwordLama: (formData.get("passwordLama") as string) ?? "",
        passwordBaru: (formData.get("passwordBaru") as string) ?? "",
      }),
    "/profil"
  );
}

export async function formProsesPasswordChange(formData: FormData) {
  await jalan(
    () =>
      prosesPasswordChange({
        requestId: (formData.get("requestId") as string) ?? "",
        setujui: formData.get("setujui") === "1",
        catatan: (formData.get("catatan") as string) || undefined,
      }),
    "/admin/users"
  );
}
