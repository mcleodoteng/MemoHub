import { Request, Response } from "express";
import { LoggingService } from "../services/logging.service.js";
import { AuthRequest } from "../middleware/auth.middleware.js";
import { hasPermission } from "../middleware/role-permissions.js";

const loggingService = new LoggingService();

/**
 * Get activity logs for the current user
 */
export const getUserActivityLogs = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { limit = 50, offset = 0 } = req.query;

    const logs = await loggingService.getUserActivityLogs(
      userId,
      parseInt(limit as string),
      parseInt(offset as string),
    );

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error("Error fetching user activity logs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch activity logs",
    });
  }
};

/**
 * Get activity logs for a specific resource (admin only)
 */
export const getResourceActivityLogs = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { resourceType, resourceId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    if (!hasPermission(req.user?.role, "canViewAuditLogs")) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
      });
    }

    const logs = await loggingService.getResourceActivityLogs(
      resourceType,
      resourceId,
      parseInt(limit as string),
      parseInt(offset as string),
    );

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error("Error fetching resource activity logs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch resource activity logs",
    });
  }
};

/**
 * Get recent system activity logs (admin only)
 */
export const getRecentActivityLogs = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const { limit = 100, offset = 0 } = req.query;

    if (!hasPermission(req.user?.role, "canViewAuditLogs")) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
      });
    }

    const logs = await loggingService.getRecentActivityLogs(
      parseInt(limit as string),
      parseInt(offset as string),
    );

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error("Error fetching recent activity logs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch recent activity logs",
    });
  }
};
