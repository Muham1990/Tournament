import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../utils/prisma.js";
import { AppError } from "../utils/errors.js";
import { signToken } from "../middleware/auth.js";
import { audit } from "../services/audit.js";
import { adminGateSecret, hasValidGate, setGateCookie } from "../services/adminGate.js";
import { cookieOptions } from "../utils/origins.js";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

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
    if (!hasValidGate(req)) {
      throw new AppError("INVALID_CREDENTIALS", "Неверный email или пароль", 401);
    }
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError("INVALID_CREDENTIALS", "Неверный email или пароль", 401);
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new AppError("INVALID_CREDENTIALS", "Неверный email или пароль", 401);
    const token = signToken({ userId: user.id, email: user.email, role: "ADMIN" });
    res.cookie("token", token, cookieOptions(7 * 24 * 60 * 60 * 1000));
    await audit({ userId: user.id, action: "LOGIN", entity: "User", entityId: user.id, ip: req.ip });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
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
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, email: true, role: true, name: true },
    });
    res.json({ user });
  } catch (e) {
    next(e);
  }
}
