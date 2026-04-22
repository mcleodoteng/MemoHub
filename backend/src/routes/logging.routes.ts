import { Router } from "express";
import {
  getUserActivityLogs,
  getResourceActivityLogs,
  getRecentActivityLogs,
} from "../controllers/logging.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

// All logging routes require authentication
router.use(authMiddleware);

// GET /api/logs/user - Get current user's activity logs
router.get("/user", getUserActivityLogs);

// GET /api/logs/resource/:resourceType/:resourceId - Get activity logs for a resource (admin)
router.get("/resource/:resourceType/:resourceId", getResourceActivityLogs);

// GET /api/logs/recent - Get recent system activity logs (admin)
router.get("/recent", getRecentActivityLogs);

export default router;
