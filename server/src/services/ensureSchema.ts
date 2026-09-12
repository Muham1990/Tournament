import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { migrateDatabaseUrl, pingDb } from "../utils/prisma.js";
import { bootstrapDb } from "./bootstrapDb.js";

const execAsync = promisify(exec);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function schemaPath() {
  const p = path.join(repoRoot, "prisma", "schema.prisma");
  return fs.existsSync(p) ? p : "";
}

async function run(cmd: string) {
  const schema = schemaPath();
  if (!schema) {
    console.warn("prisma schema missing", path.join(repoRoot, "prisma", "schema.prisma"));
    return false;
  }
  const env = {
    ...process.env,
    DATABASE_URL: migrateDatabaseUrl() || process.env.DATABASE_URL,
  };
  const full = `${cmd} --schema "${schema.replace(/\\/g, "/")}"`;
  try {
    const { stdout, stderr } = await execAsync(full, { cwd: repoRoot, env, timeout: 90_000 });
    if (stdout) console.log(stdout);
    if (stderr) console.warn(stderr);
    return true;
  } catch (e) {
    const err = e as { message?: string; stdout?: string; stderr?: string };
    if (err.stdout) console.log(err.stdout);
    if (err.stderr) console.warn(err.stderr);
    console.warn(`${cmd} failed`, err.message);
    return false;
  }
}

let running: Promise<void> | null = null;

export async function ensureSchema() {
  if (running) return running;
  running = (async () => {
    await run("npx prisma migrate deploy");
    try {
      await pingDb();
    } catch {
      console.warn("DB still down after migrate, trying db push");
      await run("npx prisma db push --skip-generate");
    }
    try {
      await bootstrapDb();
    } catch (e) {
      console.warn("Admin bootstrap failed", e);
    }
  })().finally(() => {
    running = null;
  });
  return running;
}
