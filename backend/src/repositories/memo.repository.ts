import { prisma } from "../config/prisma.js";
import {
  Memo,
  MemoRecipient,
  Attachment,
  Tag,
  Comment,
  Reaction,
} from "@prisma/client";

export interface CreateMemoData {
  slug?: string;
  title: string;
  body: string;
  creatorId: string;
  groupId?: string;
  status?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  visibility: string;
  recipientIds?: string[];
  tagIds?: string[];
  attachmentIds?: string[];
  referencedMemoIds?: string[];
  workflow?: any;
}

export interface UpdateMemoData {
  title?: string;
  body?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  visibility?: string;
  recipientIds?: string[];
  status?: string;
  previousStatus?: string;
  pinned?: boolean;
  archived?: boolean;
  tagIds?: string[];
  attachmentIds?: string[];
  starredBy?: any;
  hiddenBy?: any;
  referencedMemoIds?: string[];
  workflow?: any;
}

export interface MemoFilters {
  creatorId?: string;
  visibility?: string;
  viewerId?: string;
  status?: string;
  recipientId?: string;
  tagId?: string;
  search?: string;
  searchIn?: "all" | "title" | "body" | "comments" | "creator";
  pinned?: boolean;
  archived?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
  priority?: "low" | "medium" | "high" | "urgent";
  hasAttachments?: boolean;
  department?: string;
}

export class MemoRepository {
  async findAll(filters: MemoFilters = {}, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.creatorId) where.creatorId = filters.creatorId;
    if (filters.visibility) where.visibility = filters.visibility;
    if (filters.status) where.status = filters.status;
    if (filters.pinned !== undefined) where.pinned = filters.pinned;
    if (filters.archived !== undefined) where.archived = filters.archived;
    if (filters.createdAfter) where.createdAt = { gte: filters.createdAfter };
    if (filters.createdBefore)
      where.createdAt = { ...where.createdAt, lte: filters.createdBefore };

    if (filters.viewerId) {
      if (!filters.visibility) {
        where.AND = [
          ...(where.AND || []),
          {
            OR: [
              { visibility: "public" },
              {
                AND: [
                  { visibility: "private" },
                  {
                    OR: [
                      { creatorId: filters.viewerId },
                      {
                        recipients: {
                          some: { userId: filters.viewerId },
                        },
                      },
                    ],
                  },
                ],
              },
              {
                AND: [
                  { visibility: { in: ["department", "protected"] } },
                  { creatorId: filters.viewerId },
                ],
              },
            ],
          },
        ];
      } else if (
        filters.visibility === "department" ||
        filters.visibility === "protected"
      ) {
        where.AND = [...(where.AND || []), { creatorId: filters.viewerId }];
      } else if (filters.visibility !== "public") {
        where.AND = [
          ...(where.AND || []),
          {
            OR: [
              { creatorId: filters.viewerId },
              {
                recipients: {
                  some: { userId: filters.viewerId },
                },
              },
            ],
          },
        ];
      }
    }

    // Handle recipient filtering
    if (filters.recipientId) {
      where.recipients = {
        some: {
          userId: filters.recipientId,
        },
      };
    }

    // Handle tag filtering
    if (filters.tagId) {
      where.tags = {
        some: {
          tagId: filters.tagId,
        },
      };
    }

    // Handle search with advanced options
    if (filters.search) {
      const searchTerm = filters.search;
      const searchIn = filters.searchIn || "all";

      if (searchIn === "title") {
        where.title = { contains: searchTerm, mode: "insensitive" };
      } else if (searchIn === "body") {
        where.body = { contains: searchTerm, mode: "insensitive" };
      } else if (searchIn === "creator") {
        where.creator = {
          OR: [
            { name: { contains: searchTerm, mode: "insensitive" } },
            { email: { contains: searchTerm, mode: "insensitive" } },
          ],
        };
      } else if (searchIn === "comments") {
        where.comments = {
          some: {
            body: { contains: searchTerm, mode: "insensitive" },
          },
        };
      } else {
        // Search in all fields
        where.OR = [
          { title: { contains: searchTerm, mode: "insensitive" } },
          { body: { contains: searchTerm, mode: "insensitive" } },
          {
            creator: {
              OR: [
                { name: { contains: searchTerm, mode: "insensitive" } },
                { email: { contains: searchTerm, mode: "insensitive" } },
              ],
            },
          },
          {
            comments: {
              some: {
                body: { contains: searchTerm, mode: "insensitive" },
              },
            },
          },
        ];
      }
    }

    // Handle date range filtering for updates
    if (filters.updatedAfter || filters.updatedBefore) {
      where.updatedAt = {};
      if (filters.updatedAfter) where.updatedAt.gte = filters.updatedAfter;
      if (filters.updatedBefore) where.updatedAt.lte = filters.updatedBefore;
    }

    // Handle priority filtering (assuming priority is stored in the memo data)
    if (filters.priority) {
      where.priority = filters.priority;
    }

    // Handle attachment filtering
    if (filters.hasAttachments !== undefined) {
      where.attachments = {
        [filters.hasAttachments ? "some" : "none"]: {},
      };
    }

    // Handle department filtering
    if (filters.department) {
      where.creator = {
        ...where.creator,
        department: filters.department,
      };
    }

