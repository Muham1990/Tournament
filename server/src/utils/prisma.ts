import { PrismaClient } from "@prisma/client";

function dbUrl() {
  const raw = process.env.DATABASE_URL || "";
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "10");
    return u.toString();
  } catch {
    return raw;
  }
}

export const prisma = new PrismaClient({ datasources: { db: { url: dbUrl() } } });
