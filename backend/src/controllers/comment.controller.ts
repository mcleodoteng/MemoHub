import { Request, Response } from "express";
import { CommentService } from "../services/comment.service.js";
import { AuthRequest } from "../middleware/auth.middleware.js";
import { CreateCommentData } from "../repositories/comment.repository.js";
import { z } from "zod";
import { COMMENT_BODY_MAX_LENGTH } from "../constants/content-limits.js";

const commentService = new CommentService();

// Validation schemas
const createCommentSchema = z.object({
  body: z
    .string()
    .min(1, "Comment body is required")
    .max(
      COMMENT_BODY_MAX_LENGTH,
      `Comment too long (max ${COMMENT_BODY_MAX_LENGTH} characters)`,
    ),
  parentId: z.string().optional(),
  attachmentIds: z.array(z.string()).optional(),
});

const updateCommentSchema = z.object({
  body: z
    .string()
    .min(1, "Comment body is required")
    .max(
      COMMENT_BODY_MAX_LENGTH,
      `Comment too long (max ${COMMENT_BODY_MAX_LENGTH} characters)`,
    )
    .optional(),
  attachmentIds: z.array(z.string()).optional(),
});

const commentFiltersSchema = z.object({
  memoId: z.string().optional(),
  authorId: z.string().optional(),
  parentId: z.string().optional(),
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const memoCommentsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

const threadRepliesSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const getComments = async (req: AuthRequest, res: Response) => {
  try {
    const queryResult = commentFiltersSchema.safeParse(req.query);

    if (!queryResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: queryResult.error.issues,
      });
    }

    const filters = queryResult.data;
    const { page, limit, ...filterParams } = filters;

    const result = await commentService.getComments(filterParams, page, limit);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get comments error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch comments",
    });
  }
};

export const getCommentById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Comment ID is required",
      });
    }

    const comment = await commentService.getCommentById(id);

    res.json({
      success: true,
      data: { comment },
    });
  } catch (error) {
    console.error("Get comment by ID error:", error);

    if (error instanceof Error && error.message === "Comment not found") {
      return res.status(404).json({
        success: false,
        error: "Comment not found",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to fetch comment",
    });
  }
};

export const getMemoComments = async (req: AuthRequest, res: Response) => {
  try {
    const { memoId } = req.params;

    if (!memoId) {
      return res.status(400).json({
        success: false,
        error: "Memo ID is required",
      });
    }

    const queryResult = memoCommentsSchema.safeParse(req.query);

    if (!queryResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: queryResult.error.issues,
      });
    }

    const { page, limit } = queryResult.data;

    const result = await commentService.getMemoComments(memoId, page, limit);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get memo comments error:", error);

    if (error instanceof Error && error.message === "Memo not found") {
      return res.status(404).json({
        success: false,
        error: "Memo not found",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to fetch memo comments",
    });
  }
};

export const createComment = async (req: AuthRequest, res: Response) => {
  try {
    const { memoId } = req.params;

    if (!memoId) {
      return res.status(400).json({
        success: false,
        error: "Memo ID is required",
      });
    }

    const validationResult = createCommentSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: validationResult.error.issues,
      });
    }

    const commentData = {
      ...validationResult.data,
      memoId,
      authorId: req.user!.id,
    } as CreateCommentData;

    const comment = await commentService.createComment(
      commentData,
      req.user!.name,
    );

    res.status(201).json({
      success: true,
      data: { comment },
    });
  } catch (error) {
    console.error("Create comment error:", error);

    const maybeDbError = error as { code?: string; message?: string };
    if (maybeDbError?.code === "P2000") {
      return res.status(400).json({
        success: false,
        error: `Comment is too long. Please keep it under ${COMMENT_BODY_MAX_LENGTH} characters.`,
      });
    }

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    }

    res.status(500).json({
      success: false,
      error: "Failed to create comment",
    });
  }
};

