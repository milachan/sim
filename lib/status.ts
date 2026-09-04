import type { StatusJurnal, StatusPertemuan } from "@prisma/client";

export function hitungStatusPertemuan(opts: {
  absensiCount: number;
  jurnalStatus: StatusJurnal | null;
  tidakTerlaksana?: boolean;
}): StatusPertemuan {
  if (opts.tidakTerlaksana) return "TIDAK_TERLAKSANA";
  if (opts.jurnalStatus === "TERKIRIM") return "LENGKAP";
  if (opts.jurnalStatus !== null) return "JURNAL_TERISI";
  if (opts.absensiCount > 0) return "ABSENSI_TERISI";
  return "BELUM_DIMULAI";
}

export function kelengkapanLabel(status: StatusPertemuan): string {
  switch (status) {
    case "LENGKAP":
      return "Lengkap";
    case "ABSENSI_TERISI":
      return "Absensi terisi, jurnal belum";
    case "JURNAL_TERISI":
      return "Jurnal terisi, absensi belum";
    case "TIDAK_TERLAKSANA":
      return "Tidak terlaksana";
    default:
      return "Belum diisi";
  }
}
