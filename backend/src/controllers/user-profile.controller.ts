import { Request, Response } from "express";
import { UserProfileService } from "../services/user-profile.service.js";
import { AuthRequest } from "../middleware/auth.middleware.js";
import { z } from "zod";

const userProfileService = new UserProfileService();

// Validation schemas
const updateProfileSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name too long")
    .optional(),
  bio: z.string().max(500, "Bio too long").optional(),
  department: z
    .string()
    .min(1, "Department is required")
    .max(50, "Department too long")
    .optional(),
  avatar: z.string().url("Invalid avatar URL").optional(),
  status: z.enum(["online", "away", "busy", "offline"]).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["online", "away", "busy", "offline"]),
});

/**
 * Get current user profile
 */
export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const profile = await userProfileService.getProfile(userId);

    res.json({
      success: true,
      data: profile,
    });
  } catch (error: any) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get profile",
    });
  }
};

/**
 * Update user profile
 */
export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const validationResult = updateProfileSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: validationResult.error.issues,
      });
    }

    const userId = req.user!.id;
    const updateData = validationResult.data;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get("User-Agent");

    const updatedProfile = await userProfileService.updateProfile(
      userId,
      updateData,
      ipAddress as string,
      userAgent,
    );

    res.json({
      success: true,
      data: updatedProfile,
    });
  } catch (error: any) {
    console.error("Update profile error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update profile",
    });
  }
};

/**
 * Update user avatar
 */
export const updateAvatar = async (req: AuthRequest, res: Response) => {
  try {
    const { avatarUrl } = req.body;

    if (!avatarUrl || typeof avatarUrl !== "string") {
      return res.status(400).json({
        success: false,
        error: "Avatar URL is required",
      });
    }

    const userId = req.user!.id;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get("User-Agent");

    const updatedProfile = await userProfileService.updateAvatar(
      userId,
      avatarUrl,
      ipAddress as string,
      userAgent,
    );

    res.json({
      success: true,
      data: updatedProfile,
    });
  } catch (error: any) {
    console.error("Update avatar error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update avatar",
    });
  }
};

/**
 * Update user status
 */
export const updateStatus = async (req: AuthRequest, res: Response) => {
  try {
    const validationResult = updateStatusSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid status",
        details: validationResult.error.issues,
      });
    }

    const userId = req.user!.id;
    const { status } = validationResult.data;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get("User-Agent");

    const updatedProfile = await userProfileService.updateStatus(
      userId,
      status,
      ipAddress as string,
      userAgent,
    );

    res.json({
      success: true,
      data: updatedProfile,
    });
  } catch (error: any) {
    console.error("Update status error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update status",
    });
  }
};

/**
 * Get user statistics
 */
export const getUserStats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const stats = await userProfileService.getUserStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("Get user stats error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get user statistics",
    });
  }
};