export const updateComment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Comment ID is required",
      });
    }

    const validationResult = updateCommentSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: validationResult.error.issues,
      });
    }

    const comment = await commentService.updateComment(
      id,
      validationResult.data,
      req.user!.id,
    );

    res.json({
      success: true,
      data: { comment },
    });
  } catch (error) {
    console.error("Update comment error:", error);

    const maybeDbError = error as { code?: string; message?: string };
    if (maybeDbError?.code === "P2000") {
      return res.status(400).json({
        success: false,
        error: `Comment is too long. Please keep it under ${COMMENT_BODY_MAX_LENGTH} characters.`,
      });
    }

    if (error instanceof Error) {
      if (error.message === "Comment not found") {
        return res.status(404).json({
          success: false,
          error: "Comment not found",
        });
      }
      if (
        error.message.includes("permission") ||
        error.message.includes("author")
      ) {
        return res.status(403).json({
          success: false,
          error: "Permission denied",
        });
      }
      if (error.message.includes("not found")) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    }

    res.status(500).json({
      success: false,
      error: "Failed to update comment",
    });
  }
};

export const deleteComment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Comment ID is required",
      });
    }

    await commentService.deleteComment(id, req.user!.id);

    res.json({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error("Delete comment error:", error);

    if (error instanceof Error) {
      if (error.message === "Comment not found") {
        return res.status(404).json({
          success: false,
          error: "Comment not found",
        });
      }
      if (
        error.message.includes("permission") ||
        error.message.includes("author")
      ) {
        return res.status(403).json({
          success: false,
          error: "Permission denied",
        });
      }
    }

    res.status(500).json({
      success: false,
      error: "Failed to delete comment",
    });
  }
};

export const getThreadReplies = async (req: AuthRequest, res: Response) => {
  try {
    const { parentId } = req.params;

    if (!parentId) {
      return res.status(400).json({
        success: false,
        error: "Parent comment ID is required",
      });
    }

    const queryResult = threadRepliesSchema.safeParse(req.query);

    if (!queryResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: queryResult.error.issues,
      });
    }

    const { page, limit } = queryResult.data;

    const result = await commentService.getThreadReplies(parentId, page, limit);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get thread replies error:", error);

    if (
      error instanceof Error &&
      error.message === "Parent comment not found"
    ) {
      return res.status(404).json({
        success: false,
        error: "Parent comment not found",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to fetch thread replies",
    });
  }
};

export const getCommentStats = async (req: AuthRequest, res: Response) => {
  try {
    const { memoId } = req.params;

    if (!memoId) {
      return res.status(400).json({
        success: false,
        error: "Memo ID is required",
      });
    }

    const stats = await commentService.getCommentStats(memoId);

    res.json({
      success: true,
      data: { stats },
    });
  } catch (error) {
    console.error("Get comment stats error:", error);

    if (error instanceof Error && error.message === "Memo not found") {
      return res.status(404).json({
        success: false,
        error: "Memo not found",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to fetch comment stats",
    });
  }
};

export const postCommentAction = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { action } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    // Validate action
    const validActions = ["pin", "unpin"];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        error: `Invalid action. Valid actions: ${validActions.join(", ")}`,
      });
    }

    const comment = await commentService.performAction(id, action, userId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: "Comment not found",
      });
    }

    res.json({
      success: true,
      data: { comment },
    });
  } catch (error) {
    console.error("Comment action error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to perform comment action",
    });
  }
};

export const addCommentReaction = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    if (!emoji) {
      return res.status(400).json({
        success: false,
        error: "Emoji is required",
      });
    }

    const comment = await commentService.addReaction(id, userId, emoji);

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: "Comment not found",
      });
    }

    res.json({
      success: true,
      data: { comment },
    });
  } catch (error) {
    console.error("Add comment reaction error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add reaction",
    });
  }
};

export const removeCommentReaction = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { id, emoji } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const comment = await commentService.removeReaction(id, userId, emoji);

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: "Comment not found",
      });
    }

    res.json({
      success: true,
      data: { comment },
    });
  } catch (error) {
    console.error("Remove comment reaction error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to remove reaction",
    });
  }
};
