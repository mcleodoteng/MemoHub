import {
  MessageRepository,
  CreateMessageData,
  UpdateMessageData,
  MessageFilters,
} from "../repositories/message.repository.js";
import { ConversationRepository } from "../repositories/conversation.repository.js";
import { prisma } from "../config/prisma.js";
import { MESSAGE_BODY_MAX_LENGTH } from "../constants/content-limits.js";

export class MessageService {
  private messageRepository: MessageRepository;
  private conversationRepository: ConversationRepository;

  constructor() {
    this.messageRepository = new MessageRepository();
    this.conversationRepository = new ConversationRepository();
  }

  async getMessages(filters: MessageFilters = {}, page = 1, limit = 50) {
    const result = await this.messageRepository.findAll(filters, page, limit);

    const messages = result.messages.map((msg) => ({
      id: msg.id,
      conversationId: msg.conversationId,
      sender: msg.sender,
      body: msg.body,
      attachments: msg.attachments,
      reactions: msg.reactions,
      sharedMemo: msg.sharedMemo,
      readBy: msg.readBy,
      isEdited: msg.isEdited,
      editedAt: msg.editedAt,
      isDeleted: msg.isDeleted,
      deletedAt: msg.deletedAt,
      isSystem: msg.isSystem,
      starred: msg.starred,
      starredBy: msg.starredBy,
      createdAt: msg.createdAt,
    }));

    return {
      messages,
      pagination: result.pagination,
    };
  }

  async getMessageById(id: string) {
    const message = await this.messageRepository.findById(id);

    if (!message) {
      throw new Error("Message not found");
    }

    return {
      id: message.id,
      conversationId: message.conversationId,
      sender: message.sender,
      body: message.body,
      attachments: message.attachments,
      reactions: message.reactions,
      sharedMemo: message.sharedMemo,
      readBy: message.readBy,
      isEdited: message.isEdited,
      editedAt: message.editedAt,
      isDeleted: message.isDeleted,
      deletedAt: message.deletedAt,
      isSystem: message.isSystem,
      starred: message.starred,
      starredBy: message.starredBy,
      conversation: message.conversation,
      createdAt: message.createdAt,
    };
  }

  async getConversationMessages(conversationId: string, page = 1, limit = 50) {
    // Verify conversation exists
    const conversation =
      await this.conversationRepository.findById(conversationId);

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const result = await this.messageRepository.findByConversationId(
      conversationId,
      page,
      limit,
    );

    const messages = result.messages.map((msg) => ({
      id: msg.id,
      conversationId: msg.conversationId,
      sender: msg.sender,
      body: msg.body,
      attachments: msg.attachments,
      reactions: msg.reactions,
      sharedMemo: msg.sharedMemo,
      readBy: msg.readBy,
      isEdited: msg.isEdited,
      editedAt: msg.editedAt,
      isDeleted: msg.isDeleted,
      deletedAt: msg.deletedAt,
      isSystem: msg.isSystem,
      starred: msg.starred,
      starredBy: msg.starredBy,
      createdAt: msg.createdAt,
    }));

    return {
      messages,
      pagination: result.pagination,
    };
  }

  async getStarredMessagesForUser(userId: string, page = 1, limit = 100) {
    const result = await this.messageRepository.findStarredByUser(
      userId,
      page,
      limit,
    );

    const messages = result.messages.map((msg) => ({
      id: msg.id,
      conversationId: msg.conversationId,
      sender: msg.sender,
      body: msg.body,
      attachments: msg.attachments,
      reactions: msg.reactions,
      sharedMemo: msg.sharedMemo,
      readBy: msg.readBy,
      isEdited: msg.isEdited,
      editedAt: msg.editedAt,
      isDeleted: msg.isDeleted,
      deletedAt: msg.deletedAt,
      isSystem: msg.isSystem,
      starred: msg.starred,
      starredBy: msg.starredBy,
      createdAt: msg.createdAt,
    }));

    return {
      messages,
      pagination: result.pagination,
    };
  }