    const [memos, total] = await Promise.all([
      prisma.memo.findMany({
        where,
        include: {
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              department: true,
            },
          },
          recipients: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatar: true,
                  department: true,
                },
              },
            },
          },
          tags: {
            include: {
              tag: true,
            },
          },
          attachments: true,
          comments: {
            include: {
              author: {
                select: { id: true, name: true, email: true, avatar: true },
              },
              attachments: true,
            },
            orderBy: { createdAt: "asc" },
          },
          reactions: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatar: true },
              },
            },
          },
          _count: {
            select: { comments: true, reactions: true, recipients: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.memo.count({ where }),
    ]);

    return {
      memos,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    return prisma.memo.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            department: true,
          },
        },
        recipients: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                department: true,
              },
            },
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
        attachments: true,
        comments: {
          include: {
            author: {
              select: { id: true, name: true, email: true, avatar: true },
            },
            attachments: true,
          },
          orderBy: { createdAt: "asc" },
        },
        reactions: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
        },
        _count: {
          select: { comments: true, reactions: true, recipients: true },
        },
      },
    });
  }

  async findByIdOrSlug(idOrSlug: string) {
    return prisma.memo.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            department: true,
          },
        },
        recipients: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                department: true,
              },
            },
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
        attachments: true,
        comments: {
          include: {
            author: {
              select: { id: true, name: true, email: true, avatar: true },
            },
            attachments: true,
          },
          orderBy: { createdAt: "asc" },
        },
        reactions: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
        },
        _count: {
          select: { comments: true, reactions: true, recipients: true },
        },
      },
    });
  }

  async create(data: CreateMemoData) {
    const {
      recipientIds = [],
      tagIds = [],
      attachmentIds = [],
      ...memoData
    } = data;

    return prisma.memo.create({
      data: {
        ...memoData,
        recipients: {
          create: recipientIds.map((userId) => ({ userId })),
        },
        tags: {
          create: tagIds.map((tagId) => ({ tagId })),
        },
        attachments: {
          connect: attachmentIds.map((id) => ({ id })),
        },
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            department: true,
          },
        },
        recipients: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                department: true,
              },
            },
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
        attachments: true,
      },
    });
  }

  async update(id: string, data: UpdateMemoData) {
    const { tagIds, attachmentIds, recipientIds, ...memoData } = data;

    const updateData: any = { ...memoData };

    if (tagIds !== undefined) {
      // Delete existing tags and create new ones
      await prisma.memoTag.deleteMany({ where: { memoId: id } });
      updateData.tags = {
        create: tagIds.map((tagId) => ({ tagId })),
      };
    }

    if (attachmentIds !== undefined) {
      // Disconnect existing attachments and connect new ones
      await prisma.memo.update({
        where: { id },
        data: {
          attachments: {
            set: [], // Disconnect all
          },
        },
      });
      updateData.attachments = {
        connect: attachmentIds.map((id) => ({ id })),
      };
    }

    if (recipientIds !== undefined) {
      await prisma.memoRecipient.deleteMany({ where: { memoId: id } });
      updateData.recipients = {
        create: recipientIds.map((userId) => ({ userId })),
      };
    }

    return prisma.memo.update({
      where: { id },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            department: true,
          },
        },
        recipients: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                department: true,
              },
            },
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
        attachments: true,
      },
    });
  }

  async delete(id: string) {
    // Delete related data first due to foreign key constraints
    await prisma.memoRecipient.deleteMany({ where: { memoId: id } });
    await prisma.memoTag.deleteMany({ where: { memoId: id } });
    await prisma.reaction.deleteMany({ where: { memoId: id } });
    await prisma.comment.deleteMany({ where: { memoId: id } });

    return prisma.memo.delete({ where: { id } });
  }

  async updateRecipientStatus(
    memoId: string,
    userId: string,
    status: {
      opened?: boolean;
      acknowledged?: boolean;
      approved?: boolean;
      replied?: boolean;
    },
  ) {
    const updateData: any = {};

    if (status.opened !== undefined) {
      updateData.opened = status.opened;
      if (status.opened) updateData.openedAt = new Date();
      else updateData.openedAt = null;
    }

    if (status.acknowledged !== undefined) {
      updateData.acknowledged = status.acknowledged;
      if (status.acknowledged) updateData.acknowledgedAt = new Date();
      else updateData.acknowledgedAt = null;
    }

    if (status.approved !== undefined) {
      updateData.approved = status.approved;
      if (status.approved) updateData.approvedAt = new Date();
      else updateData.approvedAt = null;
    }

    if (status.replied !== undefined) {
      updateData.replied = status.replied;
      if (status.replied) updateData.repliedAt = new Date();
      else updateData.repliedAt = null;
    }

    return prisma.memoRecipient.update({
      where: {
        memoId_userId: {
          memoId,
          userId,
        },
      },
      data: updateData,
    });
  }

  async addReaction(memoId: string, userId: string, emoji: string) {
    return prisma.reaction.create({
      data: {
        memoId,
        userId,
        emoji,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });
  }

  async removeReaction(memoId: string, userId: string, emoji: string) {
    return prisma.reaction.deleteMany({
      where: {
        memoId,
        userId,
        emoji,
      },
    });
  }

  async getReactions(memoId: string) {
    return prisma.reaction.findMany({
      where: { memoId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });
  }
}
