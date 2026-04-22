import { prisma } from "../config/prisma.js";
import {
  decryptString,
  isEncryptedValue,
} from "../security/field-encryption.js";

export interface CreateReminderData {
  title: string;
  description?: string;
  userId: string;
  groupId?: string;
  dueAt: Date;
}

export interface UpdateReminderData {
  fired?: boolean;
  firedAt?: Date | null;
}

export class ReminderRepository {
  private safeDecrypt(value: string | null | undefined, fallback?: string) {
    if (!value) return value;
    if (!isEncryptedValue(value)) {
      return value;
    }

    try {
      return decryptString(value);
    } catch {
      return fallback ?? value;
    }
  }

  private mapReminder<T extends Record<string, any> | null>(reminder: T): T {
    if (!reminder) {
      return reminder;
    }

    return {
      ...reminder,
      title: this.safeDecrypt(reminder.title, "Encrypted reminder"),
      description: this.safeDecrypt(reminder.description, ""),
    } as T;
  }

  async create(data: CreateReminderData) {
    const reminder = await prisma.reminder.create({
      data: {
        ...data,
        title: data.title,
        description: data.description,
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
        group: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    return this.mapReminder(reminder);
  }

  async findById(id: string) {
    const reminder = await prisma.reminder.findUnique({
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
        group: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    return this.mapReminder(reminder);
  }

  async findVisibleToUser(userId: string) {
    const reminders = await prisma.reminder.findMany({
      where: {
        OR: [
          { userId },
          {
            group: {
              members: {
                some: { userId },
              },
            },
          },
        ],
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
        group: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    });

    return reminders.map((reminder) => this.mapReminder(reminder));
  }

  async findDueUnfired(now: Date) {
    const reminders = await prisma.reminder.findMany({
      where: {
        fired: false,
        dueAt: { lte: now },
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
        group: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
    });

    return reminders.map((reminder) => this.mapReminder(reminder));
  }

  async update(id: string, data: UpdateReminderData) {
    const reminder = await prisma.reminder.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    return this.mapReminder(reminder);
  }

  async delete(id: string) {
    return prisma.reminder.delete({
      where: { id },
    });
  }

  async isUserGroupMember(groupId: string, userId: string) {
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
      select: { id: true },
    });

    return Boolean(membership);
  }
}
