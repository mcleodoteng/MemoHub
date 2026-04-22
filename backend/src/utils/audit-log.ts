import { prisma } from "../config/prisma.js";
import { encryptJson, encryptString } from "../security/field-encryption.js";

export interface AuditLogEntry {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

/**
 * Write an entry to the ActivityLog table for admin/superuser actions.
 * Fails silently so it never disrupts the primary operation.
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: entry.actorId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        details: encryptJson(entry.details ?? {}),
        ipAddress: encryptString(entry.ipAddress ?? null),
      },
    });
  } catch (err) {
    console.error("[AuditLog] Failed to write audit log entry:", err);
  }
}
