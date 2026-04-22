import { Request, Response } from "express";
import { MemoService } from "../services/memo.service.js";
import { AuthRequest } from "../middleware/auth.middleware.js";
import { CreateMemoData } from "../repositories/memo.repository.js";
import { io } from "../server.js";
import { z } from "zod";
import { hasPermission } from "../middleware/role-permissions.js";
import { emitReportsDataUpdated } from "../sockets/reports.socket.js";

const memoService = new MemoService();
const memoVisibilitySchema = z.enum([
  "public",
  "private",
  "protected",
  "department",
]);

const emitToMemoStakeholders = async (
  memoId: string,
  viewerUserId: string,
  event: string,
  payload: Record<string, any>,
) => {
  io.to(`memo_${memoId}`).emit(event, payload);

  try {
    const memo = await memoService.getMemoById(memoId, viewerUserId);
    const stakeholderIds = Array.from(
      new Set([memo.creator.id, ...memo.recipients.map((r) => r.id)]),
    );

    stakeholderIds.forEach((stakeholderId) => {
      io.to(`user_${stakeholderId}`).emit(event, payload);
    });

    emitReportsDataUpdated("memo_controller_event", { memoId, event });
  } catch (error) {
    console.error(`Failed to emit ${event} to memo stakeholders:`, error);
  }
};

// Validation schemas
const createMemoSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(200, "Title too long"),
    body: z.string().default(""),
    visibility: memoVisibilitySchema.default("public"),
    status: z.enum(["sent", "draft"]).default("sent").optional(),
    recipientIds: z.array(z.string()).optional(),
    tagIds: z.array(z.string()).optional(),
    attachmentIds: z.array(z.string()).optional(),
    referencedMemoIds: z.array(z.string()).optional(),
    workflow: z.any().optional(),
    groupId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if ((data.status || "sent") === "sent" && data.body.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Body is required",
        path: ["body"],
      });
    }
  });

const updateMemoSchema = z
  .object({
    title: z
      .string()
      .min(1, "Title is required")
      .max(200, "Title too long")
      .optional(),
    body: z.string().optional(),
    visibility: memoVisibilitySchema.optional(),
    status: z.enum(["sent", "draft", "archived", "deleted"]).optional(),
    pinned: z.boolean().optional(),
    archived: z.boolean().optional(),
    tagIds: z.array(z.string()).optional(),
    attachmentIds: z.array(z.string()).optional(),
    referencedMemoIds: z.array(z.string()).optional(),
    workflow: z.any().optional(),
    groupId: z.string().optional(),
    recipientIds: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.status === "sent" &&
      data.body !== undefined &&
      data.body.trim().length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Body is required",
        path: ["body"],
      });
    }
  });

const memoFiltersSchema = z.object({
  creatorId: z.string().optional(),
  visibility: memoVisibilitySchema.optional(),
  status: z.enum(["sent", "draft", "archived", "deleted"]).optional(),
  recipientId: z.string().optional(),
  tagId: z.string().optional(),
  search: z.string().optional(),
  searchIn: z.enum(["all", "title", "body", "comments", "creator"]).optional(),
  pinned: z.coerce.boolean().optional(),
  archived: z.coerce.boolean().optional(),
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
  updatedAfter: z.coerce.date().optional(),
  updatedBefore: z.coerce.date().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  hasAttachments: z.coerce.boolean().optional(),
  department: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const reactionSchema = z.object({
  emoji: z.string().min(1, "Emoji is required").max(10, "Emoji too long"),
});

export const getMemos = async (
  req: AuthRequest,
  res: Response,
): Promise<Response | undefined> => {
  try {
    const queryResult = memoFiltersSchema.safeParse(req.query);

    if (!queryResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: queryResult.error.issues,
      });
    }

    const filters = queryResult.data;
    const { page, limit, ...filterParams } = filters;

    const result = await memoService.getMemos(
      filterParams,
      page,
      limit,
      req.user?.id,
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get memos error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch memos",
    });
  }
};

