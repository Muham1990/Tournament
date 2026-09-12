import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config();

function applyNeonParams(u: URL, forQuery: boolean) {
  if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "10");
  if (u.hostname.includes("neon.tech") && !u.searchParams.has("sslmode")) {
    u.searchParams.set("sslmode", "require");
  }
  if (forQuery && u.hostname.includes("-pooler.") && !u.searchParams.has("pgbouncer")) {
    u.searchParams.set("pgbouncer", "true");
  }
}

export function databaseUrl(raw = process.env.DATABASE_URL || "") {
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    applyNeonParams(u, true);
    return u.toString();
  } catch {
    return raw;
  }
}

/** Neon pooled host hangs migrate; use unpooled / DIRECT_URL when possible. */
export function migrateDatabaseUrl(raw = process.env.DIRECT_URL || process.env.DATABASE_URL || "") {
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    if (u.hostname.includes("-pooler.")) u.hostname = u.hostname.replace("-pooler.", ".");
    u.searchParams.delete("pgbouncer");
    applyNeonParams(u, false);
    return u.toString();
  } catch {
    return raw;
  }
}

export const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl() } },
});
