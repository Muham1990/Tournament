import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config();

function stripEnvUrl(raw: string) {
  return String(raw || "")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .replace(/\s+/g, "");
}

function applyNeonParams(u: URL, forQuery: boolean) {
  u.searchParams.delete("channel_binding");
  if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "15");
  if (u.hostname.includes("neon.tech")) {
    u.searchParams.set("sslmode", "require");
  }
  if (forQuery && u.hostname.includes("-pooler.")) {
    if (!u.searchParams.has("pgbouncer")) u.searchParams.set("pgbouncer", "true");
    if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "5");
  }
}

export function databaseUrl(raw = process.env.DATABASE_URL || "") {
  const cleaned = stripEnvUrl(raw);
  if (!cleaned) return cleaned;
  try {
    const u = new URL(cleaned);
    applyNeonParams(u, true);
    return u.toString();
  } catch {
    return cleaned;
  }
}

/** Neon pooled host hangs migrate; use unpooled / DIRECT_URL when possible. */
export function migrateDatabaseUrl(raw = process.env.DIRECT_URL || process.env.DATABASE_URL || "") {
  const cleaned = stripEnvUrl(raw);
  if (!cleaned) return cleaned;
  try {
    const u = new URL(cleaned);
    if (u.hostname.includes("-pooler.")) u.hostname = u.hostname.replace("-pooler.", ".");
    u.searchParams.delete("pgbouncer");
    u.searchParams.delete("connection_limit");
    applyNeonParams(u, false);
    return u.toString();
  } catch {
    return cleaned;
  }
}

const queryUrl = databaseUrl();
const migrateUrl = migrateDatabaseUrl();
if (queryUrl) process.env.DATABASE_URL = queryUrl;
if (migrateUrl) process.env.DIRECT_URL = migrateUrl;

if (queryUrl) {
  try {
    console.log(`DB host: ${new URL(queryUrl).hostname}`);
  } catch {
    console.warn("DATABASE_URL is set but not a valid URL");
  }
} else {
  console.warn("DATABASE_URL is empty");
}

export const prisma = new PrismaClient({
  datasources: { db: { url: queryUrl || undefined } },
});

/** Unpooled client for DDL / migrate. */
export const ddlPrisma = new PrismaClient({
  datasources: { db: { url: migrateUrl || queryUrl || undefined } },
});

export async function pingDb() {
  await prisma.$queryRaw`SELECT 1`;
}

export async function tablesReady() {
  try {
    await prisma.$queryRaw`SELECT 1 FROM "Country" LIMIT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P1001" || code === "P1017" || code === "P2021" || code === "P2022") {
      const { ensureSchema } = await import("../services/ensureSchema.js");
      await ensureSchema();
      return fn();
    }
    throw e;
  }
}
