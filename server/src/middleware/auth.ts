import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../utils/prisma.js";
import { AppError } from "../utils/errors.js";

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

function readToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  const cookie = req.cookies?.token as string | undefined;
  return cookie ?? null;
}

export function signToken(payload: AuthPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readToken(req);
  if (!token) return next();
  try {
    const secret = process.env.JWT_SECRET!;
    const decoded = jwt.verify(token, secret) as AuthPayload;
    req.user = decoded;
  } catch {
    /* ignore */
  }
  next();
}

export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const token = readToken(req);
  if (!token) return next(new AppError("UNAUTHORIZED", "Требуется авторизация", 401));
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return next(new AppError("CONFIG", "JWT_SECRET is not set", 500));
    const decoded = jwt.verify(token, secret) as AuthPayload;
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || user.role !== "ADMIN") {
      return next(new AppError("FORBIDDEN", "Доступ только для администратора", 403));
    }
    req.user = { userId: user.id, email: user.email, role: "ADMIN" };
    next();
  } catch {
    next(new AppError("UNAUTHORIZED", "Сессия недействительна", 401));
  }
}
