import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { errorHandler } from "./utils/errors.js";
import { optionalAuth } from "./middleware/auth.js";
import { uploadRoot } from "./middleware/upload.js";
import { authRouter } from "./routes/auth.js";
import { apiRouter } from "./routes/index.js";
import { initSocket } from "./websocket/index.js";
import { corsOrigin } from "./utils/origins.js";
import { bootstrapDb } from "./services/bootstrapDb.js";
import { migrateDatabaseUrl } from "./utils/prisma.js";
import { exec } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

async function main() {
  const app = express();
  const server = http.createServer(app);
  initSocket(server);

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use(optionalAuth);
  app.use(
    rateLimit({
      windowMs: 60_000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  if (!fs.existsSync(uploadRoot)) fs.mkdirSync(uploadRoot, { recursive: true });
  app.use("/uploads", express.static(uploadRoot));

  app.use("/api/auth", authRouter);
  app.use("/api", apiRouter);

  app.use(errorHandler);

  const port = Number(process.env.PORT) || 5000;
  await new Promise<void>((resolve, reject) => {
    server.listen(port, "0.0.0.0", () => {
      console.log(`Kumite Arena API on http://0.0.0.0:${port}`);
      const on = (k: string) => Boolean(process.env[k]?.trim());
      console.log(`AI: Gemini ${on("GEMINI_API_KEY") ? "ok" : "off"}, Groq ${on("GROQ_API_KEY") ? "ok" : "off"}, OpenRouter ${on("OPENROUTER_API_KEY") ? "ok" : "off"}`);
      resolve();
    });
    server.once("error", reject);
  });

  const repoRoot = path.resolve(__dirname, "../..");
  const schema = path.join(repoRoot, "prisma", "schema.prisma");
  void new Promise<void>((resolve) => {
    if (!fs.existsSync(schema)) {
      console.warn("prisma schema missing", schema);
      resolve();
      return;
    }
    const cmd = `npx prisma migrate deploy --schema "${schema.replace(/\\/g, "/")}"`;
    exec(
      cmd,
      {
        cwd: repoRoot,
        env: { ...process.env, DATABASE_URL: migrateDatabaseUrl() || process.env.DATABASE_URL },
        timeout: 90_000,
      },
      (err, stdout, stderr) => {
        if (stdout) console.log(stdout);
        if (stderr) console.warn(stderr);
        if (err) console.warn("migrate deploy failed", err.message);
        resolve();
      },
    );
  })
    .then(() => bootstrapDb())
    .catch((e) => console.warn("Admin bootstrap failed", e));
  const { startTelegramBot } = await import("./telegram/bot.js");
  void startTelegramBot().catch((e) => console.warn("Telegram bot failed to start", e));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
