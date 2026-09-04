import { prisma } from "./prisma";
import { sinkronkanPertemuan } from "./pertemuan";

/**
 * Integrasi WhatsApp (blueprint bagian 9) via gateway Fonnte
 * (https://api.fonnte.com/send). Token utamakan env var WA_TOKEN,
 * fallback ke tabel Setting yang diisi lewat halaman Pengaturan Sistem.
 */

type WaConfig = {
  token: string;
  aktif: boolean;
};

async function getWaConfig(): Promise<WaConfig | null> {
  const envToken = process.env.WA_TOKEN;
  const tabel = await prisma.setting.findMany({ where: { key: { in: ["wa_token", "wa_aktif"] } } });
  const token = envToken || (tabel.find((s) => s.key === "wa_token")?.value ?? "");
  if (!token) return null;
  return { token, aktif: tabel.find((s) => s.key === "wa_aktif")?.value === "1" };
}

/** Normalisasi nomor: 08xx → 628xx; biarkan yang sudah pakai kode negara. */
export function normalisasiNomor(no: string): string {
  const bersih = no.replace(/[^0-9]/g, "");
  if (bersih.startsWith("0")) return "62" + bersih.slice(1);
  return bersih;
}

/**
 * Kirim satu pesan ke satu nomor via Fonnte.
 * Mengembalikan { ok, pesan } — pesan berisi reason dari Fonnte bila gagal.
 */
export async function kirimWhatsApp(nomor: string, pesan: string): Promise<{ ok: boolean; pesan: string }> {
  const config = await getWaConfig();
  if (!config) return { ok: false, pesan: "Token WhatsApp belum diatur. Isi di Pengaturan Sistem." };
  if (!config.aktif) return { ok: false, pesan: "Notifikasi WhatsApp dinonaktifkan di Pengaturan Sistem." };

  const target = normalisasiNomor(nomor);
  if (!target) return { ok: false, pesan: "Nomor tujuan tidak valid." };

  const body = new URLSearchParams({ target, message: pesan, countryCode: "62" });

  try {
    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { Authorization: config.token, "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    const data = (await res.json()) as { status?: boolean; reason?: string; detail?: string };
    if (data.status === false) {
      return { ok: false, pesan: data.reason ?? "Gagal dikirim (response tidak diketahui)." };
    }
    return { ok: true, pesan: data.detail ?? "Pesan masuk antrean." };
  } catch {
    return { ok: false, pesan: "Gagal terhubung ke gateway Fonnte. Cek koneksi internet & token." };
  }
}

/**
 * Pengingat jurnal belum dilengkapi via WhatsApp (mirip kirimPengingatJurnal
 * di lib/push.ts). Dikirim ke guru yang punya pertemuan lalu tanpa jurnal
 * dan memiliki nomor telepon terdaftar. `paksa` melewati cek jam sekolah.
 */
export async function kirimPengingatWhatsApp(opts?: { paksa?: boolean; testOnly?: boolean; userId?: string }) {
  const config = await getWaConfig();
  if (!config) {
    return { ok: false, pesan: "Token WhatsApp belum diatur. Isi di Pengaturan Sistem.", terkirim: 0, sasaran: 0 };
  }
  if (!config.aktif) {
    return { ok: false, pesan: "Notifikasi WhatsApp dinonaktifkan di Pengaturan Sistem.", terkirim: 0, sasaran: 0 };
  }

  // ---- Mode uji coba: kirim ke telepon guru dari akun yang memanggil ----
  if (opts?.testOnly) {
    if (!opts.userId) return { ok: false, pesan: "userId diperlukan untuk uji coba.", terkirim: 0, sasaran: 0 };
    const user = await prisma.user.findUnique({
      where: { id: opts.userId },
      include: { guru: { select: { nama: true, telepon: true } } },
    });
    const nomor = user?.guru?.telepon;
    if (!nomor) {
      return { ok: false, pesan: "Nomor WhatsApp belum terdaftar di data guru Anda.", terkirim: 0, sasaran: 0 };
    }
    const hasil = await kirimWhatsApp(
      nomor,
      `Halo ${user!.guru!.nama.split(",")[0]}! Ini uji coba notifikasi WhatsApp dari Sistem Administrasi Guru. Anda akan diingatkan melengkapi jurnal setelah jam sekolah.`
    );
    return { ok: hasil.ok, pesan: hasil.ok ? `Pesan uji coba terkirim ke ${normalisasiNomor(nomor)}.` : hasil.pesan, terkirim: hasil.ok ? 1 : 0, sasaran: hasil.ok ? 1 : 0 };
  }

  // Sinkronkan pertemuan otomatis sampai hari ini dulu — guru yang tidak pernah
  // membuka aplikasi tetap punya pertemuan sehingga pengingat jurnal akurat.
  await sinkronkanPertemuan();

  // ---- Cek waktu: hanya setelah jam sekolah selesai ----
  const jamSetting = await prisma.setting.findUnique({ where: { key: "jam_sekolah_selesai" } });
  const jamSelesai = jamSetting?.value ?? "15:00";
  const [hh, mm] = jamSelesai.split(":").map(Number);
  const sekarang = new Date();
  const lewatJam = sekarang.getHours() > hh || (sekarang.getHours() === hh && sekarang.getMinutes() >= mm);

  if (!opts?.paksa && !lewatJam) {
    return { ok: true, pesan: `Belum waktunya — pengingat WhatsApp dikirim setelah jam ${jamSelesai}.`, terkirim: 0, sasaran: 0 };
  }

  // ---- Guru dengan pertemuan lalu tanpa jurnal & punya nomor telepon ----
  const guruBermasalah = await prisma.guru.findMany({
    where: {
      status: true,
      deletedAt: null,
      telepon: { not: null },
      jadwal: {
        some: {
          pertemuan: {
            some: {
              tanggal: { lte: new Date() },
              status: { not: "TIDAK_TERLAKSANA" },
              jurnal: { is: null },
            },
          },
        },
      },
    },
  });

  let terkirim = 0;
  let sasaran = 0;
  const hasil: { guru: string; jumlah: number }[] = [];

  for (const g of guruBermasalah) {
    const jumlah = await prisma.pertemuan.count({
      where: {
        jadwal: { guruId: g.id },
        tanggal: { lte: new Date() },
        status: { not: "TIDAK_TERLAKSANA" },
        jurnal: { is: null },
      },
    });
    if (jumlah === 0 || !g.telepon) continue;
    sasaran++;
    hasil.push({ guru: g.nama, jumlah });
    const res = await kirimWhatsApp(
      g.telepon,
      `📝 Pengingat Jurnal — ${jamSelesai} WIB\n\nHalo ${g.nama.split(",")[0]}, Anda masih punya ${jumlah} jurnal belum dilengkapi dari pertemuan lalu. Yuk lengkapi agar administrasi tetap rapi!`
    );
    if (res.ok) terkirim++;
  }

  return {
    ok: true,
    pesan:
      sasaran === 0
        ? "Semua guru sudah lengkap (atau belum ada yang punya nomor) — tidak ada pengingat dikirim."
        : `Pengingat WhatsApp dikirim ke ${terkirim} dari ${sasaran} guru.`,
    terkirim,
    sasaran,
    hasil,
  };
}
