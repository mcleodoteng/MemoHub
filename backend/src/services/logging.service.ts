import { prisma } from "../config/prisma.js";
import {
  decryptJson,
  decryptString,
  encryptJson,
  encryptString,
} from "../security/field-encryption.js";
import { SystemSettingsService } from "./system-settings.service.js";

export interface LogEntry {
  userId: string;
  action: string;
  resourceType: "memo" | "comment" | "message" | "group" | "user" | "tag";
  resourceId: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export class LoggingService {
  private systemSettingsService = new SystemSettingsService();

  private mapLogEntry<T extends Record<string, any>>(entry: T): T {
    return {
      ...entry,
      details: decryptJson(entry.details),
      ipAddress: decryptString(entry.ipAddress),
      userAgent: decryptString(entry.userAgent),
    } as T;
  }

  /**
   * Log a user action
   */
  async logActivity(entry: LogEntry): Promise<void> {
    try {
      await this.systemSettingsService.cleanupExpiredAuditLogs();

      await prisma.activityLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          details: encryptJson(entry.details || {}),
          ipAddress: encryptString(entry.ipAddress),
          userAgent: encryptString(entry.userAgent),
        } as any,
      });
    } catch (error) {
      console.error("Failed to log activity:", error);
      // Don't throw error to avoid breaking main functionality
    }
  }

  /**
   * Log memo creation
   */
  async logMemoCreation(
    userId: string,
    memoId: string,
    memoData: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.logActivity({
      userId,
      action: "create",
      resourceType: "memo",
      resourceId: memoId,
      details: {
        title: memoData.title,
        priority: memoData.priority,
        recipientCount: memoData.recipients?.length || 0,
      },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log memo update
   */
  async logMemoUpdate(
    userId: string,
    memoId: string,
    changes: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.logActivity({
      userId,
      action: "update",
      resourceType: "memo",
      resourceId: memoId,
      details: changes,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log memo deletion
   */
  async logMemoDeletion(
    userId: string,
    memoId: string,
    memoTitle: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.logActivity({
      userId,
      action: "delete",
      resourceType: "memo",
      resourceId: memoId,
      details: { title: memoTitle },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log memo action (read, acknowledge, approve, etc.)
   */
  async logMemoAction(
    userId: string,
    memoId: string,
    action: string,
    details?: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.logActivity({
      userId,
      action,
      resourceType: "memo",
      resourceId: memoId,
      details,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log comment creation
   */
  async logCommentCreation(
    userId: string,
    commentId: string,
    memoId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.logActivity({
      userId,
      action: "create",
      resourceType: "comment",
      resourceId: commentId,
      details: { memoId },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log message sending
   */
  async logMessageSent(
    userId: string,
    messageId: string,
    recipientIds: string[],
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.logActivity({
      userId,
      action: "send",
      resourceType: "message",
      resourceId: messageId,
      details: { recipientCount: recipientIds.length },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log group creation
   */
  async logGroupCreation(
    userId: string,
    groupId: string,
    groupData: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.logActivity({
      userId,
      action: "create",
      resourceType: "group",
      resourceId: groupId,
      details: {
        name: groupData.name,
        memberCount: groupData.members?.length || 0,
      },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log user login
   */
  async logUserLogin(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.logActivity({
      userId,
      action: "login",
      resourceType: "user",
      resourceId: userId,
      details: { event: "login" },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log user logout
   */
  async logUserLogout(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.logActivity({
      userId,
      action: "logout",
      resourceType: "user",
      resourceId: userId,
      details: { event: "logout" },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Get activity logs for a user
   */
  async getUserActivityLogs(
    userId: string,
    limit: number = 50,
    offset: number = 0,
  ) {
    const logs = await (prisma.activityLog as any).findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    return logs.map((log: any) => this.mapLogEntry(log));
  }

  /**
   * Get activity logs for a resource
   */
  async getResourceActivityLogs(
    resourceType: string,
    resourceId: string,
    limit: number = 50,
    offset: number = 0,
  ) {
    const logs = await (prisma.activityLog as any).findMany({
      where: {
        resourceType,
        resourceId,
      } as any,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" } as any,
      take: limit,
      skip: offset,
    });

    return logs.map((log: any) => this.mapLogEntry(log));
  }

  /**
   * Get recent activity logs across the system
   */
  async getRecentActivityLogs(limit: number = 100, offset: number = 0) {
    await this.systemSettingsService.cleanupExpiredAuditLogs();

    const logs = await (prisma.activityLog as any).findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" } as any,
      take: limit,
      skip: offset,
    });

    return logs.map((log: any) => this.mapLogEntry(log));
  }
}
