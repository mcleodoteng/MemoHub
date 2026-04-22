import {
  CreateReminderData,
  ReminderRepository,
} from "../repositories/reminder.repository.js";
import { ConversationRepository } from "../repositories/conversation.repository.js";
import { MessageRepository } from "../repositories/message.repository.js";
import { NotificationService } from "./notification.service.js";
import { prisma } from "../config/prisma.js";
import { io } from "../server.js";

export class ReminderService {
  private reminderRepository: ReminderRepository;
  private conversationRepository: ConversationRepository;
  private messageRepository: MessageRepository;
  private notificationService: NotificationService;
  private emittedReminderIds: Set<string> = new Set();

  constructor() {
    this.reminderRepository = new ReminderRepository();
    this.conversationRepository = new ConversationRepository();
    this.messageRepository = new MessageRepository();
    this.notificationService = new NotificationService();
  }

  private formatReminderDueAt(dueAt: Date) {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(dueAt);
  }

  private async getReminderRecipientIds(reminder: {
    userId: string;
    groupId?: string | null;
  }) {
    if (!reminder.groupId) {
      return [reminder.userId];
    }

    const members = await prisma.groupMember.findMany({
      where: { groupId: reminder.groupId },
      select: { userId: true },
    });

    return Array.from(new Set(members.map((member) => member.userId)));
  }

  private async emitReminderCreated(reminder: any) {
    const recipientIds = await this.getReminderRecipientIds(reminder);

    recipientIds.forEach((recipientId) => {
      io.to(`user_${recipientId}`).emit("reminder:created", { reminder });
    });

    if (!reminder.groupId) {
      return;
    }

    const conversation =
      await this.conversationRepository.getOrCreateGroupConversation(
        reminder.groupId,
        recipientIds,
        reminder.group?.name || undefined,
      );

    const actorUserId = recipientIds.includes(reminder.userId)
      ? reminder.userId
      : recipientIds[0];
    if (!actorUserId) {
      return;
    }

    const dueLabel = this.formatReminderDueAt(new Date(reminder.dueAt));
    const creatorName = reminder.user?.name || "Someone";
    const body = `${creatorName} set a reminder for ${dueLabel}: ${reminder.title}`;

    const systemMessage = await this.messageRepository.create({
      conversationId: conversation.id,
      senderId: actorUserId,
      body,
      isSystem: true,
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    io.to(`conversation_${conversation.id}`).emit("new_message", {
      message: systemMessage,
      conversationId: conversation.id,
    });
  }

  private async emitReminderDeleted(reminder: any) {
    const recipientIds = await this.getReminderRecipientIds(reminder);

    recipientIds.forEach((recipientId) => {
      io.to(`user_${recipientId}`).emit("reminder:deleted", {
        reminderId: reminder.id,
      });
    });
  }

  private async emitReminderFired(reminder: any) {
    const recipientIds = await this.getReminderRecipientIds(reminder);

    recipientIds.forEach((recipientId) => {
      io.to(`user_${recipientId}`).emit("reminder:fired", { reminder });
    });
  }

  async createReminder(
    data: Omit<CreateReminderData, "dueAt"> & { dueAt: string },
  ) {
    if (data.groupId) {
      const isMember = await this.reminderRepository.isUserGroupMember(
        data.groupId,
        data.userId,
      );

      if (!isMember) {
        throw new Error("Access denied to group reminder");
      }
    }

    const reminder = await this.reminderRepository.create({
      ...data,
      dueAt: new Date(data.dueAt),
    });

    await this.emitReminderCreated(reminder);
    return reminder;
  }

  async getUserVisibleReminders(userId: string) {
    await this.processDueReminders();
    return this.reminderRepository.findVisibleToUser(userId);
  }

  async processDueReminders(now = new Date()) {
    const dueReminders = await this.reminderRepository.findDueUnfired(now);

    for (const reminder of dueReminders) {
      // Skip if this reminder was already emitted in this session
      if (this.emittedReminderIds.has(reminder.id)) {
        continue;
      }

      const updatedReminder = await this.reminderRepository.update(
        reminder.id,
        {
          fired: true,
          firedAt: now,
        },
      );

      // Mark as emitted to prevent re-emission
      this.emittedReminderIds.add(reminder.id);
      await this.emitReminderFired(updatedReminder);
    }

    return dueReminders.length;
  }

  async deleteReminder(id: string, userId: string) {
    const reminder = await this.reminderRepository.findById(id);

    if (!reminder) {
      throw new Error("Reminder not found");
    }

    if (reminder.userId !== userId) {
      throw new Error("Access denied");
    }

    await this.reminderRepository.delete(id);
    await this.emitReminderDeleted(reminder);
    return reminder;
  }
}
