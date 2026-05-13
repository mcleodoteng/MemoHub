import { prisma } from "../config/prisma.js";
import { Message, Conversation } from "@prisma/client";

export interface CreateMessageData {
  conversationId: string;
  senderId: string;
  body?: string;
  attachmentIds?: string[];
  attachments?: any[];
  sharedMemoId?: string;
  sharedMemoTitle?: string;
  isSystem?: boolean;
}

export interface UpdateMessageData {
  body?: string;
  attachmentIds?: string[];
  attachments?: any[];
  isStarred?: boolean;
  starredBy?: string[];
  reactions?: any;
  isEdited?: boolean;
  editedAt?: Date | null;
  isDeleted?: boolean;
  deletedAt?: Date | null;
  sharedMemo?: any;
}

export interface MessageFilters {
  conversationId?: string;
  senderId?: string;
  isSystem?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
}

export class MessageRepository {
  async findStarredByUser(userId: string, page = 1, limit = 100) {
    const skip = (page - 1) * limit;

    const allStarredMessages = await prisma.message.findMany({
      where: {
        starred: true,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            department: true,
          },
        },
        conversation: {
          select: {
            participantIds: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const matchingMessages = allStarredMessages.filter((message) => {
      const starredBy = Array.isArray(message.starredBy)
        ? (message.starredBy as string[])
        : [];
      const participantIds = Array.isArray(message.conversation?.participantIds)
        ? (message.conversation.participantIds as string[])
        : [];

      return starredBy.includes(userId) && participantIds.includes(userId);
    });

    const messages = matchingMessages.slice(skip, skip + limit);
    const total = matchingMessages.length;

    return {
      messages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findAll(filters: MessageFilters = {}, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.conversationId) where.conversationId = filters.conversationId;
    if (filters.senderId) where.senderId = filters.senderId;
    if (filters.isSystem !== undefined) where.isSystem = filters.isSystem;
    if (filters.createdAfter) where.createdAt = { gte: filters.createdAfter };
    if (filters.createdBefore)
      where.createdAt = { ...where.createdAt, lte: filters.createdBefore };

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              department: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.message.count({ where }),
    ]);

    return {
      messages: messages.reverse(),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    return prisma.message.findUnique({
      where: { id },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            department: true,
          },
        },
        conversation: {
          select: { id: true, type: true, name: true },
        },
      },
    });
  }

  async findByConversationId(conversationId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              department: true,
            },
          },
        },
        // Fetch latest messages first so active chats always include newest items.
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.message.count({ where: { conversationId } }),
    ]);

    return {
      // Return in chronological order for rendering in the chat window.
      messages: messages.reverse(),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async create(data: CreateMessageData) {
    const {
      attachmentIds: _attachmentIds,
      attachments = [],
      sharedMemoId,
      sharedMemoTitle: _sharedMemoTitle,
      ...messageData
    } = data;

    const createData: any = {
      ...messageData,
      body: typeof messageData.body === "string" ? messageData.body : "",
      attachments,
    };

    if (sharedMemoId) {
      createData.sharedMemo = {
        memoId: sharedMemoId,
        title: data.sharedMemoTitle || "",
      };
    }

    return prisma.message.create({
      data: createData,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            department: true,
          },
        },
      },
    });
  }

  async update(id: string, data: UpdateMessageData) {
    const { attachmentIds, attachments, isStarred, starredBy, ...messageData } =
      data;

    const updateData: any = { ...messageData };

    if (attachments !== undefined) {
      updateData.attachments = attachments;
    } else if (attachmentIds !== undefined) {
      updateData.attachments = [];
    }

    if (isStarred !== undefined) {
      updateData.starred = isStarred;
    }

    if (starredBy !== undefined) {
      updateData.starredBy = starredBy;
    }

    return prisma.message.update({
      where: { id },
      data: updateData,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            department: true,
          },
        },
      },
    });
  }

  async delete(id: string) {
    return prisma.message.update({
      where: { id },
      data: {
        body: "This message was deleted",
        attachments: [],
        reactions: [],
        sharedMemo: null,
        isDeleted: true,
        deletedAt: new Date(),
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            department: true,
          },
        },
      },
    });
  }

  async markAsRead(messageId: string, userId: string) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new Error("Message not found");
    }

    const readBy = (message.readBy as string[]) || [];

    if (!readBy.includes(userId)) {
      readBy.push(userId);
    }

    return prisma.message.update({
      where: { id: messageId },
      data: { readBy },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            department: true,
          },
        },
      },
    });
  }

  async addReaction(messageId: string, emoji: string) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new Error("Message not found");
    }

    const reactions = (message.reactions as any[]) || [];

    reactions.push({
      emoji,
      count: 1,
      users: [],
    });

    return prisma.message.update({
      where: { id: messageId },
      data: { reactions },
      include: {
        sender: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });
  }

  async removeReaction(messageId: string, emoji: string) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new Error("Message not found");
    }

    const reactions = ((message.reactions as any[]) || []).filter(
      (r) => r.emoji !== emoji,
    );

    return prisma.message.update({
      where: { id: messageId },
      data: { reactions },
      include: {
        sender: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });
  }

  async getReactions(messageId: string) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { reactions: true },
    });

    if (!message) {
      throw new Error("Message not found");
    }

    return message.reactions || [];
  }

  async addThread(messageId: string, userId: string, replyContent: string) {
    return prisma.thread.create({
      data: {
        messageId,
        userId,
        replyContent,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });
  }

  async getThreads(messageId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [threads, total] = await Promise.all([
      prisma.thread.findMany({
        where: { messageId },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.thread.count({ where: { messageId } }),
    ]);

    return {
      threads,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async deleteThread(threadId: string) {
    return prisma.thread.delete({ where: { id: threadId } });
  }
}
