import { prisma } from "../utils/prisma.js";

export async function audit(params: {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: unknown;
  ip?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? undefined,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId ?? undefined,
      details: params.details ? JSON.stringify(params.details) : undefined,
      ip: params.ip ?? undefined,
    },
  });
}
