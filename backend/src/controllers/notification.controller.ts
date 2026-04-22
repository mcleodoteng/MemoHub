import { Request, Response } from "express";
import { NotificationService } from "../services/notification.service.js";
import { z } from "zod";

const notificationService = new NotificationService();

// Validation schemas
const getNotificationsSchema = z.object({
  query: z.object({
    read: z
      .string()
      .optional()
      .transform((val) => val === "true"),
    type: z.string().optional(),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : 50)),
    offset: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val) : 0)),
  }),
});

const markAsReadSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

const createMentionNotificationsSchema = z.object({
  body: z.object({
    mentionedUserIds: z.array(z.string()).min(1),
    sourceTitle: z.string().min(1),
    actionUrl: z.string().optional(),
  }),
});

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const { query } = getNotificationsSchema.parse({ query: req.query });
    const userId = (req as any).user.id;

    const notifications = await notificationService.getNotifications(
      userId,
      query,
    );

    res.json({
      success: true,
      data: { notifications },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: error.errors,
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to fetch notifications",
      });
    }
  }
};

export const getNotificationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const notification = await notificationService.getNotificationById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: "Notification not found",
      });
    }

    if (notification.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: "Access denied",
      });
    }

    res.json({
      success: true,
      data: { notification },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch notification",
    });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const result = await notificationService.markAsRead(id, userId);

    if (result.count === 0) {
      return res.status(404).json({
        success: false,
        error: "Notification not found or access denied",
      });
    }

    res.json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to mark notification as read",
    });
  }
};

export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const result = await notificationService.markAllAsRead(userId);

    res.json({
      success: true,
      message: `${result.count} notifications marked as read`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to mark notifications as read",
    });
  }
};

export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const count = await notificationService.getUnreadCount(userId);

    res.json({
      success: true,
      data: { unreadCount: count },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to get unread count",
    });
  }
};

export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const result = await notificationService.deleteNotification(id, userId);

    if (result.count === 0) {
      return res.status(404).json({
        success: false,
        error: "Notification not found or access denied",
      });
    }

    res.json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to delete notification",
    });
  }
};

export const deleteAllNotifications = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const result = await notificationService.deleteAllNotifications(userId);

    res.json({
      success: true,
      message: `${result.count} notifications deleted`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to delete notifications",
    });
  }
};

export const createMentionNotifications = async (
  req: Request,
  res: Response,
) => {
  try {
    const { body } = createMentionNotificationsSchema.parse({ body: req.body });
    const authorId = (req as any).user.id;
    const authorName = (req as any).user.name || "Someone";

    const recipientIds = [...new Set(body.mentionedUserIds)].filter(
      (userId) => userId && userId !== authorId,
    );

    if (recipientIds.length === 0) {
      return res.json({
        success: true,
        data: { created: 0 },
      });
    }

    const created = await Promise.all(
      recipientIds.map((recipientId) =>
        notificationService.createNotification({
          userId: recipientId,
          type: "mention",
          title: "You were mentioned",
          body: `${authorName} mentioned you in ${body.sourceTitle}`,
          actionUrl: body.actionUrl,
        }),
      ),
    );

    res.status(201).json({
      success: true,
      data: { created: created.length },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid mention notification payload",
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to create mention notifications",
    });
  }
};
