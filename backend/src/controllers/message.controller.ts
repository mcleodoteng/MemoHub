import { Request, Response } from "express";
import { MessageService } from "../services/message.service.js";
import { ConversationRepository } from "../repositories/conversation.repository.js";
import { NotificationService } from "../services/notification.service.js";
import { io } from "../server.js";
import { CreateMessageData } from "../repositories/message.repository.js";
import { AuthRequest } from "../middleware/auth.middleware.js";
import { z } from "zod";
import { MESSAGE_BODY_MAX_LENGTH } from "../constants/content-limits.js";

const messageService = new MessageService();
const conversationRepository = new ConversationRepository();
const notificationService = new NotificationService();

const hasUserReaction = (reactions: any, userId: string, emoji: string) => {
  const normalized = Array.isArray(reactions) ? reactions : [];
  return normalized.some(
    (reaction) =>
      reaction?.emoji === emoji &&
      Array.isArray(reaction?.users) &&
      reaction.users.includes(userId),
  );
};

const emitReactionSystemMessage = async (
  conversationId: string,
  actorUserId: string,
  body: string,
) => {
  const created = await messageService.createMessage({
    conversationId,
    senderId: actorUserId,
    body,
    isSystem: true,
  });

  const fullMessage = await messageService.getMessageById(created.id);
  io.to(`conversation_${conversationId}`).emit("new_message", {
    message: fullMessage,
    conversationId,
  });
};

// Validation schemas
const createMessageSchema = z
  .object({
    body: z
      .string()
      .max(
        MESSAGE_BODY_MAX_LENGTH,
        `Message too long (max ${MESSAGE_BODY_MAX_LENGTH} characters)`,
      )
      .optional(),
    attachmentIds: z.array(z.string()).optional(),
    sharedMemoId: z.string().optional(),
  })
  .refine(
    (data) => {
      const hasBody = Boolean(data.body && data.body.trim().length > 0);
      const hasAttachments = Boolean(
        data.attachmentIds && data.attachmentIds.length > 0,
      );
      const hasSharedMemo = Boolean(data.sharedMemoId);
      return hasBody || hasAttachments || hasSharedMemo;
    },
    {
      message: "Message body, attachment, or shared memo is required",
      path: ["body"],
    },
  );

const updateMessageSchema = z.object({
  body: z
    .string()
    .min(1, "Message body is required")
    .max(
      MESSAGE_BODY_MAX_LENGTH,
      `Message too long (max ${MESSAGE_BODY_MAX_LENGTH} characters)`,
    )
    .optional(),
  attachmentIds: z.array(z.string()).optional(),
});

const messageFiltersSchema = z.object({
  conversationId: z.string().optional(),
  senderId: z.string().optional(),
  isSystem: z.coerce.boolean().optional(),
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

const conversationFiltersSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const createConversationSchema = z.object({
  type: z.enum(["direct", "group"]),
  participantIds: z
    .array(z.string())
    .min(1, "At least one participant is required"),
  name: z.string().optional(),
  groupId: z.string().optional(),
});

const threadReplySchema = z.object({
  replyContent: z
    .string()
    .min(1, "Reply content is required")
    .max(500, "Reply too long"),
});

const reactionSchema = z.object({
  emoji: z.string().min(1, "Emoji is required").max(10, "Emoji too long"),
});

export const getUserConversations = async (req: AuthRequest, res: Response) => {
  try {
    const queryResult = conversationFiltersSchema.safeParse(req.query);

    if (!queryResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: queryResult.error.issues,
      });
    }

    const { page, limit } = queryResult.data;

    const result = await conversationRepository.getUserConversations(
      req.user!.id,
      page,
      limit,
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get user conversations error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch conversations",
    });
  }
};

export const getOrCreateDirectConversation = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required",
      });
    }

    if (userId === req.user!.id) {
      return res.status(400).json({
        success: false,
        error: "Cannot create conversation with yourself",
      });
    }

    const conversation =
      await conversationRepository.getOrCreateDirectConversation(
        req.user!.id,
        userId,
      );

    res.json({
      success: true,
      data: { conversation },
    });
  } catch (error) {
    console.error("Get or create direct conversation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get or create conversation",
    });
  }
};

