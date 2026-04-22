import { Server, Socket } from "socket.io";
import { MessageService } from "../services/message.service.js";
import { ConversationService } from "../services/conversation.service.js";
import { NotificationService } from "../services/notification.service.js";

const messageService = new MessageService();
const conversationService = new ConversationService();
const notificationService = new NotificationService();

export const handleChatSockets = (io: Server, socket: Socket) => {
  const userId = socket.data.userId;

  // Join conversation room
  socket.on("join_conversation", async (conversationId: string) => {
    try {
      // Verify user has access to this conversation
      const conversation =
        await conversationService.getConversationById(conversationId);

      if (!conversation) {
        socket.emit("error", { message: "Conversation not found" });
        return;
      }

      const participantIds = conversation.participantIds as string[];
      if (!participantIds.includes(userId)) {
        socket.emit("error", { message: "Access denied to conversation" });
        return;
      }

      socket.join(`conversation_${conversationId}`);
      socket.emit("joined_conversation", { conversationId });

      console.log(`User ${userId} joined conversation ${conversationId}`);
    } catch (error) {
      socket.emit("error", { message: "Failed to join conversation" });
    }
  });

  // Leave conversation room
  socket.on("leave_conversation", (conversationId: string) => {
    socket.leave(`conversation_${conversationId}`);
    socket.emit("left_conversation", { conversationId });
    console.log(`User ${userId} left conversation ${conversationId}`);
  });

  // Send message
  socket.on(
    "send_message",
    async (data: {
      conversationId: string;
      body: string;
      attachments?: any[];
      sharedMemo?: any;
    }) => {
      try {
        const { conversationId, body, attachments, sharedMemo } = data;

        // Create message
        const message = await messageService.createMessage({
          conversationId,
          senderId: userId,
          body,
          attachmentIds: attachments || [],
          sharedMemoId: sharedMemo?.id,
        });

        // Get conversation to find recipients
        const conversation =
          await conversationService.getConversationById(conversationId);
        if (!conversation) return;

        const recipientIds = (conversation.participantIds as string[]).filter(
          (id) => id !== userId,
        );

        // Emit to conversation room
        io.to(`conversation_${conversationId}`).emit("new_message", {
          message,
          conversationId,
        });

        // Send notifications to recipients
        if (recipientIds.length > 0) {
          const senderDisplayName =
            socket.data.user?.name || message.sender?.name || "Someone";
          await notificationService.notifyNewMessage(
            conversationId,
            senderDisplayName,
            recipientIds,
            {
              isGroup: conversation.type === "group",
              conversationName: conversation.name || undefined,
              messageBody: body,
            },
          );
        }

        // Mark message as read for sender
        await messageService.markMessageAsRead(message.id, userId);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to send message";
        socket.emit("error", { message: errorMessage });
      }
    },
  );

  // Mark message as read
  socket.on(
    "mark_message_read",
    async (data: { messageId: string; conversationId: string }) => {
      try {
        const { messageId, conversationId } = data;

        await messageService.markMessageAsRead(messageId, userId);

        // Notify other participants that message was read
        socket.to(`conversation_${conversationId}`).emit("message_read", {
          messageId,
          userId,
          conversationId,
        });
      } catch (error) {
        socket.emit("error", { message: "Failed to mark message as read" });
      }
    },
  );

  // Typing indicator
  socket.on("typing_start", (conversationId: string) => {
    socket.to(`conversation_${conversationId}`).emit("user_typing", {
      userId,
      userName: socket.data.user.name,
      conversationId,
    });
  });

  socket.on("typing_stop", (conversationId: string) => {
    socket.to(`conversation_${conversationId}`).emit("user_stopped_typing", {
      userId,
      conversationId,
    });
  });

  // React to message
  socket.on(
    "add_reaction",
    async (data: {
      messageId: string;
      emoji: string;
      conversationId: string;
    }) => {
      try {
        const { messageId, emoji, conversationId } = data;

        const reaction = await messageService.addReaction(
          messageId,
          userId,
          emoji,
        );

        if (!reaction) {
          socket.emit("error", { message: "Message not found" });
          return;
        }

        // Emit to conversation room
        io.to(`conversation_${conversationId}`).emit("reaction_added", {
          messageId,
          emoji,
          userId,
          userName: socket.data.user?.name,
          conversationId,
        });
      } catch (error) {
        socket.emit("error", { message: "Failed to add reaction" });
      }
    },
  );

  // Remove reaction
  socket.on(
    "remove_reaction",
    async (data: {
      messageId: string;
      emoji: string;
      conversationId: string;
    }) => {
      try {
        const { messageId, emoji, conversationId } = data;

        await messageService.removeReaction(messageId, userId, emoji);

        // Emit to conversation room
        io.to(`conversation_${conversationId}`).emit("reaction_removed", {
          messageId,
          userId,
          emoji,
          conversationId,
        });
      } catch (error) {
        socket.emit("error", { message: "Failed to remove reaction" });
      }
    },
  );

  // Star/unstar message
  socket.on(
    "toggle_star",
    async (data: { messageId: string; conversationId: string }) => {
      try {
        const { messageId, conversationId } = data;

        const existingMessage = await messageService.getMessageById(messageId);
        const isStarred = (
          (existingMessage.starredBy as string[]) || []
        ).includes(userId);
        const message = isStarred
          ? await messageService.unstarMessage(messageId, userId)
          : await messageService.starMessage(messageId, userId);

        // Emit to conversation room
        io.to(`conversation_${conversationId}`).emit("message_starred", {
          messageId,
          starred: message.starred,
          starredBy: message.starredBy,
          conversationId,
        });
      } catch (error) {
        socket.emit("error", { message: "Failed to toggle star" });
      }
    },
  );

  // Create thread reply
  socket.on(
    "create_thread_reply",
    async (data: {
      messageId: string;
      replyContent: string;
      conversationId: string;
    }) => {
      try {
        const { messageId, replyContent, conversationId } = data;

        const thread = await messageService.addThreadReply(
          messageId,
          userId,
          replyContent,
        );

        // Emit to conversation room
        io.to(`conversation_${conversationId}`).emit("thread_reply_created", {
          messageId,
          thread,
          conversationId,
        });
      } catch (error) {
        socket.emit("error", { message: "Failed to create thread reply" });
      }
    },
  );
};
