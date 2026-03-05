import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

interface AuditLogInput {
  companyId: string;
  userId?: string;
  action: string;
  entity: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}

export async function logAudit(input: AuditLogInput) {
  await prisma.auditLog.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      metadata: input.metadata,
    },
  });
}
