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
import { ensureSchema } from "./services/ensureSchema.js";
import { pingDb, tablesReady } from "./utils/prisma.js";

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
  app.get("/api/health", async (_req, res) => {
    try {
      await pingDb();
      const tables = await tablesReady();
      if (!tables) void ensureSchema();
      res.json({ ok: true, db: "up", tables });
    } catch (e) {
      const code = (e as { code?: string }).code || "down";
      res.json({ ok: true, db: code, tables: false });
    }
  });
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

  void ensureSchema();
  const { startTelegramBot } = await import("./telegram/bot.js");
  void startTelegramBot().catch((e) => console.warn("Telegram bot failed to start", e));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
