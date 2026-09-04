import Link from "next/link";
import { CalendarDays, Copy, Plus, RotateCcw } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, ErrorBanner, PageHeader, SuksesBanner } from "@/components/ui";
import { formJadwal } from "@/lib/actions/admin-forms";
import { SelectNavigasi } from "@/components/select-navigasi";
import { PilihJam } from "@/components/pilih-jam";
import { TabelJadwalAdmin, type BarisJadwalAdmin } from "@/components/admin/tabel-jadwal-admin";
import { SalinJadwal, type OpsiSemester } from "@/components/admin/salin-jadwal";
import { apakahJamUpacara, HARI, HARI_LABEL, rentangJam } from "@/lib/constants";
import { cariSemesterAktif } from "@/lib/semester";

export const dynamic = "force-dynamic";

export default async function AdminJadwalPage({
  searchParams,
}: {
  searchParams: {
    sukses?: string;
    error?: string;
    edit?: string;
    guru?: string;
    kelas?: string;
    mapel?: string;
    hari?: string;
    semester?: string;
  };
}) {
  const user = await getCurrentUser();

  // Sinkronkan & dapatkan semester yang sedang berlaku (bisa berpindah otomatis sesuai tanggal)
  const semesterAktif = await cariSemesterAktif();
  const [semesterList, guruList, kelasList, mapelList] = await Promise.all([
    prisma.semester.findMany({
      where: { deletedAt: null },
      include: { tahunAjaran: true, _count: { select: { jadwal: true } } },
      orderBy: [{ tahunAjaran: { nama: "desc" } }, { nama: "asc" }],
    }),
    prisma.guru.findMany({ where: { status: true, deletedAt: null }, orderBy: { nama: "asc" } }),
    prisma.kelas.findMany({ orderBy: [{ tingkat: "asc" }, { nama: "asc" }] }),
    prisma.mataPelajaran.findMany({ orderBy: { nama: "asc" } }),
  ]);

  // ===== Filter berbasis URL =====
  const HARI_TERSEDIA = new Set<string>(HARI);
  const where: Record<string, unknown> = {};
  if (searchParams.guru && searchParams.guru !== "semua") where.guruId = searchParams.guru;
  if (searchParams.kelas && searchParams.kelas !== "semua") where.kelasId = searchParams.kelas;
  if (searchParams.mapel && searchParams.mapel !== "semua") where.mapelId = searchParams.mapel;
  // Hari adalah enum DB — nilai asing dari URL (mis. ?hari=XYZ) bisa memicu
  // error 500; nilai tak dikenal diperlakukan sama dengan "semua".
  const hariValid =
    searchParams.hari !== undefined && searchParams.hari !== "semua" && HARI_TERSEDIA.has(searchParams.hari);
  if (hariValid) where.hari = searchParams.hari;

  const semesterTerpilih = searchParams.semester ?? "aktif"; // "aktif" | "semua" | id
  // Ruang lingkup semester yang sah: aktif, satu semester tertentu, atau semua
  // semester yang belum diarsipkan (deletedAt null) — konsisten dengan daftar
  // pilihan periode di UI (semester terarsip tidak bisa dipilih).
  const scopeSemester: Record<string, unknown> =
    semesterTerpilih === "aktif"
      ? semesterAktif
        ? { semesterId: semesterAktif.id }
        : { semester: { deletedAt: null } }
      : semesterTerpilih === "semua"
        ? { semester: { deletedAt: null } }
        : { semesterId: semesterTerpilih };
  Object.assign(where, scopeSemester);

  // Reset hanya tampil untuk filter eksplisit (filter semester default "aktif" bukan filter)
  const filterAktif =
    (searchParams.guru !== undefined && searchParams.guru !== "semua") ||
    (searchParams.kelas !== undefined && searchParams.kelas !== "semua") ||
    (searchParams.mapel !== undefined && searchParams.mapel !== "semua") ||
    hariValid ||
    (semesterTerpilih !== "aktif");

  const [jadwalList, totalJadwal] = await Promise.all([
    prisma.jadwal.findMany({
      where,
      include: {
        guru: true,
        kelas: true,
        mapel: true,
        semester: { include: { tahunAjaran: true } },
        _count: { select: { pertemuan: true, kegiatan: true } },
      },
      orderBy: [{ hari: "asc" }, { jamKeMulai: "asc" }],
    }),
    // Total dalam lingkup semester yang sama (tanpa filter guru/kelas/mapel/hari)
    // — dipakai teks bantu "dari N total" agar angkanya konsisten dengan daftar.
    prisma.jadwal.count({ where: scopeSemester }),
  ]);
  const edit = searchParams.edit ? jadwalList.find((j) => j.id === searchParams.edit) : null;

  const baris: BarisJadwalAdmin[] = jadwalList.map((j) => ({
    id: j.id,
    semester: `${j.semester.nama} ${j.semester.tahunAjaran.nama}`,
    hariLabel: HARI_LABEL[j.hari],
    jamKeMulai: j.jamKeMulai,
    jamKeSelesai: j.jamKeSelesai,
    rentang: rentangJam(j.hari, j.jamKeMulai, j.jamKeSelesai),
    mapel: j.mapel.nama,
    kelas: j.kelas.nama,
    guru: j.guru.nama.split(",")[0],
    punyaRiwayat: j._count.pertemuan > 0 || j._count.kegiatan > 0,
    upacara: apakahJamUpacara(j.hari, j.jamKeMulai),
  }));

  const opsiSemester: OpsiSemester[] = semesterList.map((s) => ({
    id: s.id,
    nama: s.nama,
    tahunAjaran: s.tahunAjaran.nama,
    aktif: s.aktif,
    jumlahJadwal: s._count.jadwal,
  }));
  // Saat mengubah jadwal milik guru yang sudah dinonaktifkan/soft-delete, guru
  // tsb tidak ada di daftar pilihan aktif. Tanpa opsi itu, browser otomatis
  // memilih guru PERTAMA di daftar saat disimpan — jadwal bisa pindah guru
  // diam-diam. Opsi guru lama ditambahkan kembali (bertanda nonaktif) agar
  // menyimpan tanpa mengganti guru tetap mempertahankan gurunya.
  const guruAktifIds = new Set(guruList.map((g) => g.id));
  const guruEdit = edit && edit.guru && !guruAktifIds.has(edit.guru.id) ? edit.guru : null;
  const guruOpsi = guruEdit ? [guruEdit, ...guruList] : guruList;
  const semesterObj = semesterList.find((s) => s.id === semesterTerpilih);
  const labelSemesterTerpilih =
    semesterTerpilih === "semua"
      ? "Semua semester"
      : semesterObj
        ? `${semesterObj.nama} — ${semesterObj.tahunAjaran.nama}`
        : semesterAktif
          ? `${semesterAktif.nama} — ${semesterAktif.tahunAjaran.nama} (aktif)`
          : "Semester aktif";

  return (
    <div className="fade-up">
      <PageHeader
        title="Jadwal Pelajaran"
        subtitle={
          filterAktif
            ? `${jadwalList.length} slot cocok dengan filter (${labelSemesterTerpilih}, dari ${totalJadwal} total)`
            : `${totalJadwal} slot jadwal · periode: ${labelSemesterTerpilih}`
        }
        icon={<CalendarDays className="h-6 w-6" />}
      />
      <SuksesBanner message={searchParams.sukses} />
      <ErrorBanner message={searchParams.error} />

      <Card className="card-pad mb-6">
        <h3 className="mb-4 flex items-center gap-2 font-extrabold text-slate-900">
          <Plus className="h-4 w-4 text-emerald-600" /> {edit ? "Ubah Jadwal" : "Tambah Jadwal"}
        </h3>
        {/* key = id baris yang diedit: memastikan form di-remount saat pindah dari satu baris "Ubah" ke baris lain (navigasi client-side) sehingga nilai default tidak basi dari baris sebelumnya. */}
        <form action={formJadwal} key={edit?.id ?? "baru"} className="grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="id" value={edit?.id ?? ""} />
          <div>
            <label className="label">Guru *</label>
            <select className="input" name="guruId" defaultValue={edit?.guruId ?? ""} required>
              <option value="">— pilih —</option>
              {guruOpsi.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nama}
                  {guruEdit && g.id === guruEdit.id ? " (nonaktif)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Kelas *</label>
            <select className="input" name="kelasId" defaultValue={edit?.kelasId ?? ""} required>
              <option value="">— pilih —</option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.id}>{k.nama}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Mata Pelajaran *</label>
            <select className="input" name="mapelId" defaultValue={edit?.mapelId ?? ""} required>
              <option value="">— pilih —</option>
              {mapelList.map((m) => (
                <option key={m.id} value={m.id}>{m.nama}</option>
              ))}
            </select>
          </div>
          <PilihJam
            hariAwal={edit?.hari}
            jamMulaiAwal={edit?.jamKeMulai}
            jamSelesaiAwal={edit?.jamKeSelesai}
          />
          <div className="sm:col-span-3">
            <button className="btn-primary">Simpan</button>
            {edit && <Link href="/admin/jadwal" className="btn-ghost ml-2">Batal</Link>}
          </div>
        </form>
      </Card>

      {/* ===== Salin jadwal antar periode (pergantian jadwal berkala) ===== */}
      <Card className="card-pad mb-6">
        <h3 className="mb-1 flex items-center gap-2 font-extrabold text-slate-900">
          <Copy className="h-4 w-4 text-blue-600" /> Salin Jadwal ke Periode Baru
        </h3>
        <p className="mb-4 text-sm text-slate-500">
          Saat pergantian jadwal: buat periode baru (Admin → Tahun Ajaran & Semester), set aktif, lalu salin seluruh
          jadwal periode lama ke periode baru — tinggal ubah slot yang berubah. Riwayat pertemuan periode lama tetap aman.
        </p>
        <SalinJadwal semesterList={opsiSemester} />
      </Card>

      {/* ===== Filter — single-column on mobile, stacked full-width */}
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="label">Semester / Periode</label>
          <SelectNavigasi
            param="semester"
            value={semesterTerpilih}
            options={[
              {
                value: "aktif",
                label: semesterAktif ? `${semesterAktif.nama} — ${semesterAktif.tahunAjaran.nama} (aktif)` : "Semester aktif",
              },
              { value: "semua", label: "Semua semester" },
              ...semesterList.map((s) => ({ value: s.id, label: `${s.nama} — ${s.tahunAjaran.nama}` })),
            ]}
          />
        </div>
        <div className="min-w-0 flex-1">
          <label className="label">Guru</label>
          <SelectNavigasi
            param="guru"
            value={searchParams.guru ?? "semua"}
            options={[{ value: "semua", label: "Semua guru" }, ...guruList.map((g) => ({ value: g.id, label: g.nama }))]}
          />
        </div>
        <div className="min-w-0 flex-1">
          <label className="label">Kelas</label>
          <SelectNavigasi
            param="kelas"
            value={searchParams.kelas ?? "semua"}
            options={[{ value: "semua", label: "Semua kelas" }, ...kelasList.map((k) => ({ value: k.id, label: k.nama }))]}
          />
        </div>
        <div className="min-w-0 flex-1">
          <label className="label">Mata Pelajaran</label>
          <SelectNavigasi
            param="mapel"
            value={searchParams.mapel ?? "semua"}
            options={[{ value: "semua", label: "Semua mapel" }, ...mapelList.map((m) => ({ value: m.id, label: m.nama }))]}
          />
        </div>
        <div className="min-w-0 flex-1">
          <label className="label">Hari</label>
          <SelectNavigasi
            param="hari"
            value={searchParams.hari ?? "semua"}
            options={[{ value: "semua", label: "Semua hari" }, ...HARI.map((h) => ({ value: h, label: HARI_LABEL[h] }))]}
          />
        </div>
        {filterAktif && (
          <Link href="/admin/jadwal" className="btn-ghost btn-sm min-h-11 w-full sm:w-auto">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Link>
        )}
      </div>

      {/* ===== Tabel + aksi masal ===== */}
      <TabelJadwalAdmin jadwal={baris} filterAktif={filterAktif} semesterParam={semesterTerpilih} role={user?.role ?? null} />
    </div>
  );
}
