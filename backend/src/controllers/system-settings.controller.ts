import { Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../middleware/auth.middleware.js";
import { hasPermission } from "../middleware/role-permissions.js";
import { SystemSettingsService } from "../services/system-settings.service.js";

const systemSettingsService = new SystemSettingsService();

const updateSystemSettingsSchema = z.object({
  body: z.object({
    allowPublicMemos: z.boolean(),
    requireApproval: z.boolean(),
    maxAttachmentSize: z.enum(["5", "10", "25", "50"]),
    auditRetention: z.enum(["30", "90", "180", "365"]),
  }),
});

export const getSystemSettings = async (req: AuthRequest, res: Response) => {
  try {
    if (!hasPermission(req.user?.role, "canAccessSystemSettings")) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const settings = await systemSettingsService.getSystemSettings();
    return res.json({ success: true, data: { settings } });
  } catch (error) {
    console.error("Get system settings error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch system settings" });
  }
};

export const updateSystemSettings = async (req: AuthRequest, res: Response) => {
  try {
    if (!hasPermission(req.user?.role, "canAccessSystemSettings")) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const { body } = updateSystemSettingsSchema.parse({ body: req.body });
    const settings = await systemSettingsService.updateSystemSettings(body);
    await systemSettingsService.cleanupExpiredAuditLogs(true);

    return res.json({ success: true, data: { settings } });
  } catch (error) {
    console.error("Update system settings error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid system settings payload",
        details: error.errors,
      });
    }

    return res
      .status(500)
      .json({ success: false, error: "Failed to update system settings" });
  }
};