export const getWorkflowAutomationStatus = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    if (!hasPermission(req.user?.role, "canAccessSystemSettings")) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
      });
    }

    const status = memoService.getWorkflowAutomationStatus();

    res.json({
      success: true,
      data: { status },
    });
  } catch (error) {
    console.error("Get workflow automation status error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch workflow automation status",
    });
  }
};

export const createMemo = async (req: AuthRequest, res: Response) => {
  try {
    const validationResult = createMemoSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: validationResult.error.issues,
      });
    }

    const memoData = {
      ...validationResult.data,
      creatorId: req.user!.id,
    } as CreateMemoData;

    const memo = await memoService.createMemo(memoData, req.user!.name);

    await emitToMemoStakeholders(memo.id, req.user!.id, "memo_created", {
      memoId: memo.id,
      creatorId: req.user!.id,
      creatorName: req.user!.name,
    });

    res.status(201).json({
      success: true,
      data: { memo },
    });
  } catch (error) {
    console.error("Create memo error:", error);

    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }

      if (
        error.message.includes("Unique constraint") ||
        error.message.includes("constraint failed") ||
        error.message.includes("Invalid")
      ) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    }

    res.status(500).json({
      success: false,
      error: "Failed to create memo",
    });
  }
};

export const getMemoById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Memo identifier is required",
      });
    }

    const memo = await memoService.getMemoById(id, req.user?.id);

    res.json({
      success: true,
      data: { memo },
    });
  } catch (error) {
    console.error("Get memo by ID error:", error);

    if (error instanceof Error) {
      if (error.message === "Memo not found") {
        return res.status(404).json({
          success: false,
          error: "Memo not found",
        });
      }
      if (error.message === "Access denied") {
        return res.status(403).json({
          success: false,
          error: "Access denied",
        });
      }
    }

    res.status(500).json({
      success: false,
      error: "Failed to fetch memo",
    });
  }
};

export const updateMemo = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Memo ID is required",
      });
    }

    const validationResult = updateMemoSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: validationResult.error.issues,
      });
    }

    const memo = await memoService.updateMemo(
      id,
      validationResult.data,
      req.user!.id,
      req.user!.role,
    );

    await emitToMemoStakeholders(id, req.user!.id, "memo_updated", {
      memoId: id,
      updatedBy: req.user!.id,
    });

    res.json({
      success: true,
      data: { memo },
    });
  } catch (error) {
    console.error("Update memo error:", error);

    if (error instanceof Error) {
      if (error.message === "Memo not found") {
        return res.status(404).json({
          success: false,
          error: "Memo not found",
        });
      }
      if (
        error.message.includes("permission") ||
        error.message.includes("creator")
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
      error: "Failed to update memo",
    });
  }
};

export const deleteMemo = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Memo ID is required",
      });
    }

    await memoService.deleteMemo(id, req.user!.id, req.user!.role);
    await emitToMemoStakeholders(id, req.user!.id, "memo_deleted", {
      memoId: id,
      deletedBy: req.user!.id,
    });

    res.json({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error("Delete memo error:", error);

    if (error instanceof Error) {
      if (error.message === "Memo not found") {
        return res.status(404).json({
          success: false,
          error: "Memo not found",
        });
      }
      if (
        error.message.includes("permission") ||
        error.message.includes("creator")
      ) {
        return res.status(403).json({
          success: false,
          error: "Permission denied",
        });
      }
    }

    res.status(500).json({
      success: false,
      error: "Failed to delete memo",
    });
  }
};

// Action endpoints for recipient interactions
export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Memo ID is required",
      });
    }

    await memoService.markAsRead(id, req.user!.id);
    await emitToMemoStakeholders(id, req.user!.id, "memo_opened_by_user", {
      memoId: id,
      userId: req.user!.id,
      userName: req.user!.name,
    });

    res.json({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark memo as read",
    });
  }
};

