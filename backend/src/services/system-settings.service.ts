import { prisma } from "../config/prisma.js";

export interface SystemSettings {
  allowPublicMemos: boolean;
  requireApproval: boolean;
  maxAttachmentSize: string;
  auditRetention: string;
}

const SYSTEM_SETTINGS_KEY = "system";

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  allowPublicMemos: true,
  requireApproval: false,
  maxAttachmentSize: "10",
  auditRetention: "90",
};

const MAX_SUPPORTED_ATTACHMENT_SIZE_MB = 50;

export class SystemSettingsService {
  private lastAuditCleanupAt = 0;

  private normalizeSettings(value: unknown): SystemSettings {
    const raw = (
      value && typeof value === "object" ? value : {}
    ) as Partial<SystemSettings>;
    const maxAttachmentSize = Number.parseInt(
      String(
        raw.maxAttachmentSize ?? DEFAULT_SYSTEM_SETTINGS.maxAttachmentSize,
      ),
      10,
    );
    const auditRetention = Number.parseInt(
      String(raw.auditRetention ?? DEFAULT_SYSTEM_SETTINGS.auditRetention),
      10,
    );

    return {
      allowPublicMemos:
        raw.allowPublicMemos ?? DEFAULT_SYSTEM_SETTINGS.allowPublicMemos,
      requireApproval:
        raw.requireApproval ?? DEFAULT_SYSTEM_SETTINGS.requireApproval,
      maxAttachmentSize: String(
        Number.isFinite(maxAttachmentSize) && maxAttachmentSize > 0
          ? Math.min(maxAttachmentSize, MAX_SUPPORTED_ATTACHMENT_SIZE_MB)
          : Number.parseInt(DEFAULT_SYSTEM_SETTINGS.maxAttachmentSize, 10),
      ),
      auditRetention: String(
        Number.isFinite(auditRetention) && auditRetention > 0
          ? auditRetention
          : Number.parseInt(DEFAULT_SYSTEM_SETTINGS.auditRetention, 10),
      ),
    };
  }

  async getSystemSettings(): Promise<SystemSettings> {
    const entry = await prisma.appSetting.findUnique({
      where: { key: SYSTEM_SETTINGS_KEY },
    });

    if (!entry) {
      return { ...DEFAULT_SYSTEM_SETTINGS };
    }

    return this.normalizeSettings(entry.value);
  }

  async updateSystemSettings(
    settings: Partial<SystemSettings>,
  ): Promise<SystemSettings> {
    const current = await this.getSystemSettings();
    const next = this.normalizeSettings({
      ...current,
      ...settings,
    });

    await prisma.appSetting.upsert({
      where: { key: SYSTEM_SETTINGS_KEY },
      update: { value: next as any },
      create: {
        key: SYSTEM_SETTINGS_KEY,
        value: next as any,
      },
    });

    return next;
  }

  async getMaxAttachmentSizeBytes(): Promise<number> {
    const settings = await this.getSystemSettings();
    const maxAttachmentSizeMb = Number.parseInt(settings.maxAttachmentSize, 10);
    return maxAttachmentSizeMb * 1024 * 1024;
  }

  async enforceAttachmentSize(
    files: Array<{ size: number; originalname?: string }>,
  ): Promise<void> {
    const maxBytes = await this.getMaxAttachmentSizeBytes();
    for (const file of files) {
      if (file.size > maxBytes) {
        const maxMb = Math.round(maxBytes / (1024 * 1024));
        const error = new Error(
          `Attachment size is bigger than the max attachment size (${maxMb} MB).`,
        );
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
      }
    }
  }

  async cleanupExpiredAuditLogs(force = false): Promise<number> {
    const now = Date.now();
    if (!force && now - this.lastAuditCleanupAt < 60 * 60 * 1000) {
      return 0;
    }

    const settings = await this.getSystemSettings();
    const retentionDays = Number.parseInt(settings.auditRetention, 10);
    const cutoff = new Date(now - retentionDays * 24 * 60 * 60 * 1000);

    const result = await prisma.activityLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoff,
        },
      },
    });

    this.lastAuditCleanupAt = now;
    return result.count;
  }
}

export const MAX_SUPPORTED_ATTACHMENT_SIZE_BYTES =
  MAX_SUPPORTED_ATTACHMENT_SIZE_MB * 1024 * 1024;
