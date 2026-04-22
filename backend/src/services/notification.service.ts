import {
  NotificationRepository,
  CreateNotificationData,
  NotificationFilters,
} from "../repositories/notification.repository.js";
import { io } from "../server.js";

export class NotificationService {
  private notificationRepository: NotificationRepository;

  constructor() {
    this.notificationRepository = new NotificationRepository();
  }

  async createNotification(data: CreateNotificationData) {
    const notification = await this.notificationRepository.create(data);

    // Emit real-time notification to user
    io.to(`user_${data.userId}`).emit("notification:new", notification);

    return notification;
  }

  async getNotifications(
    userId: string,
    filters: Omit<NotificationFilters, "userId"> = {},
  ) {
    return this.notificationRepository.findByUserId(userId, filters);
  }

  async getNotificationById(id: string) {
    return this.notificationRepository.findById(id);
  }

  async markAsRead(id: string, userId: string) {
    const result = await this.notificationRepository.markAsRead(id, userId);
    if (result.count > 0) {
      // Emit update to user
      io.to(`user_${userId}`).emit("notification:read", { id });
    }
    return result;
  }

  async markAllAsRead(userId: string) {
    const result = await this.notificationRepository.markAllAsRead(userId);
    if (result.count > 0) {
      // Emit update to user
      io.to(`user_${userId}`).emit("notification:all_read");
    }
    return result;
  }

  async getUnreadCount(userId: string) {
    return this.notificationRepository.countUnread(userId);
  }

  async deleteNotification(id: string, userId: string) {
    return this.notificationRepository.delete(id, userId);
  }

  async deleteAllNotifications(userId: string) {
    return this.notificationRepository.deleteAll(userId);
  }

  // Helper methods for creating specific types of notifications
  async notifyNewMemo(
    memoId: string,
    memoTitle: string,
    recipientIds: string[],
    senderName: string,
  ) {
    const notifications = recipientIds.map((recipientId) => ({
      userId: recipientId,
      type: "memo_received",
      title: "New Memo",
      body: `${senderName} sent you a memo: "${memoTitle}"`,
      actionUrl: `/memos/${memoId}`,
    }));

    return Promise.all(
      notifications.map((data) => this.createNotification(data)),
    );
  }

  async notifyNewComment(
    memoId: string,
    memoTitle: string,
    commentId: string,
    commenterName: string,
    recipientIds: string[],
    options?: {
      isReply?: boolean;
      repliedToName?: string;
    },
  ) {
    const notifications = recipientIds.map((recipientId) => ({
      userId: recipientId,
      type: "comment_added",
      title: options?.isReply ? "New Reply" : "New Comment",
      body: options?.isReply
        ? `${commenterName} replied${options.repliedToName ? ` to ${options.repliedToName}` : ""} on your memo "${memoTitle}"`
        : `${commenterName} commented on your memo "${memoTitle}"`,
      actionUrl: `/memos/${memoId}#comment-${commentId}`,
    }));

    return Promise.all(
      notifications.map((data) => this.createNotification(data)),
    );
  }

  async notifyNewMessage(
    conversationId: string,
    senderName: string,
    recipientIds: string[],
    options?: {
      isGroup?: boolean;
      conversationName?: string;
      messageBody?: string;
    },
  ) {
    const groupName = options?.conversationName || "this group";

    const notifications = recipientIds.map((recipientId) => ({
      userId: recipientId,
      type: "message_received",
      title: options?.isGroup
        ? `New update in ${groupName}`
        : `New message from ${senderName}`,
      body: options?.isGroup
        ? `${senderName} sent a group message in ${groupName}`
        : `${senderName} sent you a message`,
      actionUrl: `/messages?conversationId=${conversationId}`,
    }));

    return Promise.all(
      notifications.map((data) => this.createNotification(data)),
    );
  }

  async notifyMention(
    userId: string,
    mentionerName: string,
    contentType: string,
    contentId: string,
  ) {
    return this.createNotification({
      userId,
      type: "mention",
      title: "You were mentioned",
      body: `${mentionerName} mentioned you in a ${contentType}`,
      actionUrl: `/${contentType}s/${contentId}`,
    });
  }

  async notifyReaction(
    userId: string,
    reactorName: string,
    emoji: string,
    contentType: string,
    contentId: string,
  ) {
    return this.createNotification({
      userId,
      type: "reaction_added",
      title: "New Like",
      body: `${reactorName} liked your ${contentType} with ${emoji}`,
      actionUrl: `/${contentType}s/${contentId}`,
    });
  }
}
