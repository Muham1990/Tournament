import { prisma } from "../utils/prisma.js";

export async function audit(params: {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: unknown;
  ip?: string | null;
}) {
  try {
    const userId = params.userId && params.userId !== "env-admin" ? params.userId : undefined;
    await prisma.auditLog.create({
      data: {
        userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? undefined,
        details: params.details ? JSON.stringify(params.details) : undefined,
        ip: params.ip ?? undefined,
      },
    });
  } catch (e) {
    console.warn("audit skipped", e instanceof Error ? e.message : e);
  }
}