export const acknowledgeMemo = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Memo ID is required",
      });
    }

    await memoService.acknowledgeMemo(id, req.user!.id);
    await emitToMemoStakeholders(
      id,
      req.user!.id,
      "memo_acknowledged_by_user",
      {
        memoId: id,
        userId: req.user!.id,
        userName: req.user!.name,
      },
    );
    await emitToMemoStakeholders(id, req.user!.id, "memo_status_updated", {
      memoId: id,
      userId: req.user!.id,
      status: "acknowledged",
    });

    res.json({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error("Acknowledge memo error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to acknowledge memo",
    });
  }
};

export const approveMemo = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Memo ID is required",
      });
    }

    await memoService.approveMemo(id, req.user!.id);
    await emitToMemoStakeholders(id, req.user!.id, "memo_status_updated", {
      memoId: id,
      userId: req.user!.id,
      status: "approved",
    });

    res.json({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error("Approve memo error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to approve memo",
    });
  }
};

export const replyToMemo = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Memo ID is required",
      });
    }

    await memoService.replyToMemo(id, req.user!.id);
    await emitToMemoStakeholders(id, req.user!.id, "memo_status_updated", {
      memoId: id,
      userId: req.user!.id,
      status: "replied",
    });

    res.json({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error("Reply to memo error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark memo as replied",
    });
  }
};

// Reaction endpoints
export const addReaction = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Memo ID is required",
      });
    }

    const validationResult = reactionSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: validationResult.error.issues,
      });
    }

    const reaction = await memoService.addReaction(
      id,
      req.user!.id,
      validationResult.data.emoji,
    );

    res.status(201).json({
      success: true,
      data: { reaction },
    });
  } catch (error) {
    console.error("Add reaction error:", error);

    if (error instanceof Error && error.message.includes("already reacted")) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to add reaction",
    });
  }
};

export const removeReaction = async (req: AuthRequest, res: Response) => {
  try {
    const { id, emoji } = req.params;

    if (!id || !emoji) {
      return res.status(400).json({
        success: false,
        error: "Memo ID and emoji are required",
      });
    }

    await memoService.removeReaction(id, req.user!.id, emoji);

    res.json({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error("Remove reaction error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to remove reaction",
    });
  }
};

export const getReactions = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Memo ID is required",
      });
    }

    const reactions = await memoService.getReactions(id);

    res.json({
      success: true,
      data: { reactions },
    });
  } catch (error) {
    console.error("Get reactions error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch reactions",
    });
  }
};

export const postMemoAction = async (req: AuthRequest, res: Response) => {
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
    const validActions = [
      "pin",
      "unpin",
      "archive",
      "unarchive",
      "star",
      "unstar",
      "hide",
      "read",
      "acknowledge",
      "unacknowledge",
      "approve",
      "unapprove",
      "reply",
    ];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        error: `Invalid action. Valid actions: ${validActions.join(", ")}`,
      });
    }

    const memo = await memoService.performAction(
      id,
      action,
      userId,
      req.user!.role,
    );

    if (action === "read") {
      await emitToMemoStakeholders(id, userId, "memo_opened_by_user", {
        memoId: id,
        userId,
        userName: req.user!.name,
      });
    }

    if (
      [
        "acknowledge",
        "unacknowledge",
        "approve",
        "unapprove",
        "reply",
      ].includes(action)
    ) {
      if (action === "acknowledge") {
        await emitToMemoStakeholders(id, userId, "memo_acknowledged_by_user", {
          memoId: id,
          userId,
          userName: req.user!.name,
        });
      }

      await emitToMemoStakeholders(id, userId, "memo_status_updated", {
        memoId: id,
        userId,
        status: action,
      });
    }

    if (!memo) {
      return res.status(404).json({
        success: false,
        error: "Memo not found",
      });
    }

    res.json({
      success: true,
      data: { memo },
    });
  } catch (error) {
    console.error("Memo action error:", error);

    if (error instanceof Error) {
      if (error.message === "Memo not found") {
        return res.status(404).json({
          success: false,
          error: "Memo not found",
        });
      }

      if (
        error.message.includes("permission") ||
        error.message.includes("creator")
      ) {
        return res.status(403).json({
          success: false,
          error: error.message,
        });
      }

      if (error.message.startsWith("Unknown action")) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    }

    res.status(500).json({
      success: false,
      error: "Failed to perform memo action",
    });
  }
};