  async createMessage(data: CreateMessageData) {
    if (
      typeof data.body === "string" &&
      data.body.length > MESSAGE_BODY_MAX_LENGTH
    ) {
      throw new Error(
        `Message is too long. Please keep it under ${MESSAGE_BODY_MAX_LENGTH} characters.`,
      );
    }

    // Verify conversation exists
    const conversation = await this.conversationRepository.findById(
      data.conversationId,
    );

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Verify sender is a participant
    const participants = (conversation.participantIds as string[]) || [];
    if (!participants.includes(data.senderId)) {
      throw new Error("User is not a participant in this conversation");
    }

    // Verify sender exists
    const sender = await prisma.user.findUnique({
      where: { id: data.senderId },
      select: { id: true },
    });

    if (!sender) {
      throw new Error("Sender not found");
    }

    // Validate attachments if provided
    let resolvedAttachments: Array<{
      id: string;
      name: string;
      type: string;
      size: number;
      url: string;
    }> = [];

    if (data.attachmentIds?.length) {
      const attachments = await prisma.attachment.findMany({
        where: { id: { in: data.attachmentIds } },
        select: {
          id: true,
          name: true,
          type: true,
          size: true,
          url: true,
        },
      });

      if (attachments.length !== data.attachmentIds.length) {
        throw new Error("One or more attachments not found");
      }

      resolvedAttachments = attachments;
    }

    // Validate shared memo if provided
    let sharedMemoTitle: string | undefined;
    if (data.sharedMemoId) {
      const memo = await prisma.memo.findUnique({
        where: { id: data.sharedMemoId },
        select: { id: true, title: true },
      });

      if (!memo) {
        throw new Error("Shared memo not found");
      }
      sharedMemoTitle = memo.title;
    }

    const message = await this.messageRepository.create({
      ...data,
      attachments: resolvedAttachments,
      sharedMemoTitle,
    });

    // Update conversation's updatedAt timestamp
    await prisma.conversation.update({
      where: { id: data.conversationId },
      data: { updatedAt: new Date() },
    });

    return {
      id: message.id,
      conversationId: message.conversationId,
      sender: message.sender,
      body: message.body,
      attachments: message.attachments,
      sharedMemo: message.sharedMemo,
      createdAt: message.createdAt,
    };
  }

  async updateMessage(id: string, data: UpdateMessageData, userId: string) {
    if (
      typeof data.body === "string" &&
      data.body.length > MESSAGE_BODY_MAX_LENGTH
    ) {
      throw new Error(
        `Message is too long. Please keep it under ${MESSAGE_BODY_MAX_LENGTH} characters.`,
      );
    }

    const existing = await this.messageRepository.findById(id);

    if (!existing) {
      throw new Error("Message not found");
    }

    if (existing.sender.id !== userId) {
      throw new Error("Only the sender can update this message");
    }

    if (existing.isDeleted) {
      throw new Error("Cannot edit a deleted message");
    }

    // Validate attachments if provided
    let resolvedAttachments: Array<{
      id: string;
      name: string;
      type: string;
      size: number;
      url: string;
    }> | null = null;

    if (data.attachmentIds?.length) {
      const attachments = await prisma.attachment.findMany({
        where: { id: { in: data.attachmentIds } },
        select: {
          id: true,
          name: true,
          type: true,
          size: true,
          url: true,
        },
      });

      if (attachments.length !== data.attachmentIds.length) {
        throw new Error("One or more attachments not found");
      }

      resolvedAttachments = attachments;
    }

    const message = await this.messageRepository.update(id, {
      ...data,
      attachments:
        resolvedAttachments === null ? undefined : resolvedAttachments,
      isEdited: true,
      editedAt: new Date(),
    });

    await prisma.conversation.update({
      where: { id: message.conversationId },
      data: { updatedAt: new Date() },
    });

    return {
      id: message.id,
      conversationId: message.conversationId,
      sender: message.sender,
      body: message.body,
      attachments: message.attachments,
      isEdited: message.isEdited,
      editedAt: message.editedAt,
      isDeleted: message.isDeleted,
      deletedAt: message.deletedAt,
      createdAt: message.createdAt,
    };
  }

