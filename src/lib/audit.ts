import prisma from "@/lib/prisma";

interface AuditEntryInput {
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  tournamentId?: string | null;
  actor?: string | null;
  metadata?: unknown;
}

export async function recordAudit(input: AuditEntryInput) {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary,
        tournamentId: input.tournamentId ?? null,
        actor: input.actor ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch (error) {
    console.error("[Audit] Failed to record entry:", error);
  }
}

export function buildAdminActorLabel() {
  return "Admin session";
}
