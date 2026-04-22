import {
  CommentRepository,
  CreateCommentData,
  UpdateCommentData,
  CommentFilters,
} from "../repositories/comment.repository.js";
import { NotificationService } from "./notification.service.js";
import { prisma } from "../config/prisma.js";
import { COMMENT_BODY_MAX_LENGTH } from "../constants/content-limits.js";

export class CommentService {
  private commentRepository: CommentRepository;
  private notificationService: NotificationService;

  constructor() {
    this.commentRepository = new CommentRepository();
    this.notificationService = new NotificationService();
  }

  async getComments(filters: CommentFilters = {}, page = 1, limit = 20) {
    const result = await this.commentRepository.findAll(filters, page, limit);

    // Transform the data for API response
    const comments = result.comments.map((comment) => ({
      id: comment.id,
      memoId: comment.memoId,
      author: comment.author,
      body: comment.body,
      parentId: comment.parentId,
      reactions: comment.reactions,
      commentReactions: (comment as any).commentReactions || [],
      attachments: comment.attachments,
      stats: {
        attachmentCount: comment._count.attachments,
      },
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    }));

    return {
      comments,
      pagination: result.pagination,
    };
  }

  async getCommentById(id: string) {
    const comment = await this.commentRepository.findById(id);

    if (!comment) {
      throw new Error("Comment not found");
    }

    // Transform for API response
    return {
      id: comment.id,
      memoId: comment.memoId,
      author: comment.author,
      body: comment.body,
      parentId: comment.parentId,
      memo: comment.memo,
      reactions: comment.reactions,
      commentReactions: (comment as any).commentReactions || [],
      attachments: comment.attachments,
      stats: {
        attachmentCount: comment._count.attachments,
      },
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }

  async getMemoComments(memoId: string, page = 1, limit = 50) {
    // Verify memo exists
    const memo = await prisma.memo.findUnique({
      where: { id: memoId },
      select: { id: true, visibility: true, creatorId: true },
    });

    if (!memo) {
      throw new Error("Memo not found");
    }

    const result = await this.commentRepository.findByMemoId(
      memoId,
      page,
      limit,
    );

    // Transform the data for API response
    const comments = result.comments.map((comment) => ({
      id: comment.id,
      memoId: comment.memoId,
      author: comment.author,
      body: comment.body,
      parentId: comment.parentId,
      reactions: comment.reactions,
      commentReactions: (comment as any).commentReactions || [],
      attachments: comment.attachments,
      stats: {
        attachmentCount: comment._count.attachments,
      },
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    }));

    return {
      comments,
      pagination: result.pagination,
    };
  }

  async createComment(data: CreateCommentData, authorName?: string) {
    if (data.body.length > COMMENT_BODY_MAX_LENGTH) {
      throw new Error(
        `Comment is too long. Please keep it under ${COMMENT_BODY_MAX_LENGTH} characters.`,
      );
    }

    // Validate that author exists
    const author = await prisma.user.findUnique({
      where: { id: data.authorId },
    });

    if (!author) {
      throw new Error("Author not found");
    }

    // Validate that memo exists
    const memo = await prisma.memo.findUnique({
      where: { id: data.memoId },
      select: { id: true, visibility: true, creatorId: true },
    });

    if (!memo) {
      throw new Error("Memo not found");
    }

    // If replying to a parent comment, validate it exists and belongs to the same memo
    if (data.parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: data.parentId },
        select: { id: true, memoId: true },
      });

      if (!parentComment) {
        throw new Error("Parent comment not found");
      }

