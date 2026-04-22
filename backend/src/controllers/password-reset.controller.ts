import { Request, Response } from "express";
import { PasswordResetService } from "../services/password-reset.service.js";
import { z } from "zod";

const passwordResetService = new PasswordResetService();

// Validation schemas
const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one lowercase letter, one uppercase letter, and one number",
    ),
});

const validateTokenSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
});

/**
 * Request password reset
 */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const validationResult = forgotPasswordSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: validationResult.error.issues,
      });
    }

    const { email } = validationResult.data;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get("User-Agent");

    const result = await passwordResetService.requestPasswordReset(
      email,
      ipAddress,
      userAgent,
    );

    if (result.emailNotFound) {
      return res.status(404).json({
        success: false,
        error: "The email you entered cannot be found.",
      });
    }

    res.json({
      success: true,
      message: "A password reset link has been sent to your email.",
      ...(result.devResetUrl ? { devResetUrl: result.devResetUrl } : {}),
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process password reset request",
    });
  }
};

/**
 * Reset password using token
 */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const validationResult = resetPasswordSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: validationResult.error.issues,
      });
    }

    const { token, password } = validationResult.data;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get("User-Agent");

    await passwordResetService.resetPassword(
      token,
      password,
      ipAddress,
      userAgent,
    );

    res.json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error: any) {
    console.error("Reset password error:", error);

    if (
      error.message.includes("Invalid or expired") ||
      error.message.includes("expired")
    ) {
      return res.status(400).json({
        success: false,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to reset password",
    });
  }
};

/**
 * Validate reset token
 */
export const validateResetToken = async (req: Request, res: Response) => {
  try {
    const validationResult = validateTokenSchema.safeParse(req.query);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: validationResult.error.issues,
      });
    }

    const { token } = validationResult.data;
    const consumed = await passwordResetService.consumeResetLink(token);

    res.json({
      success: true,
      valid: consumed.valid,
      ...(consumed.nextToken ? { token: consumed.nextToken } : {}),
    });
  } catch (error) {
    console.error("Validate token error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to validate token",
    });
  }
};
