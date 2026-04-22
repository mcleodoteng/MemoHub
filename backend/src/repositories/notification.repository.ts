import { prisma } from "../config/prisma.js";
import {
  decryptString,
  isEncryptedValue,
} from "../security/field-encryption.js";

export interface CreateNotificationData {
  userId: string;
  type: string;
  title: string;
  body: string;
  actionUrl?: string;
}

export interface NotificationFilters {
  userId?: string;
  read?: boolean;
  type?: string;
  limit?: number;
  offset?: number;
}

export class NotificationRepository {
  private safeDecrypt(
    value: string | null | undefined,
    fallback: string | null | undefined = "",
  ) {
    if (!value) return fallback ?? "";
    // If it's an encrypted blob from old data, try to decrypt it;
    // otherwise treat it as plain text
    if (isEncryptedValue(value)) {
      try {
        return decryptString(value) ?? fallback ?? "";
      } catch {
        return fallback ?? "";
      }
    }
    return value;
  }

  private mapNotification<T extends Record<string, any> | null>(
    notification: T,
  ): T {
    if (!notification) {
      return notification;
    }

    return {
      ...notification,
      title: this.safeDecrypt(notification.title, "Notification"),
      body: this.safeDecrypt(notification.body, ""),
    } as T;
  }

  async create(data: CreateNotificationData) {
    const notification = await prisma.notification.create({
      data: {
        ...data,
        // Store as plain text - notification titles/bodies are not sensitive
        // and encryption was causing 'Notification' fallback on decryption failure
        title: data.title,
        body: data.body,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    return this.mapNotification(notification);
  }

  async findById(id: string) {
    const notification = await prisma.notification.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    return this.mapNotification(notification);
  }

  async findByUserId(
    userId: string,
    filters: Omit<NotificationFilters, "userId"> = {},
  ) {
    const { read, type, limit = 50, offset = 0 } = filters;

    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        ...(read !== undefined && { read }),
        ...(type && { type }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    return notifications.map((notification) =>
      this.mapNotification(notification),
    );
  }

  async markAsRead(id: string, userId: string) {
    return prisma.notification.updateMany({
      where: {
        id,
        userId,
      },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId },
      data: { read: true },
    });
  }

  async countUnread(userId: string) {
    return prisma.notification.count({
      where: {
        userId,
        read: false,
      },
    });
  }

  async delete(id: string, userId: string) {
    return prisma.notification.deleteMany({
      where: {
        id,
        userId,
      },
    });
  }

  async deleteAll(userId: string) {
    return prisma.notification.deleteMany({
      where: { userId },
    });
  }
}