      if (parentComment.memoId !== data.memoId) {
        throw new Error("Parent comment does not belong to the specified memo");
      }
    }

    // Validate attachments exist
    if (data.attachmentIds?.length) {
      const attachments = await prisma.attachment.findMany({
        where: { id: { in: data.attachmentIds } },
        select: { id: true },
      });

      if (attachments.length !== data.attachmentIds.length) {
        throw new Error("One or more attachments not found");
      }
    }

    const comment = await this.commentRepository.create(data);

    // Send notifications to memo recipients (async, don't wait)
    if (authorName) {
      setImmediate(async () => {
        try {
          // Get memo details and recipients
          const memoWithRecipients = await prisma.memo.findUnique({
            where: { id: data.memoId },
            select: {
              id: true,
              title: true,
              creatorId: true,
              recipients: {
                select: {
                  userId: true,
                },
              },
            },
          });

          if (memoWithRecipients) {
            const recipientSet = new Set(
              memoWithRecipients.recipients.map((r) => r.userId),
            );
            recipientSet.add(memoWithRecipients.creatorId);

            let parentComment: {
              authorId: string;
              author?: { name: string };
            } | null = null;
            if (data.parentId) {
              parentComment = await prisma.comment.findUnique({
                where: { id: data.parentId },
                select: { authorId: true, author: { select: { name: true } } },
              });
              if (parentComment?.authorId) {
                recipientSet.add(parentComment.authorId);
              }
            }

            const recipientIds = Array.from(recipientSet).filter(
              (id) => id !== data.authorId,
            );

            if (recipientIds.length > 0) {
              await this.notificationService.notifyNewComment(
                memoWithRecipients.id,
                memoWithRecipients.title,
                comment.id,
                authorName,
                recipientIds,
                {
                  isReply: Boolean(data.parentId),
                  repliedToName: parentComment?.author?.name,
                },
              );
            }
          }
        } catch (error) {
          console.error("Failed to send comment notifications:", error);
        }
      });
    }

    // Transform for API response
    return {
      id: comment.id,
      memoId: comment.memoId,
      author: comment.author,
      body: comment.body,
      parentId: comment.parentId,
      reactions: comment.reactions,
      commentReactions: (comment as any).commentReactions || [],
      attachments: comment.attachments,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }

  async updateComment(id: string, data: UpdateCommentData, userId: string) {
    if (
      typeof data.body === "string" &&
      data.body.length > COMMENT_BODY_MAX_LENGTH
    ) {
      throw new Error(
        `Comment is too long. Please keep it under ${COMMENT_BODY_MAX_LENGTH} characters.`,
      );
    }

    // Check if comment exists and user has permission
    const existingComment = await this.commentRepository.findById(id);

    if (!existingComment) {
      throw new Error("Comment not found");
    }

    if (existingComment.author.id !== userId) {
      throw new Error("Only the author can update this comment");
    }

    // Validate attachments if provided
    if (data.attachmentIds?.length) {
      const attachments = await prisma.attachment.findMany({
        where: { id: { in: data.attachmentIds } },
        select: { id: true },
      });

      if (attachments.length !== data.attachmentIds.length) {
        throw new Error("One or more attachments not found");
      }
    }

    const comment = await this.commentRepository.update(id, data);

    setImmediate(async () => {
      try {
        const [actor, memo] = await Promise.all([
          prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
          }),
          prisma.memo.findUnique({
            where: { id: existingComment.memoId },
            select: {
              id: true,
              title: true,
              creatorId: true,
            },
          }),
        ]);

        if (memo?.creatorId && memo.creatorId !== userId) {
          await this.notificationService.createNotification({
            userId: memo.creatorId,
            type: "comment_added",
            title: "Comment Edited",
            body: `${actor?.name || "Someone"} edited a comment on your memo "${memo.title}"`,
            actionUrl: `/memos/${memo.id}#comment-${id}`,
          });
        }
      } catch (error) {
        console.error("Failed to send comment edit notifications:", error);
      }
    });

    // Transform for API response
    return {
      id: comment.id,
      memoId: comment.memoId,
      author: comment.author,
      body: comment.body,
      parentId: comment.parentId,
      reactions: comment.reactions,
      commentReactions: (comment as any).commentReactions || [],
      attachments: comment.attachments,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }

  async deleteComment(id: string, userId: string) {
    // Check if comment exists and user has permission
    const existingComment = await this.commentRepository.findById(id);

    if (!existingComment) {
      throw new Error("Comment not found");
    }

    if (existingComment.author.id !== userId) {
      throw new Error("Only the author can delete this comment");
    }

    await this.commentRepository.delete(id);

    setImmediate(async () => {
      try {
        const [actor, memo] = await Promise.all([
          prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
          }),
          prisma.memo.findUnique({
            where: { id: existingComment.memoId },
            select: {
              id: true,
              title: true,
              creatorId: true,
            },
          }),
        ]);

        if (memo?.creatorId && memo.creatorId !== userId) {
          await this.notificationService.createNotification({
            userId: memo.creatorId,
            type: "comment_added",
            title: "Comment Deleted",
            body: `${actor?.name || "Someone"} deleted a comment on your memo "${memo.title}"`,
            actionUrl: `/memos/${memo.id}`,
          });
        }
      } catch (error) {
        console.error("Failed to send comment delete notifications:", error);
      }
    });

    return { success: true };
  }

  async getThreadReplies(parentId: string, page = 1, limit = 20) {
    // Verify parent comment exists
    const parentComment = await this.commentRepository.findById(parentId);

    if (!parentComment) {
      throw new Error("Parent comment not found");
    }

    const result = await this.commentRepository.getThreadReplies(
      parentId,
      page,
      limit,
    );

    // Transform the data for API response
    const replies = result.replies.map((reply) => ({
      id: reply.id,
      memoId: reply.memoId,
      author: reply.author,
      body: reply.body,
      parentId: reply.parentId,
      attachments: reply.attachments,
      stats: {
        attachmentCount: reply._count.attachments,
      },
      createdAt: reply.createdAt,
      updatedAt: reply.updatedAt,
    }));

    return {
      replies,
      pagination: result.pagination,
    };
  }

  async getCommentStats(memoId: string) {
    // Verify memo exists
    const memo = await prisma.memo.findUnique({
      where: { id: memoId },
      select: { id: true },
    });

    if (!memo) {
      throw new Error("Memo not found");
    }

    return this.commentRepository.getCommentStats(memoId);
  }

  async performAction(commentId: string, action: string, userId: string) {
    // Get the comment first to check permissions
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) {
      return null;
    }

    // Only comment author can perform actions
    if (comment.authorId !== userId) {
      throw new Error("Only comment author can perform this action");
    }

    switch (action) {
      case "pin":
        return this.commentRepository.update(commentId, {
          pinned: true,
          pinnedBy: userId,
        });

      case "unpin":
        return this.commentRepository.update(commentId, {
          pinned: false,
          pinnedBy: null,
        });

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async addReaction(commentId: string, userId: string, emoji: string) {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) {
      return null;
    }

    const existingReaction = await prisma.commentReaction.findUnique({
      where: {
        commentId_userId_emoji: {
          commentId,
          userId,
          emoji,
        },
      },
      select: { id: true },
    });

    if (!existingReaction) {
      // Create reaction in normalized table
      await prisma.commentReaction.create({
        data: {
          commentId,
          userId,
          emoji,
        },
      });
    }

    // Keep legacy JSON reactions column in sync for compatibility on all read paths
    const legacyReactions = ((comment as any).reactions as any[]) || [];
    const nextLegacy = [...legacyReactions];
    const legacyIndex = nextLegacy.findIndex((entry) => entry?.emoji === emoji);
    if (legacyIndex >= 0) {
      const users = Array.isArray(nextLegacy[legacyIndex].users)
        ? nextLegacy[legacyIndex].users
        : [];
      if (!users.includes(userId)) {
        nextLegacy[legacyIndex] = {
          ...nextLegacy[legacyIndex],
          users: [...users, userId],
        };
      }
    } else {
      nextLegacy.push({ emoji, users: [userId] });
    }

    await prisma.comment.update({
      where: { id: commentId },
      data: { reactions: nextLegacy as any },
    });

    setImmediate(async () => {
      try {
        const actor = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });

        const recipientSet = new Set<string>();
        if (comment.authorId && comment.authorId !== userId) {
          recipientSet.add(comment.authorId);
        }
        if (
          (comment as any).memo?.creatorId &&
          (comment as any).memo.creatorId !== userId
        ) {
          recipientSet.add((comment as any).memo.creatorId);
        }

        await Promise.all(
          Array.from(recipientSet).map((recipientId) =>
            this.notificationService.createNotification({
              userId: recipientId,
              type: "reaction_added",
              title: "New Like",
              body: `${actor?.name || "Someone"} liked a comment with ${emoji}`,
              actionUrl: `/memos/${comment.memoId}`,
            }),
          ),
        );
      } catch (error) {
        console.error("Failed to send comment reaction notifications:", error);
      }
    });

    // Get updated comment with reactions
    return this.commentRepository.findById(commentId);
  }

  async removeReaction(commentId: string, userId: string, emoji: string) {
    const comment = await this.commentRepository.findById(commentId);
    if (!comment) {
      return null;
    }

    await prisma.commentReaction.deleteMany({
      where: {
        commentId,
        userId,
        emoji,
      },
    });

    // Keep legacy JSON reactions column in sync for compatibility on all read paths
    const legacyReactions = ((comment as any).reactions as any[]) || [];
    const nextLegacy = legacyReactions
      .map((entry) => {
        if (entry?.emoji !== emoji) return entry;
        const users = Array.isArray(entry.users) ? entry.users : [];
        return { ...entry, users: users.filter((id) => id !== userId) };
      })
      .filter((entry) => Array.isArray(entry?.users) && entry.users.length > 0);

    await prisma.comment.update({
      where: { id: commentId },
      data: { reactions: nextLegacy as any },
    });

    // Get updated comment with reactions
    return this.commentRepository.findById(commentId);
  }
}
