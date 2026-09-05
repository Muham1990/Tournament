import crypto from "crypto";
import type { Request, Response } from "express";
import { cookieOptions } from "../utils/origins.js";

export const GATE_COOKIE = "ag";

export function adminGateSecret() {
  return String(process.env.ADMIN_GATE || "").trim();
}

export function gateToken() {
  const secret = adminGateSecret();
  const jwt = process.env.JWT_SECRET || "x";
  if (!secret) return "";
  return crypto.createHmac("sha256", jwt).update(`gate:${secret}`).digest("hex").slice(0, 40);
}

export function isLocalDevOrigin(req: Request) {
  if (process.env.NODE_ENV === "production") return false;
  const origin = String(req.headers.origin || req.headers.referer || "");
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(origin);
}

export function hasValidGate(req: Request) {
  const expected = gateToken();
  const cookie = req.cookies?.[GATE_COOKIE];
  if (expected && cookie === expected) return true;
  return isLocalDevOrigin(req);
}

export function setGateCookie(res: Response) {
  const token = gateToken();
  if (!token) return;
  res.cookie(GATE_COOKIE, token, cookieOptions(90 * 24 * 60 * 60 * 1000));
}
