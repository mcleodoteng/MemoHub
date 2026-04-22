import { prisma } from "../config/prisma.js";
import { Conversation } from "@prisma/client";

export interface CreateConversationData {
  type: "direct" | "group";
  participantIds: string[];
  name?: string;
  groupId?: string;
}

export interface UpdateConversationData {
  name?: string;
  participantIds?: string[];
}

export interface ConversationFilters {
  type?: "direct" | "group";
  createdAfter?: Date;
  createdBefore?: Date;
}

export class ConversationRepository {
  async findByGroupId(groupId: string) {
    return prisma.conversation.findFirst({
      where: {
        type: "group",
        groupId,
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async findAll(filters: ConversationFilters = {}, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.type) where.type = filters.type;
    if (filters.createdAfter) where.createdAt = { gte: filters.createdAfter };
    if (filters.createdBefore)
      where.createdAt = { ...where.createdAt, lte: filters.createdBefore };

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          messages: {
            select: {
              id: true,
              body: true,
              senderId: true,
              readBy: true,
              attachments: true,
              reactions: true,
              sharedMemo: true,
              isSystem: true,
              isEdited: true,
              editedAt: true,
              isDeleted: true,
              deletedAt: true,
              starredBy: true,
              createdAt: true,
              sender: {
                select: { name: true, avatar: true },
              },
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          _count: {
            select: { messages: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.conversation.count({ where }),
    ]);

    return {
      conversations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    return prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: {
          select: { messages: true },
        },
      },
    });
  }

  async findByParticipants(participantIds: string[]) {
    // Find direct conversation between participants
    const participantIdsSorted = [...participantIds].sort();

    const conversations = await prisma.conversation.findMany({
      where: {
        type: "direct",
      },
    });

    // Filter conversations where participant IDs match
    const matching = conversations.filter((conv) => {
      const convParticipants = (conv.participantIds as string[]).sort();
      return (
        convParticipants.length === participantIdsSorted.length &&
        convParticipants.every((id, i) => id === participantIdsSorted[i])
      );
    });

    return matching[0] || null;
  }

  async create(data: CreateConversationData) {
    return prisma.conversation.create({
      data: {
        type: data.type,
        participantIds: data.participantIds,
        name: data.name,
        groupId: data.groupId,
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
  }

  async update(id: string, data: UpdateConversationData) {
    return prisma.conversation.update({
      where: { id },
      data: {
        name: data.name,
        participantIds: data.participantIds,
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
  }

  async delete(id: string) {
    // Delete all messages in the conversation first
    await prisma.message.deleteMany({
      where: { conversationId: id },
    });

    // Delete the conversation
    return prisma.conversation.delete({ where: { id } });
  }

  async getOrCreateDirectConversation(userId: string, otherUserId: string) {
    // Check if direct conversation already exists
    const existing = await this.findByParticipants([userId, otherUserId]);

    if (existing) {
      return existing;
    }

    // Create new direct conversation
    return this.create({
      type: "direct",
      participantIds: [userId, otherUserId],
    });
  }

  async getOrCreateGroupConversation(
    groupId: string,
    participantIds: string[],
    name?: string,
  ) {
    const existing = await this.findByGroupId(groupId);
    const normalizedParticipants = Array.from(new Set(participantIds));

    if (existing) {
      const currentParticipants = (
        (existing.participantIds as string[]) || []
      ).filter(Boolean);
      const mergedParticipants = Array.from(
        new Set([...currentParticipants, ...normalizedParticipants]),
      );

      const shouldUpdateParticipants =
        mergedParticipants.length !== currentParticipants.length ||
        mergedParticipants.some((id) => !currentParticipants.includes(id));
      const shouldUpdateName = Boolean(name && name !== existing.name);

      if (shouldUpdateParticipants || shouldUpdateName) {
        return prisma.conversation.update({
          where: { id: existing.id },
          data: {
            participantIds: shouldUpdateParticipants
              ? mergedParticipants
              : currentParticipants,
            ...(shouldUpdateName ? { name } : {}),
          },
          include: {
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        });
      }

      return existing;
    }

    return this.create({
      type: "group",
      participantIds: normalizedParticipants,
      name,
      groupId,
    });
  }

  async addParticipant(conversationId: string, userId: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const participants = (conversation.participantIds as string[]) || [];

    if (!participants.includes(userId)) {
      participants.push(userId);
    }

    return prisma.conversation.update({
      where: { id: conversationId },
      data: { participantIds: participants },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
  }

  async removeParticipant(conversationId: string, userId: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const participants = (
      (conversation.participantIds as string[]) || []
    ).filter((id) => id !== userId);

    return prisma.conversation.update({
      where: { id: conversationId },
      data: { participantIds: participants },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
  }

  async getUserConversations(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const conversations = await prisma.conversation.findMany({
      where: {
        participantIds: {
          array_contains: userId,
        },
      },
      include: {
        messages: {
          select: {
            id: true,
            body: true,
            senderId: true,
            readBy: true,
            attachments: true,
            reactions: true,
            sharedMemo: true,
            starredBy: true,
            isSystem: true,
            isEdited: true,
            editedAt: true,
            isDeleted: true,
            deletedAt: true,
            createdAt: true,
            sender: {
              select: { name: true, avatar: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    });

    const total = await prisma.conversation.count({
      where: {
        participantIds: {
          array_contains: userId,
        } as any,
      },
    });

    return {
      conversations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}
