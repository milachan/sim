import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function clean(v) {
  return JSON.parse(JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? Number(val) : val)));
}

try {
  console.log("=== FOREIGN KEY DokumenFinal ===");
  const fk = await prisma.$queryRawUnsafe(`
    SELECT rc.CONSTRAINT_NAME, kcu.COLUMN_NAME, kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME, rc.DELETE_RULE
    FROM information_schema.REFERENTIAL_CONSTRAINTS rc
    JOIN information_schema.KEY_COLUMN_USAGE kcu
      ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
    WHERE rc.CONSTRAINT_SCHEMA = DATABASE() AND rc.TABLE_NAME = 'DokumenFinal'
  `);
  console.log(JSON.stringify(clean(fk), null, 2));

  console.log("\n=== JUMLAH DATA DokumenFinal ===");
  const cnt = await prisma.dokumenFinal.count();
  console.log(cnt);
} finally {
  await prisma.$disconnect();
}