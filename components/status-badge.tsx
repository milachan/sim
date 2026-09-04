import { Flag } from "lucide-react";
import type { JenisKegiatan, Role, StatusAbsensi, StatusJurnal, StatusKumpul, StatusPertemuan } from "@prisma/client";
import {
  JENIS_KEGIATAN_LABEL,
  JENIS_KEGIATAN_WARNA,
  ROLE_BADGE,
  ROLE_LABEL,
  STATUS_ABSENSI_BADGE,
  STATUS_ABSENSI_LABEL,
  STATUS_JURNAL_LABEL,
  STATUS_KUMPUL_BADGE,
  STATUS_KUMPUL_LABEL,
  STATUS_PERTEMUAN_BADGE,
  STATUS_PERTEMUAN_LABEL,
} from "@/lib/constants";
import { Badge } from "./ui";

export function PertemuanBadge({ status }: { status: StatusPertemuan }) {
  return <Badge className={STATUS_PERTEMUAN_BADGE[status]}>{STATUS_PERTEMUAN_LABEL[status]}</Badge>;
}

export function AbsensiBadge({ status }: { status: StatusAbsensi }) {
  return <Badge className={STATUS_ABSENSI_BADGE[status]}>{STATUS_ABSENSI_LABEL[status]}</Badge>;
}

export function JurnalBadge({ status }: { status: StatusJurnal }) {
  const cls = status === "TERKIRIM" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700";
  return <Badge className={cls}>{STATUS_JURNAL_LABEL[status]}</Badge>;
}

export function KumpulBadge({ status }: { status: StatusKumpul }) {
  return <Badge className={STATUS_KUMPUL_BADGE[status]}>{STATUS_KUMPUL_LABEL[status]}</Badge>;
}

export function KegiatanBadge({ jenis }: { jenis: JenisKegiatan }) {
  return <Badge className={JENIS_KEGIATAN_WARNA[jenis]}>{JENIS_KEGIATAN_LABEL[jenis]}</Badge>;
}

export function RoleBadge({ role }: { role: Role }) {
  return <Badge className={ROLE_BADGE[role]}>{ROLE_LABEL[role]}</Badge>;
}

export function UpacaraBadge() {
  return (
    <Badge className="bg-rose-100 text-rose-700">
      <Flag className="h-3 w-3" /> Upacara
    </Badge>
  );
}
