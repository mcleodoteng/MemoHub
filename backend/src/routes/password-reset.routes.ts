import { Router } from "express";
import {
  forgotPassword,
  resetPassword,
  validateResetToken,
} from "../controllers/password-reset.controller.js";

const router = Router();

// POST /api/auth/forgot-password - Request password reset
router.post("/forgot-password", forgotPassword);

// POST /api/auth/reset-password - Reset password with token
router.post("/reset-password", resetPassword);

// GET /api/auth/validate-reset-token - Validate reset token
router.get("/validate-reset-token", validateResetToken);

export default router;
