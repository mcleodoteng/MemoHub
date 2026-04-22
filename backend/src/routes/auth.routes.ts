import { Router } from "express";
import {
  completePasswordSetup,
  login,
  logout,
  resendTwoFactor,
  sendTestEmail,
  verifyTwoFactor,
} from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { validateRequest } from "../middleware/validation.middleware.js";
import { z } from "zod";

const router = Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifyTwoFactorSchema = z.object({
  challengeToken: z.string().min(1),
  code: z.string().min(6).max(6),
});

const resendTwoFactorSchema = z.object({
  challengeToken: z.string().min(1),
});

const completePasswordSetupSchema = z.object({
  setupToken: z.string().min(1),
  password: z
    .string()
    .min(8)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one lowercase letter, one uppercase letter, and one number",
    ),
});

const testEmailSchema = z.object({
  email: z.string().email().optional(),
  kind: z.enum(["2fa", "password-reset", "welcome"]).optional(),
});

// Routes
// Self-signup is disabled – accounts are created by administrators via POST /api/users
router.post("/register", (_req, res) => {
  res.status(403).json({
    success: false,
    error:
      "Self-registration is disabled. Please contact your system administrator to create an account.",
  });
});
router.post("/login", validateRequest(loginSchema), login);
router.post(
  "/verify-2fa",
  validateRequest(verifyTwoFactorSchema),
  verifyTwoFactor,
);
router.post(
  "/resend-2fa",
  validateRequest(resendTwoFactorSchema),
  resendTwoFactor,
);
router.post(
  "/complete-password-setup",
  validateRequest(completePasswordSetupSchema),
  completePasswordSetup,
);
router.post(
  "/test-email",
  authMiddleware,
  validateRequest(testEmailSchema),
  sendTestEmail,
);
router.post("/logout", logout);
export default router;
