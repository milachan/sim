// Normalisasi sekali-pakai: ubah identitas TABEL ke case yang benar di migrasi.
// Windows MySQL case-insensitive membuat migrasi berisi `pertemuan` dll. yang
// gagal di MariaDB/MySQL Linux (case-sensitive). Kolom tidak disentuh.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(".");
const MIG = path.join(ROOT, "prisma", "migrations");

// 1) Kumpulkan nama tabel ASLI (case Prisma) dari semua CREATE TABLE / RENAME / DROP.
const actual = new Set();
for (const dir of fs.readdirSync(MIG)) {
  const sqlDir = path.join(MIG, dir);
  if (!fs.statSync(sqlDir).isDirectory()) continue;
  const f = path.join(sqlDir, "migration.sql");
  if (!fs.existsSync(f)) continue;
  const sql = fs.readFileSync(f, "utf-8");
  for (const m of sql.matchAll(/(?:CREATE TABLE|CREATE TEMPORARY TABLE|RENAME TABLE|DROP TABLE)\s+`?([A-Za-z_][A-Za-z0-9_]*)`?/g)) {
    actual.add(m[1]);
  }
}
const lowerToActual = new Map();
for (const t of actual) lowerToActual.set(t.toLowerCase(), t);

let totalChanges = 0;
for (const dir of fs.readdirSync(MIG)) {
  const sqlDir = path.join(MIG, dir);
  if (!fs.statSync(sqlDir).isDirectory()) continue;
  const f = path.join(sqlDir, "migration.sql");
  if (!fs.existsSync(f)) continue;
  let sql = fs.readFileSync(f, "utf-8");
  const before = sql;
  // Ganti hanya pada posisi nama tabel: setelah kata kunci yang mengharapkan tabel.
  sql = sql.replace(
    /\b(ALTER TABLE|CREATE TABLE|DROP TABLE|TRUNCATE TABLE|RENAME TABLE|REFERENCES|INTO|FROM|JOIN|UPDATE)\s+`([a-zA-Z_][a-zA-Z0-9_]*)`/g,
    (full, kw, name) => {
      const fixed = lowerToActual.get(name.toLowerCase());
      if (fixed && fixed !== name) {
        totalChanges++;
        return `${kw} \`${fixed}\``;
      }
      return full;
    }
  );
  // CREATE INDEX ... ON `namaTabel`(...)
  sql = sql.replace(
    /((?:CREATE|UNIQUE|INDEX|KEY)[^;]*?\bON\s+)`([a-zA-Z_][a-zA-Z0-9_]*)`/g,
    (full, prefix, name) => {
      const fixed = lowerToActual.get(name.toLowerCase());
      if (fixed && fixed !== name) {
        totalChanges++;
        return `${prefix}\`${fixed}\``;
      }
      return full;
    }
  );
  if (sql !== before) fs.writeFileSync(f, sql);
}
console.log("Nama tabel unik:", actual.size);
console.log("Total penggantian:", totalChanges);
for (const t of [...actual].sort()) console.log(" -", t);
