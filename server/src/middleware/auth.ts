import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../utils/prisma.js";
import { AppError } from "../utils/errors.js";
import { ENV_ADMIN_ID, envStr } from "../services/ensureAdmin.js";

export interface AuthPayload {
  userId: string;
  email: string;
  role: "ADMIN";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function jwtSecret(): string {
  const secret = envStr("JWT_SECRET") || envStr("ADMIN_GATE");
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
}

function readToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  const cookie = req.cookies?.token as string | undefined;
  return cookie ?? null;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, jwtSecret(), { expiresIn: "7d" });
}

function isEnvAdmin(decoded: AuthPayload) {
  const email = envStr("ADMIN_EMAIL");
  return decoded.role === "ADMIN" && (decoded.userId === ENV_ADMIN_ID || (email && decoded.email === email));
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readToken(req);
  if (!token) return next();
  try {
    req.user = jwt.verify(token, jwtSecret()) as AuthPayload;
  } catch {
    /* ignore */
  }
  next();
}

export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const token = readToken(req);
  if (!token) return next(new AppError("UNAUTHORIZED", "Требуется авторизация", 401));
  try {
    let secret: string;
    try {
      secret = jwtSecret();
    } catch {
      return next(new AppError("CONFIG", "JWT_SECRET is not set", 500));
    }
    const decoded = jwt.verify(token, secret) as AuthPayload;
    try {
      const user = await Promise.race([
        prisma.user.findUnique({ where: { id: decoded.userId } }),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error("timeout")), 6000)),
      ]);
      if (user && user.role === "ADMIN") {
        req.user = { userId: user.id, email: user.email, role: "ADMIN" };
        return next();
      }
    } catch (e) {
      console.warn("requireAdmin db", e instanceof Error ? e.message : e);
    }
    if (isEnvAdmin(decoded)) {
      req.user = { userId: decoded.userId, email: decoded.email, role: "ADMIN" };
      return next();
    }
    return next(new AppError("FORBIDDEN", "Доступ только для администратора", 403));
  } catch {
    next(new AppError("UNAUTHORIZED", "Сессия недействительна", 401));
  }
}
