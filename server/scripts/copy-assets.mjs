import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distSql = path.join(serverRoot, "dist", "sql");
fs.mkdirSync(distSql, { recursive: true });

const sqlSrc = [
  path.join(serverRoot, "src", "sql", "init.sql"),
  path.join(serverRoot, "..", "prisma", "migrations", "20240905000000_init", "migration.sql"),
].find((p) => fs.existsSync(p));
if (sqlSrc) {
  fs.copyFileSync(sqlSrc, path.join(distSql, "init.sql"));
  console.log("copied schema SQL", sqlSrc);
} else {
  console.warn("init.sql not found");
}

const schemaSrc = [
  path.join(serverRoot, "prisma", "schema.prisma"),
  path.join(serverRoot, "..", "prisma", "schema.prisma"),
].find((p) => fs.existsSync(p));
if (schemaSrc) {
  const destDir = path.join(serverRoot, "prisma");
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(schemaSrc, path.join(destDir, "schema.prisma"));
  const migSrc = path.join(path.dirname(schemaSrc), "migrations");
  const migDest = path.join(destDir, "migrations");
  if (fs.existsSync(migSrc)) fs.cpSync(migSrc, migDest, { recursive: true });
}
