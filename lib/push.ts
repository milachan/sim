import webpush from "web-push";
import { prisma } from "./prisma";
import { sinkronkanPertemuan } from "./pertemuan";

/**
 * Kunci VAPID: utamakan env var (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY /
 * VAPID_SUBJECT), fallback ke tabel Setting yang di-generate otomatis
 * saat pertama kali dibutuhkan — jadi fitur langsung jalan tanpa setup manual.
 */
async function getVapidKeys() {
  const envPub = process.env.VAPID_PUBLIC_KEY;
  const envPriv = process.env.VAPID_PRIVATE_KEY;
  if (envPub && envPriv) {
    return {
      publicKey: envPub,
      privateKey: envPriv,
      subject: process.env.VAPID_SUBJECT ?? "mailto:admin@sistem.internal",
    };
  }

  const tersimpan = await prisma.setting.findMany({
    where: { key: { in: ["vapid_public_key", "vapid_private_key"] } },
  });
  let pub = tersimpan.find((s) => s.key === "vapid_public_key")?.value ?? null;
  let priv = tersimpan.find((s) => s.key === "vapid_private_key")?.value ?? null;

  if (!pub || !priv) {
    const baru = webpush.generateVAPIDKeys();
    pub = pub ?? baru.publicKey;
    priv = priv ?? baru.privateKey;
    await prisma.$transaction([
      prisma.setting.upsert({
        where: { key: "vapid_public_key" },
        create: { key: "vapid_public_key", value: pub },
        update: { value: pub },
      }),
      prisma.setting.upsert({
        where: { key: "vapid_private_key" },
        create: { key: "vapid_private_key", value: priv },
        update: { value: priv },
      }),
    ]);
  }

  return {
    publicKey: pub,
    privateKey: priv,
    subject: process.env.VAPID_SUBJECT ?? "mailto:admin@sistem.internal",
  };
}

/** Kunci publik VAPID untuk dikirim ke browser (lewat /api/push/keys). */
export async function getVapidPublicKey() {
  return (await getVapidKeys()).publicKey;
}

export type DataNotifikasi = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
};

/**
 * Kirim notifikasi ke semua perangkat terdaftar milik seorang user.
 * Langganan yang sudah tidak berlaku (404/410) otomatis dihapus.
 */
export async function kirimKeUser(userId: string, data: DataNotifikasi) {
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return 0;

  const keys = await getVapidKeys();
  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);

  let terkirim = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({
          title: data.title,
          body: data.body,
          url: data.url ?? "/",
          tag: data.tag ?? "notifikasi",
          icon: data.icon ?? "/icons/icon-192.png",
          badge: data.badge ?? "/icons/icon-192.png",
        })
      );
      terkirim++;
    } catch (e) {
      const status = (e as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        // Endpoint tidak berlaku lagi — bersihkan dari DB
        await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      }
    }
  }
  return terkirim;
}

/**
 * Pengingat jurnal belum dilengkapi (blueprint bagian 9):
 * dikirim setelah jam sekolah selesai, ke guru yang punya pertemuan lalu
 * tanpa jurnal. `paksa` melewati cek jam (untuk tombol admin / pengujian).
 */
export async function kirimPengingatJurnal(opts?: {
  paksa?: boolean;
  testOnly?: boolean;
  userId?: string;
}) {
  // ---- Mode uji coba: kirim ke user yang memanggil ----
  if (opts?.testOnly) {
    if (!opts.userId) return { ok: false, pesan: "userId diperlukan untuk uji coba." };
    const user = await prisma.user.findUnique({ where: { id: opts.userId } });
    const terkirim = await kirimKeUser(opts.userId, {
      title: "🔔 Uji Coba Notifikasi",
      body: `Halo ${(user?.nama ?? "Guru").split(",")[0]}! Notifikasi berhasil aktif. Anda akan diingatkan melengkapi jurnal setelah jam sekolah.`,
      url: "/jurnal",
      tag: "uji-coba",
    });
    return {
      ok: true,
      pesan: terkirim > 0 ? `Notifikasi uji coba terkirim ke ${terkirim} perangkat.` : "Belum ada perangkat terdaftar untuk akun ini.",
      terkirim,
    };
  }

  // Sinkronkan pertemuan otomatis sampai hari ini dulu — guru yang tidak pernah
  // membuka aplikasi tetap punya pertemuan sehingga pengingat jurnal akurat.
  await sinkronkanPertemuan();

  // ---- Cek waktu: hanya setelah jam sekolah selesai ----
  const jamSetting = await prisma.setting.findUnique({ where: { key: "jam_sekolah_selesai" } });
  const jamSelesai = jamSetting?.value ?? "15:00";
  const [hh, mm] = jamSelesai.split(":").map(Number);
  const sekarang = new Date();
  const lewatJam =
    sekarang.getHours() > hh || (sekarang.getHours() === hh && sekarang.getMinutes() >= mm);

  if (!opts?.paksa && !lewatJam) {
    return { ok: true, pesan: `Belum waktunya — pengingat otomatis dikirim setelah jam ${jamSelesai}.`, terkirim: 0, sasaran: 0 };
  }

  // ---- Guru yang punya pertemuan lalu tanpa jurnal & terdaftar push ----
  const guruBermasalah = await prisma.guru.findMany({
    where: {
      status: true,
      deletedAt: null,
      user: { is: { pushSubscriptions: { some: {} } } },
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
    include: { user: { select: { id: true } } },
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
    if (jumlah === 0 || !g.user) continue;
    sasaran++;
    hasil.push({ guru: g.nama, jumlah });
    terkirim += await kirimKeUser(g.user.id, {
      title: "📝 Pengingat Jurnal",
      body: `Anda masih punya ${jumlah} jurnal belum dilengkapi dari pertemuan lalu. Yuk lengkapi agar administrasi tetap rapi!`,
      url: "/jurnal",
      tag: "pengingat-jurnal",
    });
  }

  return {
    ok: true,
    pesan:
      sasaran === 0
        ? "Semua guru sudah lengkap — tidak ada pengingat yang dikirim. 🎉"
        : `Pengingat dikirim ke ${terkirim} perangkat dari ${sasaran} guru.`,
    terkirim,
    sasaran,
    hasil,
  };
}
