import { History } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { EmptyState, PageHeader, TableRow, TableShell, Td, Th } from "@/components/ui";
import { formatJam } from "@/lib/utils";
import { labelFieldJurnal } from "@/lib/audit-jurnal";

export const dynamic = "force-dynamic";

/** Format JSON legacy → tampilan ramah. Tidak mengubah isi audit lama. */
function bacaPerubahan(raw: unknown) {
  if (Array.isArray(raw)) {
    return { aksi: "legacy" as const, pesan: JSON.stringify(raw).slice(0, 160) };
  }
  if (typeof raw !== "object" || raw === null) return { aksi: "legacy" as const, pesan: JSON.stringify(raw).slice(0, 160) };

  const p = raw as Record<string, unknown>;
  const aksi = String(p.aksi ?? "legacy");

  // Format lama: {"aksi":"perbarui","sebelum":{...},"sesudah":{...}} — kompatibel.
  if (aksi !== "perbarui" && aksi !== "buat" && aksi !== "kirim-massal") {
    return { aksi, pesan: `alasan: ${p.alasan ?? "-"}` + (p.status ? ` · status: ${p.status}` : "") };
  }

  const fieldBerubah: string[] = Array.isArray(p.fieldBerubah)
    ? (p.fieldBerubah as unknown[]).map(String)
    : p.sebelum && typeof p.sebelum === "object"
      ? Object.keys(p.sebelum as Record<string, unknown>)
      : [];

  const bagian: string[] = [];
  if (aksi === "buat") {
    const sesudah = (p.sesudah as Record<string, unknown> | undefined) ?? {};
    bagian.push(`status: ${String(sesudah.status ?? "")}` || "status: (kosong)");
    bagian.push(`materi: ${String(sesudah.materi ?? "—")}`.slice(0, 60));
  } else if (fieldBerubah.length > 0) {
    bagian.push(`field berubah: ${fieldBerubah.map(labelFieldJurnal).join(", ")}`);
    if (aksi === "kirim-massal") {
      bagian.push(`status: ${String((p.sebelum as Record<string, unknown>)?.status ?? "")} → ${String((p.sesudah as Record<string, unknown>)?.status ?? "")}`);
    }
  } else {
    bagian.push(JSON.stringify(p).slice(0, 160));
  }

  return { aksi, pesan: bagian.join(" · ") };
}

export default async function RiwayatPage() {
  await getCurrentUser();
  const riwayat = await prisma.riwayatPerubahan.findMany({
    include: { user: true },
    orderBy: { waktu: "desc" },
    take: 200,
  });

  return (
    <div className="fade-up">
      <PageHeader
        title="Riwayat Perubahan"
        subtitle="Audit trail — setiap perubahan jurnal & data penting tercatat, tidak ada yang diubah diam-diam"
        icon={<History className="h-6 w-6" />}
      />

      {riwayat.length === 0 ? (
        <EmptyState title="Belum ada catatan perubahan" desc="Riwayat akan terisi otomatis saat jurnal diubah atau pertemuan manual dibuat." />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Waktu</Th>
              <Th>Entitas</Th>
              <Th>Oleh</Th>
              <Th>Perubahan</Th>
            </tr>
          </thead>
          <tbody>
            {riwayat.map((r) => {
              const info = bacaPerubahan(r.perubahan as unknown);
              return (
                <TableRow key={r.id}>
                  <Td className="whitespace-nowrap font-semibold text-slate-500">{formatJam(r.waktu)}</Td>
                  <Td>
                    <span className="font-bold text-slate-900">{r.entitas}</span>
                    <span className="ml-2 text-xs text-slate-400">{r.entitasId.slice(0, 8)}…</span>
                  </Td>
                  <Td>{r.user?.nama ?? "Sistem"}</Td>
                  <Td className="max-w-[360px]">
                    <p className="text-xs font-bold capitalize text-emerald-600">aksi: {info.aksi}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{info.pesan}</p>
                  </Td>
                </TableRow>
              );
            })}
          </tbody>
        </TableShell>
      )}
    </div>
  );
}