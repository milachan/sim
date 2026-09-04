import { PrismaClient, Hari, StatusAbsensi, StatusJurnal, StatusPertemuan, SumberPertemuan, JenisKegiatan, StatusKumpul, JenisGuru } from "@prisma/client";
import bcrypt from "bcryptjs";
import { MAPEL_KODE, jamPembukaHari } from "@/lib/constants";

const prisma = new PrismaClient();

// ---------- PRNG deterministik agar seed bisa diulang ----------
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260806);
const ambil = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];

const PASSWORD = "password123";

async function main() {
  console.log("🧹 Membersihkan data lama...");
  await prisma.riwayatPerubahan.deleteMany();
  await prisma.nilaiSiswa.deleteMany();
  await prisma.penilaianKegiatan.deleteMany();
  await prisma.absensiHarianItem.deleteMany();
  await prisma.absensiHarian.deleteMany();
  await prisma.jurnal.deleteMany();
  await prisma.absensiItem.deleteMany();
  await prisma.pertemuan.deleteMany();
  await prisma.jadwal.deleteMany();
  await prisma.semester.deleteMany();
  await prisma.tahunAjaran.deleteMany();
  await prisma.siswa.deleteMany();
  await prisma.kelas.deleteMany();
  await prisma.mataPelajaran.deleteMany();
  await prisma.user.deleteMany();
  await prisma.guru.deleteMany();
  await prisma.laporanBulanan.deleteMany();
  await prisma.kalenderAkademik.deleteMany();
  await prisma.setting.deleteMany();

  console.log("🏫 Sekolah & tahun ajaran...");
  await prisma.sekolah.create({
    data: { nama: "MTs Negeri 2 Kebumen", npsn: "20363581", alamat: "Jl. Raya Karangsari No. 12, Kebumen", telepon: "(0287) 381234", email: "info@mtsn2kebumen.sch.id" },
  });
  const ta = await prisma.tahunAjaran.create({ data: { nama: "2025/2026", aktif: true } });
  const smt = await prisma.semester.create({
    data: {
      nama: "Ganjil",
      aktif: true,
      tahunAjaranId: ta.id,
      // Tanggal berlaku: memungkinkan pergantian periode otomatis berdasarkan tanggal
      mulai: new Date("2026-07-20"),
      selesai: new Date("2026-12-31"),
    },
  });
  // Periode demo kedua (belum aktif) — untuk mencoba tombol Aktifkan / Hapus periode
  await prisma.semester.create({
    data: {
      nama: "Ganjil — Periode 2",
      aktif: false,
      tahunAjaranId: ta.id,
      mulai: new Date("2026-11-01"),
      selesai: new Date("2026-12-31"),
    },
  });

  // ---------- Mata pelajaran (mapel asli MTsN 2 Kebumen) ----------
  const mapels = [
    "Al-Qur'an Hadits", "Akidah Akhlaq", "Fiqih", "SKI", "Bahasa Arab",
    "Bahasa Indonesia", "Matematika", "Bahasa Inggris", "IPA", "IPS",
    "Pendidikan Pancasila", "Bahasa Jawa", "PJOK", "Informatika", "Seni Budaya",
    "Prakarya", "Tahfidz", "Bimbingan Konseling",
  ];
  const mapelList: Awaited<ReturnType<typeof prisma.mataPelajaran.create>>[] = [];
  for (const m of mapels) {
    mapelList.push(await prisma.mataPelajaran.create({ data: { nama: m, kode: MAPEL_KODE[m] ?? m.slice(0, 3).toUpperCase() } }));
  }
  const byNama = (nama: string) => mapelList.find((m) => m.nama === nama)!;

  // ---------- Guru ----------
  console.log("👨‍🏫 Guru...");
  // Data demo: guru biasa, guru piket (backup absensi harian), guru BK (bimbingan konseling)
  const daftarGuru = [
    { nama: "Budi Santoso, S.Kom.", mapel: ["Informatika", "Matematika"], jenisGuru: JenisGuru.BIASA },
    { nama: "Siti Aminah, S.Ag.", mapel: ["Al-Qur'an Hadits", "Fiqih"], jenisGuru: JenisGuru.BIASA },
    { nama: "Rina Marlina, S.Psi.", mapel: ["Bimbingan Konseling"], jenisGuru: JenisGuru.BK },
  ];
  const guruList: { id: string; nama: string; mapel: string[] }[] = [];
  const guruToUser = new Map<string, string>(); // guruId → userId (pengisi absensi harian)
  for (const [i, g] of daftarGuru.entries()) {
    const guru = await prisma.guru.create({
      data: {
        nama: g.nama,
        nip: String(198000000 + i * 137),
        // Nomor WhatsApp demo (08xxxxxxxxx) agar fitur notifikasi WA bisa dicoba
        telepon: `0812${String(34000000 + i * 137000).slice(0, 8)}`,
        jenisGuru: g.jenisGuru,
        mapelDiampu: { connect: g.mapel.map((m) => ({ id: byNama(m).id })) },
      },
    });
    guruList.push({ id: guru.id, nama: g.nama, mapel: g.mapel });
    const userGuru = await prisma.user.create({
      data: {
        username: `guru${i + 1}`,
        password: await bcrypt.hash(PASSWORD, 10),
        nama: g.nama,
        role: "GURU",
        guruId: guru.id,
      },
    });
    guruToUser.set(guru.id, userGuru.id);
  }
  // ---------- Akun khusus Guru Piket ----------
  // Satu akun yang dipakai bergantian oleh semua petugas piket. Fungsinya hanya
  // mengisi absensi harian kelas sebagai backup saat guru jam pertama belum
  // mengisi. Kode "PIKET" dipakai sebagai penanda akun khusus ini.
  const guruPiket = await prisma.guru.create({
    data: { nama: "Petugas Piket", kode: "PIKET", jenisGuru: JenisGuru.PIKET },
  });
  await prisma.user.create({
    data: {
      username: "piket",
      password: await bcrypt.hash(PASSWORD, 10),
      nama: "Petugas Piket",
      role: "GURU",
      guruId: guruPiket.id,
    },
  });
  const guruMapel = (mapelNama: string) => guruList.filter((g) => g.mapel.includes(mapelNama));

  // ---------- Kelas ----------
  console.log("🏫 Kelas & siswa...");
  // Data minimal untuk uji coba: hanya 1 kelas
  const kelasData = [
    { nama: "9A", tingkat: 9, wali: "Budi Santoso, S.Kom." },
  ];
  const namaDepan = ["Ahmad", "Aisyah", "Bima", "Citra", "Daffa", "Eka", "Fajar", "Gita", "Hasan", "Intan", "Jihan", "Kevin", "Lulu", "Mila", "Naufal", "Oktavia", "Putri", "Rafi", "Salsabila", "Taufik", "Umar", "Vina", "Wildan", "Zahra"];
  const namaBelakang = ["Pratama", "Ramadhan", "Saputra", "Ningsih", "Wijaya", "Hidayat", "Kusuma", "Rahayu", "Firmansyah", "Anggraini", "Maulana", "Puspita"];
  let nisCounter = 24001;
  let nisnCounter = 3000000001;

  const kelasList: Awaited<ReturnType<typeof prisma.kelas.create>>[] = [];
  for (const kd of kelasData) {
    const wali = guruList.find((g) => g.nama === kd.wali)!;
    const kelas = await prisma.kelas.create({
      data: { nama: kd.nama, tingkat: kd.tingkat, waliKelasId: wali.id },
    });
    // Sinkron jenisGuru wali kelas (kecuali piket/BK yang lebih spesifik)
    await prisma.guru.updateMany({ where: { id: wali.id, jenisGuru: "BIASA" }, data: { jenisGuru: "WALI_KELAS" } });
    await prisma.waliKelasRiwayat.create({ data: { kelasId: kelas.id, guruId: wali.id, semesterId: smt.id } });
    // 10 siswa per kelas — NISN (10 digit) menjadi kunci sinkron import
    const siswaData = Array.from({ length: 10 }, () => {
      const nama = `${ambil(namaDepan)} ${ambil(namaBelakang)}`;
      return { nama, nisn: String(nisnCounter++), nis: String(nisCounter++), kelasId: kelas.id };
    });
    await prisma.siswa.createMany({ data: siswaData });
    kelasList.push(kelas);
  }
  const siswaPerKelas = await prisma.siswa.findMany({ where: { status: "AKTIF", deletedAt: null }, orderBy: { nama: "asc" } });

  // ---------- Jadwal (hanya mapel yang diampu 2 guru, 2 slot per mapel per kelas) ----------
  console.log("📅 Jadwal pelajaran...");
  const HARI_LIST: Hari[] = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
  const jadwalList: { id: string; kelasId: string; mapelNama: string; hari: Hari; jamMulai: number; jamSelesai: number; guruId: string }[] = [];
  let jadwalIdx = 0;
  for (const kelas of kelasList) {
    for (const mapel of mapelList) {
      const pengampu = guruMapel(mapel.nama);
      if (pengampu.length === 0) continue; // mapel tanpa guru pengampu dilewati
      // Tiap mapel yang diampu mendapat 2 slot per kelas di hari berbeda
      for (let s = 0; s < 2; s++) {
        let hari = HARI_LIST[(jadwalIdx * 2 + s) % HARI_LIST.length];
        const guru = pengampu[jadwalIdx % pengampu.length];
        let jamMulai = ((jadwalIdx + s) % 5) + 1;
        let jamSelesai = Math.min(9, jamMulai + ((jadwalIdx + s) % 3 === 0 ? 2 : 1));
        // Contoh alur blueprint: Informatika — IX A, Jam 1–2 (Kamis = hari demo).
        // Hanya slot pertama yang diarahkan ke Kamis 1–2; slot kedua tetap di hari
        // lain agar tidak tercipta dua jadwal identik di jam yang sama.
        if (kelas.nama === "9A" && mapel.nama === "Informatika" && s === 0) {
          hari = "KAMIS";
          jamMulai = 1;
          jamSelesai = 2;
        }
        const jadwal = await prisma.jadwal.create({
          data: { guruId: guru.id, kelasId: kelas.id, mapelId: mapel.id, semesterId: smt.id, hari, jamKeMulai: jamMulai, jamKeSelesai: jamSelesai },
        });
        jadwalList.push({ id: jadwal.id, kelasId: kelas.id, mapelNama: mapel.nama, hari, jamMulai, jamSelesai, guruId: guru.id });
        jadwalIdx++;
      }
    }
  }

  // ---------- Pertemuan 2 minggu terakhir ----------
  console.log("📗 Pertemuan, absensi & jurnal...");
  const mulai = new Date("2026-07-20"); // Senin
  const selesai = new Date("2026-08-06"); // Hari ini (Kamis)
  const tanggalHari: Date[] = [];
  for (let d = new Date(mulai); d <= selesai; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0) tanggalHari.push(new Date(d)); // skip Minggu
  }
  const namaHariInggris = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  const METODE = ["Ceramah interaktif", "Diskusi kelompok", "Praktik langsung", "Tanya jawab", "Pembelajaran berbasis proyek", "Permainan edukatif"];
  const MEDIA = ["Papan tulis", "Buku paket", "Laptop & proyektor", "Video pembelajaran", "Modul cetak", "Alat peraga"];
  const MATERI_TEMPLATE: Record<string, string[]> = {
    "Al-Qur'an Hadits": ["Hukum Bacaan Nun Mati dan Mim Mati", "Hafalan Surat Pendek", "Hadits tentang Kebersihan", "Tajwid: Mad Thabi'i", "Hadits tentang Silaturahmi"],
    "Akidah Akhlaq": ["Asmaul Husna", "Iman kepada Malaikat", "Akhlak Terpuji", "Akhlak Tercela", "Iman kepada Kitab Allah"],
    Fiqih: ["Thaharah dan Wudhu", "Shalat Fardhu", "Puasa Ramadhan", "Zakat Fitrah", "Shalat Berjamaah"],
    SKI: ["Sejarah Nabi Muhammad SAW", "Khulafaur Rasyidin", "Masuknya Islam ke Nusantara", "Kerajaan Islam di Indonesia", "Perjuangan Ulama Nusantara"],
    "Bahasa Arab": ["Mufrodat Keluarga", "Isim Isyarah", "Fi'il Madhi", "Alamat dan Profesi", "Percakapan Sederhana"],
    "Bahasa Indonesia": ["Teks Deskripsi", "Teks Prosedur", "Teks Narasi", "Pidato Persuasif", "Unsur Kebahasaan"],
    Matematika: ["Bilangan Bulat", "Aljabar", "Persamaan Linear", "Bangun Datar", "Perbandingan"],
    "Bahasa Inggris": ["Greetings & Introductions", "Simple Present Tense", "Descriptive Text", "Procedure Text", "Past Tense"],
    IPA: ["Klasifikasi Makhluk Hidup", "Struktur Sel", "Sistem Pencernaan", "Pencemaran Lingkungan", "Gerak dan Gaya"],
    IPS: ["Interaksi Sosial", "Kegiatan Ekonomi", "Perubahan Sosial", "Peta dan Komponennya", "Globalisasi"],
    "Pendidikan Pancasila": ["Pancasila sebagai Dasar Negara", "Norma dan Keadilan", "Bhinneka Tunggal Ika", "Hak dan Kewajiban Warga Negara", "Gotong Royong"],
    "Bahasa Jawa": ["Tembang Dolanan", "Aksara Jawa", "Unggah-Ungguh Basa", "Wayang", "Parikan"],
    PJOK: ["Permainan Bola Besar", "Atletik", "Kebugaran Jasmani", "Bela Diri", "Permainan Bola Kecil"],
    Informatika: ["Berpikir Komputasional", "Algoritma Dasar", "Sistem Komputer", "Jaringan Komputer", "Dampak Sosial Informatika"],
    "Seni Budaya": ["Menggambar Ragam Hias", "Musik Tradisional", "Tari Nusantara", "Seni Rupa Terapan", "Apresiasi Seni"],
    Prakarya: ["Kerajinan dari Bahan Alam", "Budidaya Tanaman", "Pengolahan Pangan", "Rekayasa Sederhana", "Desain Produk"],
    Tahfidz: ["Murajaah Juz 30", "Hafalan Surat Pilihan", "Tajwid dalam Hafalan", "Adab Menghafal Al-Qur'an", "Murajaah Surat Al-Mulk"],
    "Bimbingan Konseling": ["Layanan Informasi Akademik", "Konseling Kelompok", "Bimbingan Karier", "Pencegahan Bullying", "Motivasi Belajar"],
  };
  const materiMapel = (nama: string) => MATERI_TEMPLATE[nama] ?? ["Materi Inti", "Pendalaman Materi", "Latihan Soal"];

  const tanggalHariIni = new Date("2026-08-06");
  let pertemuanCount = 0;

  for (const jadwal of jadwalList) {
    const hariNama = namaHariInggris[["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"].indexOf(jadwal.hari) + 1];
    const tanggalJadwal = tanggalHari.filter((t) => namaHariInggris[t.getDay()] === hariNama);
    const siswaKelas = siswaPerKelas.filter((s) => s.kelasId === jadwal.kelasId);

    let ke = 0;
    for (const tanggal of tanggalJadwal) {
      ke++;
      pertemuanCount++;
      const isHariIni = tanggal.getTime() === tanggalHariIni.getTime();
      // Keputusan status (deterministik acak)
      const roll = rnd();
      let tidakTerlaksana = roll < 0.04;
      let jurnalStatus: StatusJurnal | null = null;
      let absensiIsi = false;

      if (!tidakTerlaksana) {
        if (isHariIni) {
          absensiIsi = true;
          jurnalStatus = rnd() < 0.6 ? "TERKIRIM" : null;
        } else if (roll < 0.62) {
          absensiIsi = true;
          jurnalStatus = rnd() < 0.72 ? (rnd() < 0.75 ? "TERKIRIM" : "DRAFT") : null;
        } else if (roll < 0.78) {
          absensiIsi = false;
          jurnalStatus = rnd() < 0.5 ? "DRAFT" : null;
        }
      }

      const status: StatusPertemuan = tidakTerlaksana
        ? "TIDAK_TERLAKSANA"
        : jurnalStatus === "TERKIRIM" && absensiIsi
          ? "LENGKAP"
          : jurnalStatus
            ? "JURNAL_TERISI"
            : absensiIsi
              ? "ABSENSI_TERISI"
              : "BELUM_DIMULAI";

      const pertemuan = await prisma.pertemuan.create({
        data: {
          jadwalId: jadwal.id,
          tanggal,
          pertemuanKe: ke,
          status,
          sumber: "OTOMATIS",
        },
      });

      if (absensiIsi) {
        await prisma.absensiItem.createMany({
          data: siswaKelas.map((s) => {
            const r = rnd();
            const statusAbs: StatusAbsensi = r < 0.86 ? "HADIR" : r < 0.9 ? "SAKIT" : r < 0.94 ? "IZIN" : r < 0.98 ? "TERLAMBAT" : "ALPA";
            return { pertemuanId: pertemuan.id, siswaId: s.id, status: statusAbs, catatan: statusAbs !== "HADIR" ? ambil(["Sakit", "Keperluan keluarga", "Terlambat karena hujan", "Izin dokter", "Keterlambatan angkutan"]) : null };
          }),
        });
      }

      if (jurnalStatus) {
        const materi = ambil(materiMapel(jadwal.mapelNama));
        const dibuat = new Date(tanggal);
        dibuat.setHours(rnd() < 0.7 ? 9 : 15, Math.floor(rnd() * 50), 0);
        const jurnal = await prisma.jurnal.create({
          data: {
            pertemuanId: pertemuan.id,
            materi,
            tujuan: `Siswa mampu memahami ${materi.toLowerCase()} dengan benar.`,
            kegiatan: `Membahas ${materi.toLowerCase()} melalui ${ambil(["ceramah interaktif", "diskusi kelompok", "praktik langsung"])}, dilanjutkan latihan soal.`,
            metode: ambil(METODE),
            media: ambil(MEDIA),
            hasil: `Sebagian besar siswa (${80 + Math.floor(rnd() * 15)}%) mampu menyelesaikan latihan dengan baik.`,
            kendala: rnd() < 0.5 ? ambil(["Beberapa siswa masih kesulitan memahami konsep dasar", "Waktu kurang karena perpanjangan diskusi", "Koneksi internet tidak stabil saat memutar video"]) : null,
            tindakLanjut: "Memberikan latihan tambahan pada pertemuan berikutnya dan mengadakan bimbingan bagi siswa yang belum tuntas.",
            status: jurnalStatus,
            dibuatPada: dibuat,
          },
        });
        // Riwayat perubahan untuk beberapa jurnal lama (audit trail)
        if (rnd() < 0.25 && jurnalStatus === "TERKIRIM") {
          await prisma.riwayatPerubahan.create({
            data: {
              entitas: "Jurnal",
              entitasId: jurnal.id,
              userId: null,
              perubahan: { aksi: "perbarui", sebelum: { materi: materi + " (revisi)" }, sesudah: { materi } },
            },
          });
        }
      }
    }
  }
  console.log(`   ${pertemuanCount} pertemuan dibuat`);

  // ---------- Pertemuan manual (guru pengganti / remedial) ----------
  console.log("📝 Pertemuan manual...");
  const manualTemplates = [
    { kelas: "9A", mapel: "Informatika", tanggal: "2026-07-24", alasan: "Pertemuan pengganti karena jadwal normal bertepatan dengan kegiatan madrasah" },
    { kelas: "9A", mapel: "Matematika", tanggal: "2026-08-01", alasan: "Jam tambahan persiapan lomba" },
  ];
  for (const mt of manualTemplates) {
    const jadwal = jadwalList.find((j) => {
      const kelas = kelasList.find((k) => k.nama === mt.kelas);
      return j.kelasId === kelas?.id && j.mapelNama === mt.mapel;
    });
    if (!jadwal) continue;
    const siswaKelas = siswaPerKelas.filter((s) => s.kelasId === jadwal.kelasId);
    const pertemuan = await prisma.pertemuan.create({
      data: {
        jadwalId: jadwal.id,
        tanggal: new Date(mt.tanggal),
        pertemuanKe: 99,
        status: "LENGKAP",
        sumber: "MANUAL",
        alasanManual: mt.alasan,
      },
    });
    await prisma.absensiItem.createMany({
      data: siswaKelas.map((s) => ({ pertemuanId: pertemuan.id, siswaId: s.id, status: rnd() < 0.9 ? "HADIR" : "IZIN" })),
    });
    await prisma.jurnal.create({
      data: {
        pertemuanId: pertemuan.id,
        materi: `Pertemuan tambahan: ${mt.alasan}`,
        tujuan: "Menyamakan pemahaman siswa terhadap materi sebelumnya.",
        kegiatan: "Pembahasan ulang dan latihan soal.",
        metode: "Tanya jawab",
        media: "Buku paket",
        hasil: "Siswa lebih siap menghadapi evaluasi.",
        status: "TERKIRIM",
      },
    });
  }

  // ---------- Penilaian ----------
  console.log("📊 Penilaian...");
  const jadwalInfo9A = jadwalList.find((j) => j.kelasId === kelasList.find((k) => k.nama === "9A")!.id && j.mapelNama === "Informatika")!;
  const siswa9A = siswaPerKelas.filter((s) => s.kelasId === kelasList.find((k) => k.nama === "9A")!.id);

  const kegiatan1 = await prisma.penilaianKegiatan.create({
    data: { jadwalId: jadwalInfo9A.id, jenis: "KUIS", judul: "Kuis Bab 1 — Berpikir Komputasional", tanggal: new Date("2026-07-28"), nilaiMaksimal: 100 },
  });
  const kegiatan2 = await prisma.penilaianKegiatan.create({
    data: { jadwalId: jadwalInfo9A.id, jenis: "TUGAS", judul: "Tugas 1 — Menyusun Algoritma Sederhana", tanggal: new Date("2026-08-01"), nilaiMaksimal: 100 },
  });
  await prisma.nilaiSiswa.createMany({
    data: siswa9A.map((s, idx) => ({
      kegiatanId: kegiatan1.id,
      siswaId: s.id,
      nilai: Math.round(55 + rnd() * 45),
      statusKumpul: rnd() < 0.9 ? "DIKUMPULKAN" : "BELUM",
    })),
  });
  await prisma.nilaiSiswa.createMany({
    data: siswa9A.map((s, idx) => ({
      kegiatanId: kegiatan2.id,
      siswaId: s.id,
      nilai: idx === 2 ? null : Math.round(50 + rnd() * 50),
      statusKumpul: idx === 2 ? "BELUM" : rnd() < 0.8 ? "DIKUMPULKAN" : "TERLAMBAT",
      catatan: idx === 2 ? "Belum mengumpulkan" : null,
    })),
  });

  // ---------- Pengguna non-guru ----------
  console.log("🔐 Akun pengguna...");
  const users = [
    { username: "superadmin", nama: "Super Admin Sistem", role: "SUPERADMIN" as const },
    { username: "admin", nama: "Admin Akademik", role: "ADMIN" as const },
    { username: "waka", nama: "Waka Kurikulum", role: "WAKA" as const },
    { username: "kamad", nama: "Kepala Madrasah", role: "KEPALA" as const },
  ];
  for (const u of users) {
    await prisma.user.create({
      data: { username: u.username, password: await bcrypt.hash(PASSWORD, 10), nama: u.nama, role: u.role },
    });
  }

  // ---------- Absensi harian kelas (alur guru jam pertama / piket) ----------
  console.log("📋 Absensi harian kelas...");
  // Demo beberapa hari terakhir (Senin–Kamis, 3–6 Agustus 2026). Tiap hari diisi
  // oleh guru jam pertama kelas = pemegang jadwal pada jam pembuka hari (jam
  // ke-1; Senin jam ke-2 karena upacara) — mis. Kamis 6 Agustus = Budi Santoso
  // (Informatika jam 1–2). Backup absensi memakai akun khusus `piket`
  // (jenisGuru PIKET). AbsensiItem (catatan pribadi per pertemuan) sengaja
  // dipertahankan terpisah sebagai Absensi Pribadi.
  const kelas9A = kelasList.find((k) => k.nama === "9A");
  if (kelas9A) {
    const siswa9A = siswaPerKelas.filter((s) => s.kelasId === kelas9A.id);
    const CATATAN: Partial<Record<StatusAbsensi, string>> = {
      SAKIT: "Sakit",
      IZIN: "Izin keperluan keluarga",
      TERLAMBAT: "Terlambat karena hujan",
    };
    // Hari demo (selain Minggu). Tanggal lain tanpa jadwal dilewati otomatis.
    const demoTanggal = ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06"];
    for (let h = 0; h < demoTanggal.length; h++) {
      const tanggal = new Date(demoTanggal[h]);
      const getDay = tanggal.getDay(); // 0 = Minggu .. 6 = Sabtu
      if (getDay === 0) continue;
      const hari = HARI_LIST[getDay - 1];
      // Guru jam pertama = jadwal kelas pada jam pembuka hari (jam ke-1;
      // Senin jam ke-2 karena upacara). Tanpa jadwal di jam itu → tidak ada
      // guru jam pertama hari itu (kelas dilewati; wali/piket jadi backup).
      const jamPertama = jadwalList.find(
        (j) => j.kelasId === kelas9A.id && j.hari === hari && j.jamMulai === jamPembukaHari(hari)
      );
      const pengisiId = jamPertama ? guruToUser.get(jamPertama.guruId) : undefined;
      if (!pengisiId) continue;
      await prisma.absensiHarian.create({
        data: {
          kelasId: kelas9A.id,
          tanggal,
          pengisiId,
          peranPengisi: "GURU_JAM_PERTAMA",
          item: {
            create: siswa9A.map((s, i) => {
              // Status deterministik yang bervariasi per hari (tanpa rnd(), agar
              // urutan acak data lain di seed tidak bergeser).
              const r = (i + h) % 11;
              const status: StatusAbsensi =
                r === 0 ? "SAKIT" : r === 3 ? "IZIN" : r === 5 ? "TERLAMBAT" : r === 7 ? "ALPA" : "HADIR";
              return { siswaId: s.id, status, catatan: CATATAN[status] ?? null };
            }),
          },
        },
      });
    }

    // Demo peran wali kelas: wali kelas 9A (Budi Santoso) mengisi langsung absensi
    // harian kelas yang diwalikannya — berhak mengubah meski bukan guru jam pertama.
    const wali9A = await prisma.kelas.findUnique({ where: { id: kelas9A.id }, select: { waliKelasId: true } });
    const waliUserId = wali9A?.waliKelasId ? guruToUser.get(wali9A.waliKelasId) : undefined;
    if (waliUserId) {
      // Cari tanggal berjalan yang punya jadwal & belum ada absensi hariannya.
      const cari = new Date("2026-07-20");
      const akhir = new Date("2026-08-06");
      for (let d = new Date(cari); d <= akhir; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === 0) continue; // skip Minggu
        const hari = HARI_LIST[d.getDay() - 1];
        const adaJadwal = jadwalList.some((j) => j.kelasId === kelas9A.id && j.hari === hari);
        if (!adaJadwal) continue;
        const sudah = await prisma.absensiHarian.findUnique({
          where: { kelasId_tanggal: { kelasId: kelas9A.id, tanggal: d } },
        });
        if (sudah) continue;
        await prisma.absensiHarian.create({
          data: {
            kelasId: kelas9A.id,
            tanggal: new Date(d),
            pengisiId: waliUserId,
            peranPengisi: "WALI_KELAS",
            item: {
              create: siswa9A.map((s) => ({
                siswaId: s.id,
                status: "HADIR",
                catatan: null,
              })),
            },
          },
        });
        break;
      }
    }
  }

  // ---------- Laporan bulanan (contoh alur verifikasi) ----------
  console.log("🗂️ Laporan bulanan...");
  const userWaka = await prisma.user.findUnique({ where: { username: "waka" } });
  const userKamad = await prisma.user.findUnique({ where: { username: "kamad" } });
  // Juli 2026: sudah diperiksa Waka & disetujui Kamad
  const statJuli = await (async () => {
    const start = new Date(2026, 6, 1);
    const end = new Date(2026, 6, 31, 23, 59, 59);
    const pertemuan = await prisma.pertemuan.findMany({ where: { tanggal: { gte: start, lte: end } }, include: { jadwal: { include: { guru: true } }, jurnal: true } });
    const aktif = pertemuan.filter((p) => p.status !== "TIDAK_TERLAKSANA");
    return guruList.map((g) => {
      const punya = aktif.filter((p) => p.jadwal?.guruId === g.id);
      const selesai = punya.filter((p) => p.status === "LENGKAP").length;
      return {
        guruId: g.id,
        nama: g.nama,
        total: punya.length,
        lengkap: selesai,
        persen: punya.length ? Math.round((selesai / punya.length) * 100) : 0,
        terverifikasi: rnd() < 0.7,
        catatan: rnd() < 0.4 ? "Sesuai dokumentasi" : "",
      };
    });
  })();
  await prisma.laporanBulanan.create({
    data: {
      bulan: "2026-07",
      status: "DISETUJUI",
      dibuatOlehId: userWaka?.id ?? null,
      diperiksaOlehId: userWaka?.id ?? null,
      disetujuiOlehId: userKamad?.id ?? null,
      catatanWaka: "Sampling verifikasi 2 guru — sebagian besar kelengkapan di atas 80%.",
      catatanKamad: "Disetujui. Lanjutkan pemantauan guru dengan kelengkapan di bawah 60%.",
      sampling: statJuli as unknown as object,
      diperiksaPada: new Date("2026-08-03T09:30:00"),
      disetujuiPada: new Date("2026-08-04T10:00:00"),
    },
  });
  // Agustus 2026: draft, menunggu sampling Waka
  await prisma.laporanBulanan.create({
    data: { bulan: "2026-08", status: "DRAFT", dibuatOlehId: userWaka?.id ?? null },
  });

  // ---------- Kalender akademik & pengaturan ----------
  console.log("📆 Kalender & pengaturan...");
  await prisma.kalenderAkademik.createMany({
    data: [
      { tanggal: new Date("2026-07-20"), keterangan: "Awal tahun pelajaran 2025/2026", tipe: "KEGIATAN", tahunAjaranId: ta.id },
      { tanggal: new Date("2026-08-01"), keterangan: "Libur Tahun Baru Hijriah 1447 H", tipe: "LIBUR", tahunAjaranId: ta.id },
      { tanggal: new Date("2026-09-04"), keterangan: "Maulid Nabi Muhammad SAW", tipe: "LIBUR", tahunAjaranId: ta.id },
      { tanggal: new Date("2026-09-21"), keterangan: "PTS Ganjil", tipe: "UJIAN", tahunAjaranId: ta.id },
      { tanggal: new Date("2026-10-26"), keterangan: "PTS Ganjil susulan", tipe: "UJIAN", tahunAjaranId: ta.id },
    ],
  });
  const settings = [
    { key: "nama_aplikasi", value: "Sistem Administrasi Guru" },
    { key: "nama_sekolah", value: "MTs Negeri 2 Kebumen" },
    { key: "jam_sekolah_selesai", value: "15:00" },
    { key: "batas_laporan_bulanan", value: "5" },
  ];
  await prisma.setting.createMany({ data: settings });

  console.log("\n✅ Seed selesai!");
  console.log(`   • ${guruList.length} guru, ${siswaPerKelas.length} siswa, ${kelasList.length} kelas, ${mapelList.length} mapel`);
  console.log(`   • ${jadwalList.length} jadwal, ${pertemuanCount} pertemuan, kegiatan penilaian`);
  console.log("\n🔑 Akun demo (password: password123):");
  console.log("   superadmin / admin / waka / kamad");
  console.log("   guru1 (Budi Santoso — wali kelas 9A), guru2 (Siti Aminah), guru3 (Rina Marlina — guru BK)");
  console.log("   piket (Petugas Piket — akun khusus semua petugas piket)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
