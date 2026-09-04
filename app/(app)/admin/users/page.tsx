import Link from "next/link";
import { KeyRound, Plus, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, ErrorBanner, PageHeader, SuksesBanner, TableRow, TableShell, Td, Th } from "@/components/ui";
import { formHapusUser } from "@/lib/actions/admin-forms";
import { FormUser } from "@/components/admin/form-user";
import { TombolHapus } from "@/components/tombol-hapus";
import { ROLE_BADGE, ROLE_LABEL } from "@/lib/constants";
import { PanelPermintaanPassword } from "@/components/admin/panel-permintaan-password";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({ searchParams }: { searchParams: { sukses?: string; error?: string; edit?: string; guru?: string } }) {
  const me = await getCurrentUser();
  const [users, guruList, permintaanPending] = await Promise.all([
    prisma.user.findMany({ include: { guru: true }, orderBy: [{ role: "asc" }, { username: "asc" }] }),
    prisma.guru.findMany({ include: { user: { select: { id: true, username: true, role: true, aktif: true } } }, orderBy: { nama: "asc" } }),
    prisma.passwordChangeRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const edit = searchParams.edit ? users.find((u) => u.id === searchParams.edit) : null;
  const guruAwal = searchParams.guru && !edit ? searchParams.guru : "";
  const guruTerpakai = new Set(users.filter((u) => u.guruId).map((u) => u.guruId!));

  const pendingItems = permintaanPending
    .map((r) => {
      const u = users.find((x) => x.id === r.userId);
      return u
        ? {
            id: r.id,
            userId: r.userId,
            nama: u.nama,
            username: u.username,
            role: ROLE_LABEL[u.role],
            createdAt: r.createdAt.toISOString(),
          }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div className="fade-up">
      <PageHeader title="Hak Akses Pengguna" subtitle={`${users.length} akun pengguna`} icon={<ShieldCheck className="h-6 w-6" />} />
      <SuksesBanner message={searchParams.sukses} />
      <ErrorBanner message={searchParams.error} />

      <Card className="card-pad mb-6">
        <h3 className="mb-4 flex items-center gap-2 font-extrabold text-slate-900">
          <Plus className="h-4 w-4 text-emerald-600" /> {edit ? `Ubah: ${edit.username}` : "Tambah Akun"}
        </h3>
        <FormUser
          edit={edit ? { id: edit.id, username: edit.username, nama: edit.nama, role: edit.role, guruId: edit.guruId, aktif: edit.aktif, wajibGantiPassword: edit.wajibGantiPassword } : null}
          guruAwal={guruAwal}
          guruList={guruList.map((g) => ({ id: g.id, nama: g.nama, status: g.status }))}
          guruTerpakai={guruTerpakai}
        />
      </Card>

      <Card className="card-pad mb-6">
        <h3 className="mb-1 flex items-center gap-2 font-extrabold text-slate-900">
          <KeyRound className="h-4 w-4 text-amber-600" /> Permintaan Ganti Password
        </h3>
        <p className="mb-3 text-sm text-slate-500">
          {pendingItems.length > 0
            ? `${pendingItems.length} permintaan menunggu konfirmasi. Setujui untuk mengganti password, atau tolak untuk membatalkan.`
            : "Pengguna yang mengajukan ganti password melalui halaman Profil akan tampil di sini."}
        </p>
        <PanelPermintaanPassword pending={pendingItems} />
      </Card>

      <TableShell>
        <thead>
          <tr>
            <Th>Username</Th>
            <Th>Nama</Th>
            <Th>Peran</Th>
            <Th>Terhubung Guru</Th>
            <Th>Status</Th>
            <Th className="text-right">Aksi</Th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <Td className="font-bold text-slate-900">@{u.username}</Td>
              <Td>{u.nama}</Td>
              <Td><span className={`chip ${ROLE_BADGE[u.role]}`}>{ROLE_LABEL[u.role]}</span></Td>
              <Td>{u.guru?.nama ?? "-"}</Td>
              <Td>{u.aktif ? <span className="chip bg-emerald-100 text-emerald-700">Aktif</span> : <span className="chip bg-slate-200 text-slate-500">Nonaktif</span>}</Td>
              <Td className="text-right">
                <div className="flex justify-end gap-2">
                  <Link href={`/admin/users?edit=${u.id}`} className="btn-ghost btn-sm !px-2.5 text-emerald-700">Ubah</Link>
                  {u.id !== me?.id && (
                    <TombolHapus action={formHapusUser} id={u.id} pesan={`Hapus akun @${u.username}?`} />
                  )}
                </div>
              </Td>
            </TableRow>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
}
