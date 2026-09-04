# Sistem Administrasi Guru — MTsN 2 Kebumen

Sistem Administrasi Pembelajaran Guru: **Jurnal • Absensi • Penilaian** — terintegrasi dengan jadwal mengajar. Dibangun di sekitar satu entitas inti: **Pertemuan** (jadwal + tanggal). Dari satu jadwal, guru membuka absensi, jurnal, dan nilai tanpa mengulang input kelas/mapel/tanggal/jam.

Blueprint lengkap: [`blueprint-sistem-administrasi-guru.md`](./blueprint-sistem-administrasi-guru.md).

## Tech Stack

| Layer | Teknologi |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| ORM | Prisma (MySQL/MariaDB) |
| Auth | NextAuth (credentials, role-based: GURU / WAKA / ADMIN / SUPERADMIN / KEPALA) |
| Notifikasi | Web Push (PWA) + WhatsApp (gateway Fonnte) |
| Ekspor/Import | exceljs (Excel) |
| PWA | manifest.json + service worker + installable |

## Menjalankan (Development)

```bash
npm install
cp .env.example .env        # isi DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET
npx prisma migrate dev      # buat schema DB (dev only)
npx prisma db seed          # data demo (2 guru, 10 siswa / 1 kelas, jadwal, pertemuan)
npm run dev                 # http://localhost:3000
```

Akun demo (password: `password123`): `superadmin`, `admin`, `waka`, `kamad`, `guru1` (Budi — wali kelas 9A), `guru2` (Siti), `guru3` (Rina — guru BK), dan `piket` (Petugas Piket — akun khusus).

## Deployment Production

### Persyaratan

- Node.js 20+ (sesuai field `engines` di `package.json`)
- MySQL 8+ atau MariaDB 10+
- Environment variable — lihat `.env.example` untuk daftar wajib & opsional.