export const createGroupConversation = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const validationResult = createConversationSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: validationResult.error.issues,
      });
    }

    // Include current user in participants if not already
    const participants = validationResult.data.participantIds;
    if (!participants.includes(req.user!.id)) {
      participants.push(req.user!.id);
    }

    const conversation = validationResult.data.groupId
      ? await conversationRepository.getOrCreateGroupConversation(
          validationResult.data.groupId,
          participants,
          validationResult.data.name,
        )
      : await conversationRepository.create({
          type: "group",
          participantIds: participants,
          name: validationResult.data.name,
          groupId: validationResult.data.groupId,
        });

    res.status(201).json({
      success: true,
      data: { conversation },
    });
  } catch (error) {
    console.error("Create group conversation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create conversation",
    });
  }
};

export const getConversationMessages = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const conversationId = req.params.conversationId || req.params.id;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: "Conversation ID is required",
      });
    }

    const queryResult = conversationFiltersSchema.safeParse(req.query);

    if (!queryResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: queryResult.error.issues,
      });
    }

    const { page, limit } = queryResult.data;

    const result = await messageService.getConversationMessages(
      conversationId,
      page,
      limit,
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get conversation messages error:", error);

    if (error instanceof Error && error.message === "Conversation not found") {
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to fetch messages",
    });
  }
};

export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const queryResult = messageFiltersSchema.safeParse(req.query);

    if (!queryResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: queryResult.error.issues,
      });
    }

    const filters = queryResult.data;
    const { page, limit, ...filterParams } = filters;

    const result = await messageService.getMessages(filterParams, page, limit);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch messages",
    });
  }
};

export const getStarredMessages = async (req: AuthRequest, res: Response) => {
  try {
    const queryResult = conversationFiltersSchema.safeParse(req.query);

    if (!queryResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: queryResult.error.issues,
      });
    }

    const { page, limit } = queryResult.data;

    const result = await messageService.getStarredMessagesForUser(
      req.user!.id,
      page,
      limit,
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get starred messages error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch starred messages",
    });
  }
};

export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId } = req.params;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: "Conversation ID is required",
      });
    }

    const validationResult = createMessageSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: validationResult.error.issues,
      });
    }

    const messageData = {
      ...validationResult.data,
      conversationId,
      senderId: req.user!.id,
    } as CreateMessageData;

    const message = await messageService.createMessage(messageData);

    // Real-time broadcast to active conversation viewers
    io.to(`conversation_${conversationId}`).emit("new_message", {
      message,
      conversationId,
    });

    // Notification fallback path: send rich notifications from REST flow too,
    // so recipients are notified even if client-side socket send fails.
    const conversation = await conversationRepository.findById(conversationId);
    const participantIds = Array.isArray(conversation?.participantIds)
      ? (conversation?.participantIds as string[])
      : [];
    const recipientIds = participantIds.filter((id) => id !== req.user!.id);

    if (recipientIds.length > 0) {
      const senderName = req.user?.name || message.sender?.name || "Someone";
      const messageBody = (validationResult.data.body || "").trim();

      try {
        await notificationService.notifyNewMessage(
          conversationId,
          senderName,
          recipientIds,
          {
            isGroup: (conversation?.type || "").toLowerCase() === "group",
            conversationName: conversation?.name || undefined,
            messageBody,
          },
        );
      } catch (notifyError) {
        // Message creation already succeeded; do not fail the request for
        // non-critical notification side effects.
        console.error("Send message notification error:", notifyError);
      }
    }

    res.status(201).json({
      success: true,
      data: { message },
    });
  } catch (error) {
    console.error("Send message error:", error);

    const maybeDbError = error as { code?: string; message?: string };
    if (maybeDbError?.code === "P2000") {
      return res.status(400).json({
        success: false,
        error: `Message is too long. Please keep it under ${MESSAGE_BODY_MAX_LENGTH} characters.`,
      });
    }

    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("not a participant")
      ) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    }

    res.status(500).json({
      success: false,
      error: "Failed to send message",
    });
  }
};

