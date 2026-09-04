import { sinkronkanPertemuan } from "../lib/pertemuan";

async function main() {
  const eksekusi = process.argv[2] === "exec";
  const r = await sinkronkanPertemuan({ dryRun: !eksekusi });
  console.log(
    JSON.stringify(
      {
        mode: eksekusi ? "eksekusi" : "dry-run",
        slotTotal: r.slotTotal,
        sudahAda: r.sudahAda,
        belumAda: r.belumAda,
        dibuat: r.dibuat,
        dinormalkan: r.dinormalkan,
        libur: r.libur.length,
        minggu: r.minggu,
        anomaliLibur: r.anomaliLibur.length,
        perluNormalisasi: r.perluNormalisasi.length,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});