export const approveMemoWorkflow = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { approved, comment, stepId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    if (approved === undefined) {
      return res.status(400).json({
        success: false,
        error: "approved field is required",
      });
    }

    if (!stepId) {
      return res.status(400).json({
        success: false,
        error: "stepId field is required",
      });
    }

    const memo = await memoService.approveMemoWorkflow(
      id,
      userId,
      stepId,
      approved,
      comment,
    );

    if (!memo) {
      return res.status(404).json({
        success: false,
        error: "Memo not found",
      });
    }

    await emitToMemoStakeholders(id, userId, "memo_workflow_approved", {
      memoId: id,
      approved,
      approverId: userId,
      approverName: req.user!.name,
      comments: comment,
    });

    res.json({
      success: true,
      data: { memo },
    });
  } catch (error: any) {
    console.error("Approve memo workflow error:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to approve memo",
    });
  }
};

// Comment-related functions (nested under memos per API contract)
import { CommentService } from "../services/comment.service.js";

const commentService = new CommentService();

// GET /api/memos/:memoId/comments - Get comments for a memo
export const getMemoComments = async (req: AuthRequest, res: Response) => {
  try {
    const { memoId } = req.params;

    if (!memoId) {
      return res.status(400).json({
        success: false,
        error: "Memo ID is required",
      });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

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

// POST /api/memos/:memoId/comments - Create comment on a memo
export const createComment = async (req: AuthRequest, res: Response) => {
  try {
    const { memoId } = req.params;
    const { body, parentId, attachmentIds } = req.body;
    const userId = req.user!.id;
    const trimmedBody = typeof body === "string" ? body.trim() : "";
    const safeAttachmentIds = Array.isArray(attachmentIds)
      ? attachmentIds.filter((value) => typeof value === "string")
      : [];

    if (!memoId || (!trimmedBody && safeAttachmentIds.length === 0)) {
      return res.status(400).json({
        success: false,
        error: "Memo ID and either comment body or attachments are required",
      });
    }

    const comment = await commentService.createComment({
      memoId,
      authorId: userId,
      body: trimmedBody,
      parentId,
      attachmentIds: safeAttachmentIds,
    });

    const memo = await memoService.getMemoById(memoId, userId);
    const isRecipient = memo.recipients.some(
      (recipient) => recipient.id === userId,
    );
    if (isRecipient) {
      await memoService.replyToMemo(memoId, userId);
    }
    await emitToMemoStakeholders(memoId, userId, "comment_created", {
      memoId,
      comment,
    });
    if (isRecipient) {
      await emitToMemoStakeholders(memoId, userId, "memo_status_updated", {
        memoId,
        userId,
        status: "replied",
      });
    }

    res.status(201).json({
      success: true,
      data: { comment },
    });
  } catch (error) {
    console.error("Create comment error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create comment",
    });
  }
};

// GET /api/memos/:memoId/comments/:commentId/replies - Get comment replies
export const getThreadReplies = async (req: AuthRequest, res: Response) => {
  try {
    const { memoId, commentId } = req.params;

    if (!memoId || !commentId) {
      return res.status(400).json({
        success: false,
        error: "Memo ID and comment ID are required",
      });
    }

    const replies = await commentService.getThreadReplies(commentId);

    res.json({
      success: true,
      data: { replies },
    });
  } catch (error) {
    console.error("Get thread replies error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch thread replies",
    });
  }
};
