import { PrismaClient } from "@prisma/client";
import { readdir, unlink } from "fs/promises";
import path from "path";

// Pembersih data uji Template Dokumen — HANYA template dengan penanda uji.
// Menghapus record (cascade versi+riwayat) dan file fisik di storage template.

const PENANDA = "Uji E2E";
const p = new PrismaClient();
const dir = path.join(process.cwd(), "storage", "dokumen", "template");

const targets = await p.templateDokumen.findMany({
  where: { nama: { contains: PENANDA } },
  select: { id: true, versi: { select: { kunciPenyimpanan: true } } },
});

let fileDihapus = 0;
for (const t of targets) {
  for (const v of t.versi) {
    try {
      await unlink(path.join(dir, v.kunciPenyimpanan));
      fileDihapus++;
    } catch {}
  }
  await p.riwayatTemplateDokumen.deleteMany({ where: { templateId: t.id } });
  await p.templateDokumen.delete({ where: { id: t.id } }).catch(() => {});
}

// Buang file yatim di namespace template (tidak terikat record mana pun).
const terpakai = new Set(
  (await p.versiTemplateDokumen.findMany({ select: { kunciPenyimpanan: true } })).map((v) => v.kunciPenyimpanan)
);
try {
  for (const f of await readdir(dir)) {
    if (!terpakai.has(f)) {
      await unlink(path.join(dir, f)).catch(() => {});
      fileDihapus++;
    }
  }
} catch {}

console.log(JSON.stringify({ templateDihapus: targets.length, fileDihapus }));
await p.$disconnect();
