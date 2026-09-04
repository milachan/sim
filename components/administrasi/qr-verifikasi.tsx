import QRCode from "qrcode";
import { ShieldCheck } from "lucide-react";
import { payloadQrVerifikasi, kodeTerformat } from "@/lib/verifikasi/qr-url";
import TombolSalin from "./tombol-salin";

// Komponen QR verifikasi Dokumen Final — SVG server-side dari library `qrcode`
// (satu-satunya dependency QR; alasan: terawat, kompatibel server rendering,
// dan menghasilkan SVG tanpa perlu canvas).
// QR hanya mengenkode URL /verifikasi-dokumen?kode=... dari helper terpercaya.

const EC_LEVEL = "Q" as const; // error correction Q — memadai untuk cetak A4.

type PotonganSvg = { viewBox: string; dLatar: string; dPiksel: string };

async function buatSvgQr(payload: string): Promise<PotonganSvg> {
  const svg = await QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: EC_LEVEL,
    margin: 1, // quiet zone dipertahankan
    width: 160,
    color: { dark: "#000000", light: "#ffffff" },
  });
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 0 0";
  const dLatar = svg.match(/fill="#ffffff" d="([^"]+)"/)?.[1] ?? "";
  const dPiksel = svg.match(/stroke="#000000" d="([^"]+)"/)?.[1] ?? "";
  return { viewBox, dLatar, dPiksel };
}

export default async function QrVerifikasi({ kodeVerifikasi }: { kodeVerifikasi: string }) {
  const payload = payloadQrVerifikasi(kodeVerifikasi);
  const kode = kodeTerformat(kodeVerifikasi);
  const { viewBox, dLatar, dPiksel } = await buatSvgQr(payload);

  return (
    <section aria-label="QR verifikasi dokumen" className="space-y-3">
      <div className="flex flex-wrap items-start gap-4">
        <div className="shrink-0 rounded-xl bg-white p-2 ring-1 ring-inset ring-slate-200">
          <svg
            role="img"
            aria-label={`QR verifikasi dokumen untuk kode ${kode}. Pindai untuk memeriksa pencatatan dan integritas dokumen.`}
            viewBox={viewBox}
            width={160}
            height={160}
            className="block h-40 w-40"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path fill="#ffffff" d={dLatar} />
            <path stroke="#000000" d={dPiksel} />
          </svg>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="flex items-start gap-1.5 text-sm font-bold text-slate-900">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span className="min-w-0 break-words">Pindai untuk memeriksa pencatatan dan integritas dokumen.</span>
          </p>
          <p className="font-mono text-sm font-bold tracking-wider text-emerald-700">{kode}</p>
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-slate-500">Tautan verifikasi (juga tersedia tanpa QR):</p>
            <code className="block break-all rounded-lg bg-slate-50 px-2 py-1.5 font-mono text-[11px] text-slate-700 ring-1 ring-inset ring-slate-200">
              {payload}
            </code>
            <TombolSalin nilai={payload} label="tautan verifikasi" />
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">
            QR ini mengarah ke layanan verifikasi pencatatan dan integritas dokumen. QR ini bukan Tanda Tangan
            Elektronik tersertifikasi dan bukan cap digital resmi.
          </p>
        </div>
      </div>
    </section>
  );
}