Variabel wajib: `DATABASE_URL` (mysql://), `NEXTAUTH_URL` (URL publik **HTTPS** — production menolak localhost dan semua URL non-HTTPS), `NEXTAUTH_SECRET` (≥32 karakter acak). Opsional: `PUSH_CRON_SECRET`, `VAPID_*`, `WA_TOKEN`, `BK_APP_URL`.

### Instalasi Production

```bash
npm ci
npx prisma generate
npx prisma migrate deploy          # JANGAN migrate dev / db push / reset di production
npm run check:env:production       # validasi env (menolak localhost untuk NEXTAUTH_URL)
npm run build
npm run start                      # default port 3000
```

### Aturan Database

- **Backup sebelum migration**: `mysqldump --no-tablespaces -u USER -p NAMA_DB > backups/sistem_guru_$(date +%Y%m%d_%H%M%S).sql` — simpan di `backups/` (sudah di-`.gitignore`, tidak bisa di-download publik).
- Gunakan **`npx prisma migrate deploy`** untuk menerapkan migration yang sudah ada.
- **Jangan** menjalankan `prisma migrate reset`, `prisma db push`, atau `prisma db seed` pada database production / demo berisi data.
- Jika migration gagal: **restore backup** terakhir, perbaiki migration, lalu `migrate deploy` ulang. Jangan edit `_prisma_migrations` manual.

### Demo Lokal / LAN

1. Atur `NEXTAUTH_URL` ke alamat yang akan dibuka browser:
   - Lokal saja: `http://localhost:3000`
   - LAN (perangkat lain): `http://192.168.1.XX:3000` — ganti dengan IP host yang menjalankan server.
2. Build & jalankan production:
   ```bash
   npm run check:env          # harus OK (localhost masih boleh untuk demo LAN)
   npm run build && npm run start -- -H 0.0.0.0 -p 3000
   ```
   Flag `-H 0.0.0.0` agar dapat diakses dari perangkat lain di jaringan yang sama.
3. Perangkat lain harus dapat menjangkau host & port (firewall, bukan NAT publik).
4. Jangan membuka database langsung ke jaringan publik — hanya Next.js yang perlu terekspos.

### Checklist Setelah Deployment

- [ ] `GET /api/health` → `{"status":"ok"}` (200) — jika 503, cek koneksi DB.
- [ ] Login Admin (`admin`) — buka Data Guru, Hak Akses, import preview.
- [ ] Login Guru (`guru1`) — lihat jadwal, jurnal, absensi, nilai.
- [ ] Login Waka (`waka`) — pemantauan, laporan bulanan, absensi harian.
- [ ] Login Kamad (`kamad`) — ringkasan, persetujuan laporan.
- [ ] Import preview (jangan simpan) — pastikan validasi jadwal berjalan.
- [ ] Uji akses role — guru tidak bisa buka `/admin`, waka tidak bisa kelola jadwal.
- [ ] Logout & session — JWT lama tidak bisa dipakai setelah akun dinonaktifkan.

### Fitur Opsional

| Fitur | Env / Setting | Jika tidak diisi |
|---|---|---|
| Push Notification (PWA) | `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` | Auto-generate di tabel `Setting`, tetap jalan tanpa konfigurasi. |
| WhatsApp (Fonnte) | `WA_TOKEN` atau Setting `wa_token` + `wa_aktif` | Dinonaktifkan — UI tetap ada, kirim akan mengembalikan pesan konfigurasi. |
| Cron pengingat | `PUSH_CRON_SECRET` + jadwal `GET /api/push/reminder` & `/api/wa/reminder` | Hanya bisa dipicu manual via UI admin (pakai sesi). |
| Aplikasi BK | `BK_APP_URL` | Halaman `/bk` menampilkan pesan tautan belum dikonfigurasi. |
| Sync pertemuan | `PUSH_CRON_SECRET` + `GET /api/sync/pertemuan` | Backfill tetap jalan otomatis saat halaman dipanggil. |

Jadwal cron contoh (setiap hari setelah jam sekolah):
```
GET /api/push/reminder
GET /api/wa/reminder
Authorization: Bearer <PUSH_CRON_SECRET>
```

### Penyimpanan Dokumentasi Jurnal

Saat ini file dokumentasi jurnal disimpan di `public/uploads/` (disk lokal server). Cocok hanya untuk server dengan disk persisten (VPS, on-premise). Belum cocok untuk filesystem sementara seperti serverless / ephemeral container — file akan hilang saat redeploy. Perbaikannya (object storage / volume persisten) akan dikerjakan di tahap lain; jangan andalkan `public/uploads` untuk deployment tanpa disk persisten.

## Environment Variable

Lihat `.env.example` untuk template lengkap dengan komentar Bahasa Indonesia. Ringkasnya:

- **Wajib utama**: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- **Wajib hanya production**: `NEXTAUTH_URL` harus URL HTTPS publik (bukan localhost) — divalidasi `npm run check:env:production`.
- **Opsional fitur**: `PUSH_CRON_SECRET`, `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` (berpasangan), `WA_TOKEN`, `BK_APP_URL`
- **Otomatis runtime**: `NODE_ENV` (diisi Next.js)

Validasi lokal: `npm run check:env` dan `npm run check:env:production` — tidak pernah mencetak nilai secret.

## Fitur

### Guru
- **Beranda**: jadwal hari ini, ringkasan kelengkapan bulan ini, jurnal tertinggal, grafik tren kelengkapan 6 minggu
- **Wali Kelas** (jenis guru diatur di Data Guru): bebas mengisi & mengubah **Absensi Harian** kelas yang diwalikannya — muncul sebagai seksi "Kelas Wali Anda" di menu Absensi Harian
- **Guru BK** (jenis guru diatur di Data Guru): halaman khusus Bimbingan Konseling — jadwal konseling per kelas, rekap kehadiran per kelas, dan siswa perlu perhatian
- **Jadwal → Pertemuan**: buka absensi, jurnal, dan nilai dari satu pertemuan (auto-fill guru/kelas/mapel/jam)
- **Jurnal**: otomatis dari jadwal, manual (wajib alasan), salin jurnal sebelumnya, isi terlambat
- **Absensi Pribadi**: catatan kehadiran per pertemuan yang guru isi opsional (tab Absensi saat melengkapi jurnal) — data pribadi guru, terpisah dari absensi harian resmi
- **Absensi Harian**: kehadiran resmi kelas per hari — diisi guru jam pertama (utama); wali kelas & guru piket boleh mengisi/mengoreksi. 6 status (Hadir/Sakit/Izin/Alpa/Terlambat/Dispensasi)
- **Nilai**: kegiatan penilaian (Tugas/Kuis/Ulangan Harian/PTS/PAS/dll), tabel nilai per siswa, status kumpul
- **Laporan**: filter bulan, ekspor Excel
- **Profil**: aktivasi notifikasi web push

### Admin / Super Admin
- Data master: guru (termasuk No. WhatsApp & **jenis guru**: biasa / piket / wali kelas / BK), siswa, kelas, mapel, jadwal, tahun ajaran/semester, kalender akademik
- **Akun khusus Petugas Piket** (`piket`, jenis guru PIKET dengan kode `PIKET`): satu akun yang dipakai bergantian semua petugas piket, menu ringkas hanya untuk mengisi absensi harian sebagai backup guru jam pertama
- **Import Excel**: data siswa & jadwal massal (`/admin/import`, dengan template yang bisa diunduh)
- **Notifikasi**: panel Web Push (statistik perangkat, uji coba) & WhatsApp (Fonnte) di Pengaturan Sistem
- Hak akses user, riwayat perubahan (audit trail), pengaturan sistem, soft delete + restore

### Waka Kurikulum
- Beranda pemantauan: tren kelengkapan jurnal (grafik bar 6 minggu), distribusi status pertemuan (donut), kelengkapan per guru, guru butuh pendampingan (<60%), daftar jurnal kosong
- **Absensi Harian** (pemantauan): donut status per kelas (Guru Jam 1 / Wali Kelas / Guru Piket / Belum Diisi), tren 14 hari, rincian per kelas
- **Laporan Bulanan**: buat laporan per bulan, sampling verifikasi per guru (centang + catatan), tandai "Sudah Diperiksa"

### Kepala Madrasah
- Ringkasan: statistik guru/siswa, status administrasi pertemuan (donut), distribusi kehadiran siswa, kelas absensi terbanyak, guru butuh pendampingan (read-only)
- **Persetujuan Laporan**: setujui laporan bulanan yang sudah diperiksa Waka, atau kembalikan untuk revisi
- **Absensi Harian** (pemantauan): grafik kelengkapan absensi harian per kelas

## Notifikasi WhatsApp (Fonnte)

1. Daftar di [fonnte.com](https://fonnte.com), buat **Device**, salin **token**.
2. Isi token di **Admin → Pengaturan Sistem → Notifikasi WhatsApp** (atau env `WA_TOKEN`), centang aktifkan.
3. Pastikan **No. WhatsApp** terisi di **Data Guru**.
4. Uji kirim lewat tombol **"Uji Coba ke Akun Ini"** atau jalankan pengingat manual.
5. Jadwalkan cron harian setelah jam sekolah (setelan `jam_sekolah_selesai`):
   ```
   GET /api/wa/reminder
   Authorization: Bearer <PUSH_CRON_SECRET>
   ```
   Satu jadwal yang sama juga bisa memanggil `GET /api/push/reminder` untuk Web Push.

## Laporan Bulanan (Verifikasi Waka → Persetujuan Kamad)

Alur di halaman **Laporan Bulanan** (menu Waka & Kamad):
1. **Konsep** — Waka membuka bulan mengajar dan membuat laporan (statistik dihitung live dari pertemuan).
2. **Sampling Verifikasi** — Waka mencentang sejumlah guru untuk di-sampling (wajib minimal 1), menulis catatan, lalu menyimpan → status **Sudah Diperiksa**.
3. **Persetujuan** — Kepala Madrasah meninjau (catatan Waka, sampling, statistik) lalu **Setujui** → status **Disetujui**, atau kembalikan ke Konsep bila perlu revisi.

Hasil sampling tersimpan sebagai audit (siapa & kapan). Laporan yang sudah disetujui tidak bisa diubah Waka tanpa dibuka ulang oleh Kamad/Admin.

## Import Excel

- Halaman **Admin → Import Excel** (`/admin/import`), unduh template, isi, upload. **Data Guru** juga bisa diimport langsung dari halaman Data Guru (`/admin/guru`).
- **Guru + Akun** (di halaman Data Guru): template 9 kolom `NAMA | KODE | NIP | WHATSAPP | USERNAME | PASSWORD AWAL | PERAN AKUN | AKUN AKTIF | WAJIB GANTI PASSWORD` — patokan sinkron = **Kode**. Empat kolom lama (`NAMA | KODE | NIP | WHATSAPP`) tetap didukung.
  - **Akun baru dibuat otomatis** untuk setiap Guru yang belum punya akun (default: peran `GURU`, aktif `YA`, wajib ganti password `TIDAK`).
  - **USERNAME/PASSWORD kosong dibuat otomatis**: username dari KODE, password acak kuat (CSPRNG). USERNAME eksplisit harus format valid (3–30, huruf kecil/angka/`. _ -`); PASSWORD AWAL eksplisit minimal 6 karakter.
  - **Import ulang tidak mereset akun lama**: tidak membuat akun kedua, tidak mengganti password/role/status; hanya nama yang boleh disinkronkan bila NAMA berubah.
  - **Kredensial hanya bisa diunduh SEKALI** oleh admin yang melakukan import (token kedaluwarsa 10 menit, terikat pemiliknya, tidak bisa diakses admin lain).
  - Seluruh baris divalidasi **sebelum** ada penulisan: NAMA & KODE wajib (format kode `huruf+1–3 angka`), KODE & NIP tidak boleh ganda dalam file, NIP yang sudah dipakai Guru lain dilaporkan, `PERAN AKUN` hanya GURU/WAKA, `AKUN AKTIF` & `WAJIB GANTI PASSWORD` hanya kosong/YA/TIDAK (nilai asing seperti `YES`/`AKTIF` ditolak). Ada baris invalid → import dibatalkan, tidak ada data setengah jadi.
  - Setiap baris dieksekusi dalam **satu transaksi** (Guru + akun bersama): gagal membuat akun mengembalikan juga Guru baris tersebut.
- **Siswa**: kolom `NISN | NIS | NAMA | KELAS` — kunci sinkron = **NISN** (10 digit). NISN cocok → data diperbarui (kolom kosong dipertahankan, siswa nonaktif dipulihkan); NISN berbeda tapi nama sama → masuk daftar **konflik** yang butuh konfirmasi admin untuk memperbarui/replace data lama; NISN & nama belum ada → dibuat otomatis. Selalu ada pratinjau sebelum disimpan. Kelas harus sudah dibuat.
- **Jadwal** (format resmi): kolom `GURU | KODE | HARI | JAM KE | WAKTU | MAPEL/KEGIATAN | KELAS` — satu baris = satu jam pelajaran. Wajib pilih **tahun ajaran & periode tujuan**; ada pratinjau sebelum disimpan.
- Sinkronisasi jadwal berpatokan **Kode Guru** (mis. `K5`) — nama hanya untuk tampilan. Guru baru dibuat otomatis berdasarkan kode; **data master guru yang sudah ada tidak diubah** (yang dibuat hanya jadwalnya). Mapel & kelas yang belum ada dibuat; baris **Wali Kelas** mengisi wali kelas rombel di menu Kelas.
- Format lama `Akhmadi, S.Pd. (K5)` dalam satu kolom (tanpa kolom Kode) tetap didukung otomatis.
- Cegah bentrok jam pada kelas yang sama otomatis; baris tidak valid dilewati dan dilaporkan di hasil import.

### Batasan penyimpanan kredensial import

File kredensial (password polos akun baru) disimpan **di memori server** (tanpa Redis/object storage):

- Hanya cocok untuk deployment **satu instance**; token tidak tersedia lintas instance/serverless.
- Token **hilang bila server restart** — ulangi import untuk mendapat kredensial baru.
- Token sekali pakai, kedaluwarsa 10 menit, terikat ke admin pembuat import; respons untuk token asing/kedaluwarsa generik (tidak membocorkan keberadaan token).
- Pada tahap storage berikutnya (multi-instance), ganti dengan shared temporary store.

## Struktur Folder

```
app/(app)/       halaman utama (beranda, jadwal, jurnal, absensi, nilai, laporan, profil, admin, waka, kamad)
app/api/         route handlers: auth, export, import(+template), push/*, wa/reminder
components/      UI shell, form jurnal/absensi/nilai, grafik (charts.tsx), panel notifikasi
lib/             prisma, auth, session, push (web-push), wa (Fonnte), actions server
prisma/          schema + migrasi + seed
```

## Catatan Teknis

- `Pertemuan` dibuat otomatis saat hari mengajar tiba (`lib/pertemuan.ts`), unik per jadwal+tanggal.
- Status pertemuan dihitung dari kelengkapan absensi + jurnal; nilai tidak jadi syarat.
- Perubahan jurnal tercatat di `RiwayatPerubahan` (audit trail).
- Wali kelas per periode tersimpan di `WaliKelasRiwayat` — tercatat otomatis saat wali kelas diubah di menu Kelas atau saat import jadwal.
- **Absensi Harian** (`AbsensiHarian`) = satu data kehadiran resmi per kelas per hari, diisi guru jam pertama (utama). Wali kelas & guru piket menjadi backup yang boleh mengisi/mengoreksi — peran pengisi tercatat (`GURU_JAM_PERTAMA` / `WALI_KELAS` / `GURU_PIKET`).
- **Absensi Pribadi** (`/absensi`) = catatan per pertemuan yang guru isi opsional saat melengkapi jurnal (`AbsensiItem`) — terpisah dari absensi harian resmi.
- Grafik dashboard memakai SVG murni (`components/charts.tsx`) — tanpa library chart eksternal.