export const updateMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { messageId } = req.params;

    if (!messageId) {
      return res.status(400).json({
        success: false,
        error: "Message ID is required",
      });
    }

    const validationResult = updateMessageSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: validationResult.error.issues,
      });
    }

    const message = await messageService.updateMessage(
      messageId,
      validationResult.data,
      req.user!.id,
    );

    io.to(`conversation_${message.conversationId}`).emit("message_updated", {
      message,
      conversationId: message.conversationId,
    });

    res.json({
      success: true,
      data: { message },
    });
  } catch (error) {
    console.error("Update message error:", error);

    const maybeDbError = error as { code?: string; message?: string };
    if (maybeDbError?.code === "P2000") {
      return res.status(400).json({
        success: false,
        error: `Message is too long. Please keep it under ${MESSAGE_BODY_MAX_LENGTH} characters.`,
      });
    }

    if (error instanceof Error) {
      if (error.message === "Message not found") {
        return res.status(404).json({
          success: false,
          error: "Message not found",
        });
      }
      if (
        error.message.includes("permission") ||
        error.message.includes("sender")
      ) {
        return res.status(403).json({
          success: false,
          error: "Permission denied",
        });
      }
      if (error.message.includes("deleted")) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    }

    res.status(500).json({
      success: false,
      error: "Failed to update message",
    });
  }
};

export const deleteMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { messageId } = req.params;

    if (!messageId) {
      return res.status(400).json({
        success: false,
        error: "Message ID is required",
      });
    }

    const deletedMessage = await messageService.deleteMessage(
      messageId,
      req.user!.id,
    );

    io.to(`conversation_${deletedMessage.conversationId}`).emit(
      "message_deleted",
      {
        messageId,
        conversationId: deletedMessage.conversationId,
        deletedAt: deletedMessage.deletedAt,
        message: deletedMessage,
      },
    );

    res.json({
      success: true,
      data: { message: deletedMessage },
    });
  } catch (error) {
    console.error("Delete message error:", error);

    if (error instanceof Error) {
      if (error.message === "Message not found") {
        return res.status(404).json({
          success: false,
          error: "Message not found",
        });
      }
      if (
        error.message.includes("permission") ||
        error.message.includes("sender")
      ) {
        return res.status(403).json({
          success: false,
          error: "Permission denied",
        });
      }
    }

    res.status(500).json({
      success: false,
      error: "Failed to delete message",
    });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const { messageId } = req.params;

    if (!messageId) {
      return res.status(400).json({
        success: false,
        error: "Message ID is required",
      });
    }

    await messageService.markMessageAsRead(messageId, req.user!.id);

    res.json({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark message as read",
    });
  }
};

