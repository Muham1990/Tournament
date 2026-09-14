import path from "path";
import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { ddlPrisma, migrateDatabaseUrl, tablesReady } from "../utils/prisma.js";
import { bootstrapDb } from "./bootstrapDb.js";

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));

function firstExisting(paths: string[]) {
  return paths.find((p) => fs.existsSync(p)) || "";
}

function repoRoot() {
  return firstExisting([
    path.resolve(here, "../../.."),
    path.resolve(process.cwd()),
    path.resolve(process.cwd(), ".."),
  ].filter(Boolean)) || path.resolve(here, "../../..");
}

function schemaPath() {
  const root = repoRoot();
  return firstExisting([
    path.join(root, "prisma", "schema.prisma"),
    path.join(process.cwd(), "prisma", "schema.prisma"),
    path.resolve(here, "../../../prisma/schema.prisma"),
    path.resolve(here, "../../../../prisma/schema.prisma"),
  ]);
}

function prismaEntry() {
  const root = repoRoot();
  return firstExisting([
    path.join(root, "node_modules", "prisma", "build", "index.js"),
    path.join(process.cwd(), "node_modules", "prisma", "build", "index.js"),
    path.join(root, "server", "node_modules", "prisma", "build", "index.js"),
  ]);
}

function migrationSqlPath() {
  const root = repoRoot();
  return firstExisting([
    path.join(root, "prisma", "migrations", "20240905000000_init", "migration.sql"),
    path.join(process.cwd(), "prisma", "migrations", "20240905000000_init", "migration.sql"),
  ]);
}

async function runPrisma(args: string[]) {
  const bin = prismaEntry();
  const schema = schemaPath();
  if (!bin || !schema) {
    console.warn("prisma CLI or schema missing", { bin, schema, cwd: process.cwd(), here });
    return false;
  }
  const env = {
    ...process.env,
    DATABASE_URL: migrateDatabaseUrl() || process.env.DATABASE_URL,
  };
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [bin, ...args, "--schema", schema], {
      cwd: path.dirname(path.dirname(schema)),
      env,
      timeout: 90_000,
    });
    if (stdout) console.log(stdout);
    if (stderr) console.warn(stderr);
    return true;
  } catch (e) {
    const err = e as { message?: string; stdout?: string; stderr?: string };
    if (err.stdout) console.log(err.stdout);
    if (err.stderr) console.warn(err.stderr);
    console.warn(`prisma ${args.join(" ")} failed`, err.message);
    return false;
  }
}

function splitSql(sql: string) {
  return sql
    .split(";")
    .map((s) => s
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .trim())
    .filter(Boolean);
}

async function applySqlFallback() {
  const file = migrationSqlPath();
  if (!file) {
    console.warn("migration.sql missing, cannot apply SQL fallback");
    return false;
  }
  const statements = splitSql(fs.readFileSync(file, "utf8"));
  console.log(`Applying ${statements.length} SQL statements from migration.sql`);
  for (const stmt of statements) {
    try {
      await ddlPrisma.$executeRawUnsafe(stmt);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/already exists/i.test(msg)) continue;
      console.warn("SQL stmt failed", msg.slice(0, 200), stmt.slice(0, 80));
    }
  }
  return tablesReady();
}

let running: Promise<void> | null = null;

export async function ensureSchema() {
  if (running) return running;
  running = (async () => {
    if (await tablesReady()) {
      console.log("DB tables already present");
    } else {
      console.warn("Country table missing — creating schema");
      await runPrisma(["migrate", "deploy"]);
      if (!(await tablesReady())) {
        await runPrisma(["db", "push", "--skip-generate"]);
      }
      if (!(await tablesReady())) {
        const ok = await applySqlFallback();
        console.warn("SQL fallback", ok ? "created tables" : "failed");
      }
    }
    if (await tablesReady()) {
      try {
        await bootstrapDb();
      } catch (e) {
        console.warn("Admin bootstrap failed", e);
      }
    } else {
      console.warn("DB tables still missing after migrate/push/SQL");
    }
  })().finally(() => {
    running = null;
  });
  return running;
}
