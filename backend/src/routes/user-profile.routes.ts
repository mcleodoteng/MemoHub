import { Router } from "express";
import {
  getProfile,
  updateProfile,
  updateAvatar,
  updateStatus,
  getUserStats,
} from "../controllers/user-profile.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

// All profile routes require authentication
router.use(authMiddleware);

// GET /api/profile - Get current user profile
router.get("/", getProfile);

// PUT /api/profile - Update user profile
router.put("/", updateProfile);

// PUT /api/profile/avatar - Update user avatar
router.put("/avatar", updateAvatar);

// PUT /api/profile/status - Update user status
router.put("/status", updateStatus);

// GET /api/profile/stats - Get user statistics
router.get("/stats", getUserStats);

export default router;
