import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../utils/prisma.js";
import { AppError } from "../utils/errors.js";
import { signToken } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { adminGateSecret, hasValidGate, setGateCookie } from "../services/adminGate.js";
import { ENV_ADMIN_ID, ensureAdmin, envStr } from "../services/ensureAdmin.js";
import { cookieOptions } from "../utils/origins.js";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  gate: z.string().optional(),
});

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

export async function openGate(req: Request, res: Response, next: NextFunction) {
  try {
    const code = String(req.params.code || req.body?.code || "").trim();
    if (!code || code !== adminGateSecret()) {
      throw new AppError("NOT_FOUND", "Not found", 404);
    }
    setGateCookie(res);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export async function inviteLink(req: Request, res: Response, next: NextFunction) {
  try {
    const secret = adminGateSecret();
    if (!secret) throw new AppError("CONFIG", "ADMIN_GATE is not set", 500);
    res.json({ path: `/a/${secret}` });
  } catch (e) {
    next(e);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = loginSchema.parse(req.body);
    const email = parsed.email.trim();
    const { password, gate } = parsed;
    const envEmail = envStr("ADMIN_EMAIL");
    const envPassword = envStr("ADMIN_PASSWORD");
    const envOk = Boolean(envEmail && email === envEmail && password === envPassword);
    if (!envOk && !hasValidGate(req) && gate !== adminGateSecret()) {
      throw new AppError("INVALID_CREDENTIALS", "Неверный email или пароль", 401);
    }
    setGateCookie(res);

    let user: { id: string; email: string; role: "ADMIN"; name: string | null; password?: string } | null = null;
    try {
      if (envOk) {
        const created = await withTimeout(ensureAdmin(), 6000);
        if (created) user = created;
      }
      if (!user) {
        user = await withTimeout(prisma.user.findUnique({ where: { email } }), 6000);
      }
    } catch (e) {
      console.warn("login db unavailable", e instanceof Error ? e.message : e);
    }

    if (!user && envOk) {
      user = { id: ENV_ADMIN_ID, email: envEmail, role: "ADMIN", name: "Administrator" };
    }
    if (!user) throw new AppError("INVALID_CREDENTIALS", "Неверный email или пароль", 401);
    const ok = envOk || (user.password ? await bcrypt.compare(password, user.password) : false);
    if (!ok) throw new AppError("INVALID_CREDENTIALS", "Неверный email или пароль", 401);

    const token = signToken({ userId: user.id, email: user.email, role: "ADMIN" });
    res.cookie("token", token, cookieOptions(7 * 24 * 60 * 60 * 1000));
    await audit({
      userId: user.id === ENV_ADMIN_ID ? undefined : user.id,
      action: "LOGIN",
      entity: "User",
      entityId: user.id === ENV_ADMIN_ID ? undefined : user.id,
      ip: req.ip,
    });
    res.json({ token, user: { id: user.id, email: user.email, role: "ADMIN", name: user.name } });
  } catch (e) {
    next(e);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    res.clearCookie("token", cookieOptions(0));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError("UNAUTHORIZED", "Требуется авторизация", 401);
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { id: true, email: true, role: true, name: true },
      });
      if (user) {
        res.json({ user });
        return;
      }
    } catch (e) {
      console.warn("me db", e instanceof Error ? e.message : e);
    }
    res.json({
      user: { id: req.user.userId, email: req.user.email, role: "ADMIN", name: "Administrator" },
    });
  } catch (e) {
    next(e);
  }
}
