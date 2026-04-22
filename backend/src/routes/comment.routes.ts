import { Router } from "express";
import {
  getCommentById,
  updateComment,
  deleteComment,
  postCommentAction,
  addCommentReaction,
  removeCommentReaction,
} from "../controllers/comment.controller.js";

const router = Router();

// GET /api/comments/:id - Get comment by ID
router.get("/:id", getCommentById as any);

// PUT /api/comments/:id - Update comment
router.put("/:id", updateComment as any);

// DELETE /api/comments/:id - Delete comment
router.delete("/:id", deleteComment as any);

// POST /api/comments/:id/actions/:action - Perform action on comment (pin, unpin, etc)
router.post("/:id/actions/:action", postCommentAction as any);

// POST /api/comments/:id/reactions - Add reaction to comment
router.post("/:id/reactions", addCommentReaction as any);

// DELETE /api/comments/:id/reactions/:emoji - Remove reaction from comment
router.delete("/:id/reactions/:emoji", removeCommentReaction as any);

export default router;
