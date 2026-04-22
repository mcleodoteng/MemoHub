import { Router } from "express";
import {
  getMessages,
  getStarredMessages,
  sendMessage,
  updateMessage,
  deleteMessage,
  markAsRead,
  addMessageReaction,
  removeMessageReaction,
  addThreadReply,
  getThreadReplies,
  starMessage,
  unstarMessage,
} from "../controllers/message.controller.js";

const router = Router();

// Message routes
// GET /api/messages - List all messages with filtering
router.get("/", getMessages as any);

// GET /api/messages/starred - List starred messages for current user
router.get("/starred", getStarredMessages as any);

// POST /api/messages/conversations/:conversationId - Send message to conversation
router.post("/conversations/:conversationId", sendMessage as any);

// PUT /api/messages/:messageId - Update message
router.put("/:messageId", updateMessage as any);

// DELETE /api/messages/:messageId - Delete message
router.delete("/:messageId", deleteMessage as any);

// POST /api/messages/:messageId/read - Mark message as read
router.post("/:messageId/read", markAsRead as any);

// Reaction routes
// POST /api/messages/:messageId/reactions - Add reaction to message
router.post("/:messageId/reactions", addMessageReaction as any);

// DELETE /api/messages/:messageId/reactions/:emoji - Remove reaction
router.delete("/:messageId/reactions/:emoji", removeMessageReaction as any);

// Thread/Reply routes
// POST /api/messages/:messageId/replies - Add thread reply
router.post("/:messageId/replies", addThreadReply as any);

// GET /api/messages/:messageId/replies - Get thread replies
router.get("/:messageId/replies", getThreadReplies as any);

// Star routes
// POST /api/messages/:messageId/star - Star message
router.post("/:messageId/star", starMessage as any);

// DELETE /api/messages/:messageId/star - Unstar message
router.delete("/:messageId/star", unstarMessage as any);

export default router;
