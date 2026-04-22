import { Router } from "express";
import {
  getMemos,
  createMemo,
  getMemoById,
  updateMemo,
  deleteMemo,
  markAsRead,
  acknowledgeMemo,
  approveMemo,
  replyToMemo,
  addReaction,
  removeReaction,
  getReactions,
  getWorkflowAutomationStatus,
  postMemoAction,
  approveMemoWorkflow,
  getMemoComments,
  createComment,
  getThreadReplies,
} from "../controllers/memo.controller.js";

const router = Router();

// GET /api/memos - List memos with filtering and pagination
router.get("/", getMemos as any);

// GET /api/memos/workflow/automation-status - Get workflow automation health/status (admin)
router.get("/workflow/automation-status", getWorkflowAutomationStatus as any);

// POST /api/memos - Create new memo
router.post("/", createMemo as any);

// GET /api/memos/:id - Get memo by ID
router.get("/:id", getMemoById as any);

// PUT /api/memos/:id - Update memo
router.put("/:id", updateMemo as any);

// DELETE /api/memos/:id - Delete memo
router.delete("/:id", deleteMemo as any);

// POST /api/memos/:id/actions/read - Mark memo as read
router.post("/:id/actions/read", markAsRead as any);

// POST /api/memos/:id/actions/acknowledge - Acknowledge memo
router.post("/:id/actions/acknowledge", acknowledgeMemo as any);

// POST /api/memos/:id/actions/approve - Approve memo
router.post("/:id/actions/approve", approveMemo as any);

// POST /api/memos/:id/actions/reply - Mark memo as replied
router.post("/:id/actions/reply", replyToMemo as any);

// Action routes for recipient interactions
// POST /api/memos/:id/actions/:action - Perform action on memo (pin, archive, star, acknowledge, approve, etc)
router.post("/:id/actions/:action", postMemoAction as any);

// POST /api/memos/:id/workflow/approve - Approve/reject memo in workflow
router.post("/:id/workflow/approve", approveMemoWorkflow as any);

// Reaction routes
// POST /api/memos/:id/reactions - Add reaction
router.post("/:id/reactions", addReaction as any);

// DELETE /api/memos/:id/reactions/:emoji - Remove reaction
router.delete("/:id/reactions/:emoji", removeReaction as any);

// GET /api/memos/:id/reactions - Get reactions for memo
router.get("/:id/reactions", getReactions as any);
// Comment routes (nested under memos as per API contract)
// GET /api/memos/:memoId/comments - Get comments for a memo
router.get("/:memoId/comments", getMemoComments as any);

// POST /api/memos/:memoId/comments - Create comment on a memo
router.post("/:memoId/comments", createComment as any);

// GET /api/memos/:memoId/comments/:commentId/replies - Get comment replies
router.get("/:memoId/comments/:commentId/replies", getThreadReplies as any);
export default router;
