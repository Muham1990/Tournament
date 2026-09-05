import bcrypt from "bcryptjs";
import { prisma } from "../utils/prisma.js";

export async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return null;
  const hash = await bcrypt.hash(password, 12);
  const already = await prisma.user.findUnique({ where: { email } });
  if (already) {
    return prisma.user.update({ where: { email }, data: { password: hash, role: "ADMIN" } });
  }
  const oldAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (oldAdmin) {
    return prisma.user.update({
      where: { id: oldAdmin.id },
      data: { email, password: hash, role: "ADMIN" },
    });
  }
  return prisma.user.create({ data: { email, password: hash, role: "ADMIN", name: "Administrator" } });
}
