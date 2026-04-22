import { Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../middleware/auth.middleware.js";
import { CreateReminderData } from "../repositories/reminder.repository.js";
import { ReminderService } from "../services/reminder.service.js";

const reminderService = new ReminderService();

const createReminderSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(1000).optional(),
  groupId: z.string().optional(),
  dueAt: z.string().datetime("Invalid due date"),
});

const deleteReminderSchema = z.object({
  id: z.string().min(1, "Reminder id is required"),
});

export const getReminders = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const reminders = await reminderService.getUserVisibleReminders(userId);

    res.json({
      success: true,
      data: { reminders },
    });
  } catch (error) {
    console.error("Get reminders error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch reminders",
    });
  }
};

export const createReminder = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const validationResult = createReminderSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: validationResult.error.issues,
      });
    }

    const reminder = await reminderService.createReminder({
      ...(validationResult.data as Omit<
        CreateReminderData,
        "userId" | "dueAt"
      > & {
        dueAt: string;
      }),
      userId,
    });

    res.status(201).json({
      success: true,
      data: { reminder },
    });
  } catch (error: any) {
    if (error.message === "Access denied to group reminder") {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }

    console.error("Create reminder error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create reminder",
    });
  }
};

export const deleteReminder = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized",
      });
    }

    const validationResult = deleteReminderSchema.safeParse(req.params);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: validationResult.error.issues,
      });
    }

    await reminderService.deleteReminder(validationResult.data.id, userId);

    res.json({
      success: true,
      message: "Reminder deleted",
    });
  } catch (error: any) {
    if (error.message === "Reminder not found") {
      return res.status(404).json({
        success: false,
        error: error.message,
      });
    }

    if (error.message === "Access denied") {
      return res.status(403).json({
        success: false,
        error: error.message,
      });
    }

    console.error("Delete reminder error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete reminder",
    });
  }
};
