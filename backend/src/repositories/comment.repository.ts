import { prisma } from "../config/prisma.js";
import { Comment, Attachment } from "@prisma/client";

export interface CreateCommentData {
  memoId: string;
  authorId: string;
  body: string;
  parentId?: string;
  attachmentIds?: string[];
}

export interface UpdateCommentData {
  body?: string;
  attachmentIds?: string[];
  pinned?: boolean;
  pinnedBy?: string | null;
}

export interface CommentFilters {
  memoId?: string;
  authorId?: string;
  parentId?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

export class CommentRepository {
  async findAll(filters: CommentFilters = {}, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.memoId) where.memoId = filters.memoId;
    if (filters.authorId) where.authorId = filters.authorId;
    if (filters.parentId !== undefined) where.parentId = filters.parentId;
    if (filters.createdAfter) where.createdAt = { gte: filters.createdAfter };
    if (filters.createdBefore)
      where.createdAt = { ...where.createdAt, lte: filters.createdBefore };

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              department: true,
            },
          },
          attachments: true,
          commentReactions: {
            select: {
              userId: true,
              emoji: true,
              createdAt: true,
            },
          },
          _count: {
            select: { attachments: true },
          },
        },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.comment.count({ where }),
    ]);

    return {
      comments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    return prisma.comment.findUnique({
      where: { id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            department: true,
          },
        },
        memo: {
          select: { id: true, title: true, creatorId: true },
        },
        attachments: true,
        commentReactions: {
          select: {
            userId: true,
            emoji: true,
            createdAt: true,
          },
        },
        _count: {
          select: { attachments: true },
        },
      },
    });
  }

  async findByMemoId(memoId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where: { memoId },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              department: true,
            },
          },
          attachments: true,
          commentReactions: {
            select: {
              userId: true,
              emoji: true,
              createdAt: true,
            },
          },
          _count: {
            select: { attachments: true },
          },
        },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.comment.count({ where: { memoId } }),
    ]);

    return {
      comments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async create(data: CreateCommentData) {
    const { attachmentIds = [], ...commentData } = data;

    return prisma.comment.create({
      data: {
        ...commentData,
        attachments: {
          connect: attachmentIds.map((id) => ({ id })),
        },
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            department: true,
          },
        },
        attachments: true,
        commentReactions: {
          select: {
            userId: true,
            emoji: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async update(id: string, data: UpdateCommentData) {
    const { attachmentIds, ...commentData } = data;

    const updateData: any = { ...commentData };

    if (attachmentIds !== undefined) {
      // Disconnect existing attachments and connect new ones
      await prisma.comment.update({
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

    return prisma.comment.update({
      where: { id },
      data: updateData,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            department: true,
          },
        },
        attachments: true,
        commentReactions: {
          select: {
            userId: true,
            emoji: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async delete(id: string) {
    // Delete related attachments first due to foreign key constraints
    await prisma.comment.update({
      where: { id },
      data: {
        attachments: {
          set: [], // Disconnect all attachments
        },
      },
    });

    return prisma.comment.delete({ where: { id } });
  }

  async getThreadReplies(parentId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [replies, total] = await Promise.all([
      prisma.comment.findMany({
        where: { parentId },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              department: true,
            },
          },
          attachments: true,
          commentReactions: {
            select: {
              userId: true,
              emoji: true,
              createdAt: true,
            },
          },
          _count: {
            select: { attachments: true },
          },
        },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.comment.count({ where: { parentId } }),
    ]);

    return {
      replies,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getCommentStats(memoId: string) {
    const [totalComments, topLevelComments] = await Promise.all([
      prisma.comment.count({ where: { memoId } }),
      prisma.comment.count({ where: { memoId, parentId: null } }),
    ]);

    return {
      totalComments,
      topLevelComments,
      replyComments: totalComments - topLevelComments,
    };
  }
}
