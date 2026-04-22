import { Router } from "express";
import {
  getUserConversations,
  getOrCreateDirectConversation,
  createGroupConversation,
  getConversationMessages,
} from "../controllers/message.controller.js";

const router = Router();

// GET /api/conversations - Get user's conversations
router.get("/", getUserConversations as any);

// POST /api/conversations - Create group conversation
router.post("/", createGroupConversation as any);

// GET /api/conversations/direct/:userId - Get or create direct conversation
router.get("/direct/:userId", getOrCreateDirectConversation as any);

// GET /api/conversations/:conversationId/messages - Get messages in conversation
router.get("/:conversationId/messages", getConversationMessages as any);

export default router;
