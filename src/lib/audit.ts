import prisma from "@/lib/prisma";
import { getSessionIdentity } from "@/lib/route-auth";

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

/**
 * Identity-aware actor label for the audit trail, e.g. "Marcus · admin".
 * Falls back gracefully when no session is present.
 */
export async function buildActorLabel(): Promise<string> {
  try {
    const { name, steamId, role } = await getSessionIdentity();
    if (name) return `${name} · ${role}`;
    if (steamId) return `${steamId} · ${role}`;
    return "Staff session";
  } catch {
    return "Staff session";
  }
}
