import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware.js";
import { hasPermission } from "../middleware/role-permissions.js";
import { ReportsService } from "../services/reports.service.js";

const reportsService = new ReportsService();

export const getReportsSource = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    if (!hasPermission(req.user.role, "canAccessReports")) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const source = await reportsService.getSourceForUser(
      req.user.id,
      req.user.role,
    );

    return res.json({ success: true, data: source });
  } catch (error) {
    console.error("Get reports source error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Failed to fetch reports source" });
  }
};