export const addReaction = async (req: AuthRequest, res: Response) => {
  try {
    const { messageId } = req.params;
    const userId = req.user?.id;

    if (!messageId) {
      return res.status(400).json({
        success: false,
        error: "Message ID is required",
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
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

    await messageService.addReaction(
      messageId,
      userId,
      validationResult.data.emoji,
    );

    res.status(201).json({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error("Add reaction error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add reaction",
    });
  }
};

export const removeReaction = async (req: AuthRequest, res: Response) => {
  try {
    const { messageId, emoji } = req.params;
    const userId = req.user?.id;

    if (!messageId || !emoji) {
      return res.status(400).json({
        success: false,
        error: "Message ID and emoji are required",
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    await messageService.removeReaction(messageId, userId, emoji);

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

export const addThreadReply = async (req: AuthRequest, res: Response) => {
  try {
    const { messageId } = req.params;

    if (!messageId) {
      return res.status(400).json({
        success: false,
        error: "Message ID is required",
      });
    }

    const validationResult = threadReplySchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: validationResult.error.issues,
      });
    }

    const reply = await messageService.addThreadReply(
      messageId,
      req.user!.id,
      validationResult.data.replyContent,
    );

    res.status(201).json({
      success: true,
      data: { reply },
    });
  } catch (error) {
    console.error("Add thread reply error:", error);

    if (error instanceof Error && error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to add thread reply",
    });
  }
};

export const getThreadReplies = async (req: AuthRequest, res: Response) => {
  try {
    const { messageId } = req.params;

    if (!messageId) {
      return res.status(400).json({
        success: false,
        error: "Message ID is required",
      });
    }

    const queryResult = conversationFiltersSchema.safeParse(req.query);

    if (!queryResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: queryResult.error.issues,
      });
    }

    const { page, limit } = queryResult.data;

    const result = await messageService.getThreadReplies(
      messageId,
      page,
      limit,
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Get thread replies error:", error);

    if (error instanceof Error && error.message === "Message not found") {
      return res.status(404).json({
        success: false,
        error: "Message not found",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to fetch thread replies",
    });
  }
};

export const starMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { messageId } = req.params;

    if (!messageId) {
      return res.status(400).json({
        success: false,
        error: "Message ID is required",
      });
    }

    await messageService.starMessage(messageId, req.user!.id);

    res.json({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error("Star message error:", error);

    if (error instanceof Error && error.message === "Message not found") {
      return res.status(404).json({
        success: false,
        error: "Message not found",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to star message",
    });
  }
};

export const unstarMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { messageId } = req.params;

    if (!messageId) {
      return res.status(400).json({
        success: false,
        error: "Message ID is required",
      });
    }

    await messageService.unstarMessage(messageId, req.user!.id);

    res.json({
      success: true,
      data: {},
    });
  } catch (error) {
    console.error("Unstar message error:", error);

    if (error instanceof Error && error.message === "Message not found") {
      return res.status(404).json({
        success: false,
        error: "Message not found",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to unstar message",
    });
  }
};

export const addMessageReaction = async (req: AuthRequest, res: Response) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user?.id;
    const reactorName = req.user?.name || "Someone";

    if (!messageId) {
      return res.status(400).json({
        success: false,
        error: "Message ID is required",
      });
    }

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

    const originalMessage = await messageService
      .getMessageById(messageId)
      .catch(() => null);
    const hadReactionBefore = hasUserReaction(
      originalMessage?.reactions,
      userId,
      emoji,
    );

    const message = await messageService.addReaction(messageId, userId, emoji);

    if (!message) {
      return res.status(404).json({
        success: false,
        error: "Message not found",
      });
    }

    const conversationId =
      originalMessage?.conversation?.id || message.conversationId;

    if (conversationId && !hadReactionBefore) {
      io.to(`conversation_${conversationId}`).emit("reaction_added", {
        messageId,
        emoji,
        userId,
        userName: reactorName,
        conversationId,
      });

      const messageOwnerId = originalMessage?.sender?.id;
      const messageOwnerName = originalMessage?.sender?.name || "someone";

      const sideEffects: Promise<any>[] = [];

      if (messageOwnerId && messageOwnerId !== userId) {
        sideEffects.push(
          notificationService.createNotification({
            userId: messageOwnerId,
            type: "reaction_added",
            title: "New Reaction",
            body: `${reactorName} reacted ${emoji} to your message`,
            actionUrl: `/messages?conversationId=${conversationId}`,
          }),
        );

        sideEffects.push(
          emitReactionSystemMessage(
            conversationId,
            userId,
            `${reactorName} reacted ${emoji} to ${messageOwnerName}'s message`,
          ),
        );
      }

      if (sideEffects.length > 0) {
        void Promise.allSettled(sideEffects);
      }
    }

    res.json({
      success: true,
      data: { message },
    });
  } catch (error) {
    console.error("Add message reaction error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add reaction",
    });
  }
};

export const removeMessageReaction = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { messageId, emoji } = req.params;
    const userId = req.user?.id;

    if (!messageId) {
      return res.status(400).json({
        success: false,
        error: "Message ID is required",
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const originalMessage = await messageService
      .getMessageById(messageId)
      .catch(() => null);
    const hadReactionBefore = hasUserReaction(
      originalMessage?.reactions,
      userId,
      emoji,
    );

    const message = await messageService.removeReaction(
      messageId,
      userId,
      emoji,
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        error: "Message not found",
      });
    }

    const conversationId =
      originalMessage?.conversation?.id || message.conversationId;

    if (conversationId && hadReactionBefore) {
      io.to(`conversation_${conversationId}`).emit("reaction_removed", {
        messageId,
        userId,
        emoji,
        conversationId,
      });
    }

    res.json({
      success: true,
      data: { message },
    });
  } catch (error) {
    console.error("Remove message reaction error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to remove reaction",
    });
  }
};
