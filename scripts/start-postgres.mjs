import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(os.homedir(), "kumite-pg");
const nativeSrc = path.resolve(here, "../node_modules/@embedded-postgres/windows-x64/native");
const nativeDst = path.join(root, "native");
const binDir = path.join(nativeDst, "bin");
const dataDir = path.join(root, "data");
const logFile = path.join(root, "postgres.log");
const pwFile = path.join(root, "pw.txt");

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function run(cmd, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: binDir,
      env: {
        ...process.env,
        PATH: `${binDir};${process.env.PATH || ""}`,
        PGDATA: dataDir,
        ...extraEnv,
      },
      windowsHide: true,
    });
    let out = "";
    child.stdout.on("data", (d) => {
      out += d.toString();
      process.stdout.write(d);
    });
    child.stderr.on("data", (d) => {
      out += d.toString();
      process.stderr.write(d);
    });
    child.on("close", (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`${path.basename(cmd)} exited ${code}\n${out}`));
    });
  });
}

function waitPort(ms = 20000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = async () => {
      const client = new pg.Client({
        host: "127.0.0.1",
        port: 5432,
        user: "postgres",
        password: "postgres",
        database: "postgres",
        ssl: false,
        connectionTimeoutMillis: 1000,
      });
      try {
        await client.connect();
        await client.end();
        resolve();
      } catch {
        if (Date.now() - t0 > ms) reject(new Error("PostgreSQL did not become ready"));
        else setTimeout(tick, 400);
      }
    };
    tick();
  });
}

if (!fs.existsSync(path.join(binDir, "postgres.exe"))) {
  console.log("Copying PostgreSQL binaries to", nativeDst);
  copyDir(nativeSrc, nativeDst);
}

fs.mkdirSync(root, { recursive: true });
fs.writeFileSync(pwFile, "postgres");

if (!fs.existsSync(path.join(dataDir, "PG_VERSION"))) {
  console.log("Initializing cluster at", dataDir);
  await run(path.join(binDir, "initdb.exe"), [
    "--pgdata",
    dataDir,
    "--username",
    "postgres",
    "--pwfile",
    pwFile,
    "--auth",
    "password",
    "--encoding",
    "UTF8",
    "--locale",
    "C",
    "--lc-messages",
    "C",
  ]);
}

const conf = path.join(dataDir, "postgresql.conf");
if (fs.existsSync(conf)) {
  let text = fs.readFileSync(conf, "utf8");
  if (!text.includes("listen_addresses = '127.0.0.1'")) {
    text += "\nlisten_addresses = '127.0.0.1'\nport = 5432\n";
    fs.writeFileSync(conf, text);
  }
}

console.log("Starting PostgreSQL...");
await run(path.join(binDir, "pg_ctl.exe"), ["-D", dataDir, "-l", logFile, "-w", "start"]);
await waitPort();
console.log("PostgreSQL is listening on 5432");

const admin = new pg.Client({
  host: "127.0.0.1",
  port: 5432,
  user: "postgres",
  password: "postgres",
  database: "postgres",
});
await admin.connect();
const { rows } = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'kumite_arena'");
if (!rows.length) {
  await admin.query("CREATE DATABASE kumite_arena");
  console.log("Created database kumite_arena");
} else {
  console.log("Database kumite_arena already exists");
}
await admin.end();
console.log("PostgreSQL is ready");
