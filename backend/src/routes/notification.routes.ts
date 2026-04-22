import { Router } from "express";
import {
  getNotifications,
  getNotificationById,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification,
  deleteAllNotifications,
  createMentionNotifications,
} from "../controllers/notification.controller.js";

const router = Router();

// GET /api/notifications - Get user's notifications
router.get("/", getNotifications);

// GET /api/notifications/unread-count - Get unread notification count
router.get("/unread-count", getUnreadCount);

// POST /api/notifications/mentions - Create persistent mention notifications
router.post("/mentions", createMentionNotifications as any);

// GET /api/notifications/:id - Get specific notification
router.get("/:id", getNotificationById);

// POST /api/notifications/:id/read - Mark notification as read
router.post("/:id/read", markAsRead as any);

// PUT /api/notifications/read-all - Mark all notifications as read
router.put("/read-all", markAllAsRead as any);

// DELETE /api/notifications/:id - Delete notification
router.delete("/:id", deleteNotification);

// DELETE /api/notifications - Delete all notifications
router.delete("/", deleteAllNotifications);

export default router;