  async deleteMessage(id: string, userId: string) {
    const existing = await this.messageRepository.findById(id);

    if (!existing) {
      throw new Error("Message not found");
    }

    if (existing.sender.id !== userId) {
      throw new Error("Only the sender can delete this message");
    }

    const deletedMessage = await this.messageRepository.delete(id);

    await prisma.conversation.update({
      where: { id: deletedMessage.conversationId },
      data: { updatedAt: new Date() },
    });

    return {
      id: deletedMessage.id,
      conversationId: deletedMessage.conversationId,
      sender: deletedMessage.sender,
      body: deletedMessage.body,
      attachments: deletedMessage.attachments,
      reactions: deletedMessage.reactions,
      sharedMemo: deletedMessage.sharedMemo,
      readBy: deletedMessage.readBy,
      isEdited: deletedMessage.isEdited,
      editedAt: deletedMessage.editedAt,
      isDeleted: deletedMessage.isDeleted,
      deletedAt: deletedMessage.deletedAt,
      isSystem: deletedMessage.isSystem,
      starred: deletedMessage.starred,
      starredBy: deletedMessage.starredBy,
      createdAt: deletedMessage.createdAt,
    };
  }

  async markMessageAsRead(messageId: string, userId: string) {
    return this.messageRepository.markAsRead(messageId, userId);
  }

  async addThreadReply(
    messageId: string,
    userId: string,
    replyContent: string,
  ) {
    // Verify message exists
    const message = await this.messageRepository.findById(messageId);

    if (!message) {
      throw new Error("Message not found");
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    return this.messageRepository.addThread(messageId, userId, replyContent);
  }

  async getThreadReplies(messageId: string, page = 1, limit = 20) {
    // Verify message exists
    const message = await this.messageRepository.findById(messageId);

    if (!message) {
      throw new Error("Message not found");
    }

    return this.messageRepository.getThreads(messageId, page, limit);
  }

  async deleteThreadReply(threadId: string, userId: string) {
    const thread = await prisma.thread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      throw new Error("Thread not found");
    }

    if (thread.userId !== userId) {
      throw new Error("Only the author can delete this reply");
    }

    return this.messageRepository.deleteThread(threadId);
  }

  async starMessage(messageId: string, userId: string) {
    const existing = await this.messageRepository.findById(messageId);

    if (!existing) {
      throw new Error("Message not found");
    }

    const starredBy = ((existing.starredBy as string[]) || []).includes(userId)
      ? (existing.starredBy as string[])
      : [...((existing.starredBy as string[]) || []), userId];

    return this.messageRepository.update(messageId, {
      isStarred: true,
      starredBy,
    });
  }

  async unstarMessage(messageId: string, userId: string) {
    const existing = await this.messageRepository.findById(messageId);

    if (!existing) {
      throw new Error("Message not found");
    }

    const starredBy = ((existing.starredBy as string[]) || []).filter(
      (id) => id !== userId,
    );

    return this.messageRepository.update(messageId, {
      isStarred: starredBy.length > 0,
      starredBy,
    });
  }

  async addReaction(messageId: string, userId: string, emoji: string) {
    const message = await this.messageRepository.findById(messageId);
    if (!message) {
      return null;
    }

    if (message.isDeleted) {
      return message;
    }

    // Get existing reactions
    const reactions = (message.reactions as any[]) || [];

    // Check if user already reacted with this emoji
    let updated = false;
    const newReactions = reactions.map((r) => {
      if (r.emoji === emoji) {
        const users = (r.users || []) as string[];
        if (!users.includes(userId)) {
          updated = true;
          return { ...r, users: [...users, userId] };
        }
        return r;
      }
      return r;
    });

    // If emoji doesn't exist yet, create it
    if (!newReactions.some((r) => r.emoji === emoji)) {
      newReactions.push({ emoji, users: [userId] });
      updated = true;
    }

    if (updated) {
      return this.messageRepository.update(messageId, {
        reactions: newReactions as any,
      });
    }

    return message;
  }

  async removeReaction(messageId: string, userId: string, emoji: string) {
    const message = await this.messageRepository.findById(messageId);
    if (!message) {
      return null;
    }

    if (message.isDeleted) {
      return message;
    }

    // Get existing reactions
    const reactions = (message.reactions as any[]) || [];

    const newReactions = reactions
      .map((r) => {
        if (r.emoji === emoji) {
          const users = ((r.users || []) as string[]).filter(
            (id) => id !== userId,
          );
          return { ...r, users };
        }
        return r;
      })
      .filter((r) => (r.users || []).length > 0); // Remove reactions with no users

    return this.messageRepository.update(messageId, {
      reactions: newReactions as any,
    });
  }
}
