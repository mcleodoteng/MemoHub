import { Server, Socket } from "socket.io";
import { MemoService } from "../services/memo.service.js";
import { CommentService } from "../services/comment.service.js";
import { NotificationService } from "../services/notification.service.js";
import { emitReportsDataUpdated } from "./reports.socket.js";

const memoService = new MemoService();
const commentService = new CommentService();
const notificationService = new NotificationService();

export const handleMemoSockets = (io: Server, socket: Socket) => {
  const userId = socket.data.userId;

  const emitToMemoStakeholders = async (
    memoId: string,
    event: string,
    payload: Record<string, any>,
  ) => {
    io.to(`memo_${memoId}`).emit(event, payload);

    try {
      const memo = await memoService.getMemoById(memoId, userId);
      const stakeholderIds = Array.from(
        new Set([memo.creator.id, ...memo.recipients.map((r) => r.id)]),
      );

      stakeholderIds.forEach((stakeholderId) => {
        io.to(`user_${stakeholderId}`).emit(event, payload);
      });

      emitReportsDataUpdated("memo_socket_event", { memoId, event });
    } catch (error) {
      console.error(`Failed to emit ${event} to memo stakeholders:`, error);
    }
  };

  // Join memo room for real-time updates
  socket.on("join_memo", async (memoId: string) => {
    try {
      // Verify user has access to this memo
      const memo = await memoService.getMemoById(memoId, userId);

      if (!memo) {
        socket.emit("error", { message: "Access denied to memo" });
        return;
      }

      socket.join(`memo_${memoId}`);
      socket.emit("joined_memo", { memoId });

      console.log(`User ${userId} joined memo ${memoId}`);
    } catch (error) {
      socket.emit("error", { message: "Failed to join memo" });
    }
  });

  // Leave memo room
  socket.on("leave_memo", (memoId: string) => {
    socket.leave(`memo_${memoId}`);
    socket.emit("left_memo", { memoId });
    console.log(`User ${userId} left memo ${memoId}`);
  });

  // Typing indicator for memo comments
  socket.on("memo_typing_start", (data: { memoId: string }) => {
    socket.to(`memo_${data.memoId}`).emit("memo_user_typing", {
      memoId: data.memoId,
      userId,
      userName: socket.data.user.name,
    });
  });

  socket.on("memo_typing_stop", (data: { memoId: string }) => {
    socket.to(`memo_${data.memoId}`).emit("memo_user_stopped_typing", {
      memoId: data.memoId,
      userId,
    });
  });

  // Mark memo as opened
  socket.on("mark_memo_opened", async (data: { memoId: string }) => {
    try {
      const { memoId } = data;

      // Call API to mark as opened
      await memoService.markAsRead(memoId, userId);

      await emitToMemoStakeholders(memoId, "memo_opened_by_user", {
        memoId,
        userId,
        userName: socket.data.user.name,
      });

      const memo = await memoService.getMemoById(memoId, userId);
      if (memo && memo.creator.id !== userId) {
        await notificationService.createNotification({
          userId: memo.creator.id,
          type: "memo_received",
          title: "Memo Opened",
          body: `${socket.data.user.name} opened your memo "${memo.title}"`,
          actionUrl: `/memos/${memoId}`,
        });
      }
    } catch (error) {
      socket.emit("error", { message: "Failed to mark memo as opened" });
    }
  });

  // Mark memo as acknowledged
  socket.on("mark_memo_acknowledged", async (data: { memoId: string }) => {
    try {
      const { memoId } = data;

      // Call API to mark as acknowledged
      await memoService.acknowledgeMemo(memoId, userId);

      await emitToMemoStakeholders(memoId, "memo_acknowledged_by_user", {
        memoId,
        userId,
        userName: socket.data.user.name,
      });
    } catch (error) {
      socket.emit("error", { message: "Failed to acknowledge memo" });
    }
  });

  // New comment on memo
  socket.on(
    "new_comment",
    async (data: { memoId: string; body: string; parentId?: string }) => {
      try {
        const { memoId, body, parentId } = data;

        const comment = await commentService.createComment({
          memoId,
          authorId: userId,
          body,
          parentId,
        });

        // Get memo recipients for notifications
        const memo = await memoService.getMemoById(memoId, userId);
        if (!memo) return;

        // Notify all parties other than the commenter:
        // memo creator + all recipients (deduplicated, excluding commenter)
        const recipientIds = [
          memo.creator.id,
          ...memo.recipients.map((r) => r.id),
        ].filter((id, idx, arr) => id !== userId && arr.indexOf(id) === idx);

        await emitToMemoStakeholders(memoId, "comment_created", {
          comment,
          memoId,
        });

        // Send notifications
        if (recipientIds.length > 0) {
          await notificationService.notifyNewComment(
            memoId,
            memo.title,
            comment.id,
            socket.data.user.name,
            recipientIds,
          );
        }

        if (parentId) {
          const parentComment = await commentService.getCommentById(parentId);
          const parentAuthorId = parentComment?.author?.id;
          if (
            parentAuthorId &&
            parentAuthorId !== userId &&
            !recipientIds.includes(parentAuthorId)
          ) {
            await notificationService.notifyNewComment(
              memoId,
              memo.title,
              comment.id,
              socket.data.user.name,
              [parentAuthorId],
            );
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to create comment";
        socket.emit("error", { message: errorMessage });
      }
    },
  );

  // React to memo
  socket.on(
    "add_memo_reaction",
    async (data: { memoId: string; emoji: string }) => {
      try {
        const { memoId, emoji } = data;

        const reaction = await memoService.addReaction(memoId, userId, emoji);

        // Emit to memo room
        io.to(`memo_${memoId}`).emit("memo_reaction_added", {
          memoId,
          reaction,
        });
        emitReportsDataUpdated("memo_socket_reaction_added", { memoId });

        // Create notification to memo creator
        const memo = await memoService.getMemoById(memoId, userId);
        if (memo && memo.creator.id !== userId) {
          await notificationService.createNotification({
            userId: memo.creator.id,
            type: "reaction_added",
            title: "Reaction Added",
            body: `${socket.data.user.name} reacted with ${emoji} to your memo "${memo.title}"`,
            actionUrl: `/memos/${memoId}`,
          });
        }
      } catch (error) {
        socket.emit("error", { message: "Failed to add reaction" });
      }
    },
  );

  // Remove memo reaction
  socket.on(
    "remove_memo_reaction",
    async (data: { memoId: string; emoji: string }) => {
      try {
        const { memoId, emoji } = data;

        await memoService.removeReaction(memoId, userId, emoji);

        // Emit to memo room
        io.to(`memo_${memoId}`).emit("memo_reaction_removed", {
          memoId,
          userId,
          emoji,
        });
        emitReportsDataUpdated("memo_socket_reaction_removed", { memoId });
      } catch (error) {
        socket.emit("error", { message: "Failed to remove reaction" });
      }
    },
  );

  // Update memo status (acknowledge, approve, etc.)
  socket.on(
    "update_memo_status",
    async (data: {
      memoId: string;
      status: "acknowledged" | "approved" | "replied";
    }) => {
      try {
        const { memoId, status } = data;

        let recipient;

        switch (status) {
          case "acknowledged":
            recipient = await memoService.acknowledgeMemo(memoId, userId);
            break;
          case "approved":
            recipient = await memoService.approveMemo(memoId, userId);
            break;
          case "replied":
            recipient = await memoService.replyToMemo(memoId, userId);
            break;
        }

        await emitToMemoStakeholders(memoId, "memo_status_updated", {
          memoId,
          userId,
          status,
          recipient,
        });

        // Create notification to memo creator
        const memo = await memoService.getMemoById(memoId, userId);
        if (memo && memo.creator.id !== userId) {
          const statusLabel =
            status === "acknowledged"
              ? "Acknowledged"
              : status === "approved"
                ? "Approved"
                : "Replied to";
          const notificationType =
            status === "approved" ? "memo_approved" : "memo_received";
          await notificationService.createNotification({
            userId: memo.creator.id,
            type: notificationType,
            title: `Memo ${statusLabel}`,
            body: `${socket.data.user.name} ${status === "acknowledged" ? "acknowledged" : status === "approved" ? "approved" : "replied to"} your memo "${memo.title}"`,
            actionUrl: `/memos/${memoId}`,
          });
        }
      } catch (error) {
        socket.emit("error", { message: "Failed to update memo status" });
      }
    },
  );

  // Pin/unpin memo
  socket.on("toggle_memo_pin", async (data: { memoId: string }) => {
    try {
      const { memoId } = data;

      const existingMemo = await memoService.getMemoById(memoId, userId);
      const memo = await memoService.performAction(
        memoId,
        existingMemo.pinned ? "unpin" : "pin",
        userId,
        socket.data.user.role,
      );

      // Emit to memo room
      io.to(`memo_${memoId}`).emit("memo_pin_toggled", {
        memoId,
        pinned: memo.pinned,
      });
      emitReportsDataUpdated("memo_socket_pin_toggled", { memoId });

      if (memo.creatorId !== userId) {
        await notificationService.createNotification({
          userId: memo.creatorId,
          type: "starred_activity",
          title: memo.pinned ? "Memo Pinned" : "Memo Unpinned",
          body: `${socket.data.user.name} ${memo.pinned ? "pinned" : "unpinned"} your memo "${memo.title}"`,
          actionUrl: `/memos/${memoId}`,
        });
      }
    } catch (error) {
      socket.emit("error", { message: "Failed to toggle memo pin" });
    }
  });

  // Workflow approval
  socket.on(
    "approve_memo_workflow",
    async (data: {
      memoId: string;
      stepId: string;
      approved: boolean;
      comments?: string;
    }) => {
      try {
        const { memoId, stepId, approved, comments } = data;

        const result = await memoService.approveMemoWorkflow(
          memoId,
          userId,
          stepId,
          approved,
          comments,
        );

        await emitToMemoStakeholders(memoId, "memo_workflow_approved", {
          memoId,
          approved,
          approverId: userId,
          approverName: socket.data.user.name,
          comments,
          result,
        });

        // Create notification to memo creator about workflow action
        const memo = await memoService.getMemoById(memoId, userId);
        if (memo && memo.creator.id !== userId) {
          const action = approved ? "approved" : "rejected";
          await notificationService.createNotification({
            userId: memo.creator.id,
            type: approved ? "memo_approved" : "memo_rejected",
            title: `Workflow Step ${approved ? "Approved" : "Rejected"}`,
            body: `${socket.data.user.name} ${action} workflow step in memo "${memo.title}"${comments ? `: ${comments}` : ""}`,
            actionUrl: `/memos/${memoId}`,
          });
        }
      } catch (error) {
        socket.emit("error", { message: "Failed to approve workflow" });
      }
    },
  );
};
