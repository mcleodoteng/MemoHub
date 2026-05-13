import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../config/prisma.js";
import { config } from "../config/env.js";
import { AuthRequest } from "../middleware/auth.middleware.js";
import { hasPermission } from "../middleware/role-permissions.js";
import { resolveEffectiveRole } from "../utils/superuser.js";
import { EmailService } from "../services/email.service.js";
import {
  getResolvedBaseRole,
  getResolvedRoleLabel,
} from "../services/role-config.service.js";

const emailService = new EmailService();

const toSessionTimeout = (value?: number | null) => {
  if (!value || Number.isNaN(value)) return 30;
  return Math.min(480, Math.max(5, Math.trunc(value)));
};

const signAccessToken = (user: {
  id: string;
  email: string;
  role: string;
  sessionTimeoutMinutes?: number | null;
}) => {
  const secret = config.jwtSecret!;
  const timeoutMinutes = toSessionTimeout(user.sessionTimeoutMinutes);
  return (jwt as any).sign(
    { userId: user.id, email: user.email, role: user.role },
    secret,
    { expiresIn: `${timeoutMinutes}m` },
  );
};

const signTwoFactorChallengeToken = (user: { id: string; email: string }) =>
  (jwt as any).sign(
    { userId: user.id, email: user.email, type: "2fa-challenge" },
    config.jwtSecret!,
    { expiresIn: "10m" },
  );

const signPasswordSetupToken = (user: { id: string; email: string }) =>
  (jwt as any).sign(
    { userId: user.id, email: user.email, type: "password-setup" },
    config.jwtSecret!,
    { expiresIn: "15m" },
  );

const buildUserPayload = (user: {
  id: string;
  name: string;
  email: string;
  bio?: string | null;
  role: string;
  department?: string | null;
  avatar?: string | null;
  createdAt?: Date;
  twoFactorEnabled?: boolean;
  sessionTimeoutMinutes?: number | null;
}) => {
  const baseRole = getResolvedBaseRole(user.role);
  const assignedRoleKey = user.role;
  const assignedRoleName = getResolvedRoleLabel(user.role);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    bio: user.bio,
    role: resolveEffectiveRole(baseRole, user.email),
    assignedRoleKey,
    assignedRoleName,
    baseRole,
    department: user.department,
    avatar: user.avatar,
    status: "online" as const,
    createdAt: user.createdAt,
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    sessionTimeoutMinutes: toSessionTimeout(user.sessionTimeoutMinutes),
  };
};

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, department } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res
        .status(409)
        .json({ success: false, error: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, config.bcryptRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
        department: department || "General",
        role: "member",
      },
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        role: true,
        department: true,
        createdAt: true,
      },
    });

    const effectiveRole = resolveEffectiveRole(user.role, user.email);
    const token = signAccessToken({
      id: user.id,
      email: user.email,
      role: effectiveRole,
      sessionTimeoutMinutes: 30,
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          ...user,
          role: effectiveRole,
          twoFactorEnabled: false,
          sessionTimeoutMinutes: 30,
        },
        token,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ success: false, error: "Registration failed" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        bio: true,
        role: true,
        department: true,
        avatar: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials" });
    }

    // Verify password
    if (!user.passwordHash || typeof user.passwordHash !== "string") {
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials" });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials" });
    }

    // Reject blocked accounts
    const effectiveRole = resolveEffectiveRole(user.role, user.email);

    const token = signAccessToken({
      id: user.id,
      email: user.email,
      role: effectiveRole,
      sessionTimeoutMinutes: undefined,
    });

    // Update last login
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    } catch (updateErr) {
      console.warn("Could not persist lastLoginAt:", updateErr);
    }

    res.json({
      success: true,
      data: {
        user: {
          ...buildUserPayload({
            id: user.id,
            name: user.name,
            email: user.email,
            bio: user.bio,
            role: user.role,
            department: user.department,
            avatar: user.avatar,
            createdAt: user.createdAt,
            twoFactorEnabled: false,
            sessionTimeoutMinutes: 30,
          }),
        },
        token,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, error: "Login failed" });
  }
};

export const verifyTwoFactor = async (req: Request, res: Response) => {
  try {
    const { challengeToken, code } = req.body as {
      challengeToken?: string;
      code?: string;
    };

    if (!challengeToken || !code) {
      return res.status(400).json({
        success: false,
        error: "Challenge token and code are required",
      });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(challengeToken, config.jwtSecret!);
    } catch {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired verification session",
      });
    }

    if (decoded.type !== "2fa-challenge") {
      return res.status(401).json({
        success: false,
        error: "Invalid verification session",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    if (!user || !user.twoFactorEnabled) {
      return res.status(401).json({
        success: false,
        error: "Two-factor authentication is not enabled",
      });
    }

    if (!user.twoFactorCodeHash || !user.twoFactorCodeExpires) {
      return res.status(401).json({
        success: false,
        error: "Verification code is missing or expired",
      });
    }

    if (user.twoFactorCodeExpires.getTime() < Date.now()) {
      return res.status(401).json({
        success: false,
        error: "Verification code has expired",
      });
    }

    const candidateHash = crypto
      .createHash("sha256")
      .update(code.trim())
      .digest("hex");

    if (candidateHash !== user.twoFactorCodeHash) {
      return res.status(401).json({
        success: false,
        error: "Invalid verification code",
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        twoFactorCodeHash: null,
        twoFactorCodeExpires: null,
      } as any,
    });

    const effectiveRole = resolveEffectiveRole(user.role, user.email);
    const token = signAccessToken({
      id: user.id,
      email: user.email,
      role: effectiveRole,
      sessionTimeoutMinutes: user.sessionTimeoutMinutes,
    });

    res.json({
      success: true,
      data: {
        user: buildUserPayload({
          id: user.id,
          name: user.name,
          email: user.email,
          bio: user.bio,
          role: user.role,
          department: user.department,
          avatar: user.avatar,
          createdAt: user.createdAt,
          twoFactorEnabled: user.twoFactorEnabled,
          sessionTimeoutMinutes: user.sessionTimeoutMinutes,
        }),
        token,
      },
    });
  } catch (error) {
    console.error("Verify 2FA error:", error);
    res.status(500).json({ success: false, error: "Verification failed" });
  }
};

export const completePasswordSetup = async (req: Request, res: Response) => {
  try {
    const { setupToken, password } = req.body as {
      setupToken?: string;
      password?: string;
    };

    if (!setupToken || !password) {
      return res.status(400).json({
        success: false,
        error: "Setup token and password are required",
      });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(setupToken, config.jwtSecret!);
    } catch {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired password setup session",
      });
    }

    if (decoded.type !== "password-setup") {
      return res.status(401).json({
        success: false,
        error: "Invalid password setup session",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Account does not exist",
      });
    }

    if ((user as any).isBlocked) {
      return res.status(403).json({
        success: false,
        error:
          "Your account has been suspended. Please contact your administrator.",
      });
    }

    const passwordPolicy = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordPolicy.test(password)) {
      return res.status(400).json({
        success: false,
        error:
          "Password must be at least 8 characters and include uppercase, lowercase, and a number",
      });
    }

    const hashedPassword = await bcrypt.hash(password, config.bcryptRounds);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        lastLoginAt: new Date(),
      },
    });

    const effectiveRole = resolveEffectiveRole(user.role, user.email);
    const token = signAccessToken({
      id: user.id,
      email: user.email,
      role: effectiveRole,
      sessionTimeoutMinutes: user.sessionTimeoutMinutes,
    });

    res.json({
      success: true,
      data: {
        user: buildUserPayload({
          id: user.id,
          name: user.name,
          email: user.email,
          bio: user.bio,
          role: user.role,
          department: user.department,
          avatar: user.avatar,
          createdAt: user.createdAt,
          twoFactorEnabled: user.twoFactorEnabled,
          sessionTimeoutMinutes: user.sessionTimeoutMinutes,
        }),
        token,
      },
    });
  } catch (error) {
    console.error("Complete password setup error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to complete password setup",
    });
  }
};

export const logout = async (req: Request, res: Response) => {
  // For stateless JWT, logout is handled on client side
  // In production, you might want to implement token blacklisting
  res.json({ success: true, data: {} });
};

export const resendTwoFactor = async (req: Request, res: Response) => {
  try {
    const { challengeToken } = req.body as { challengeToken?: string };

    if (!challengeToken) {
      return res.status(400).json({
        success: false,
        error: "Challenge token is required",
      });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(challengeToken, config.jwtSecret!);
    } catch {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired verification session",
      });
    }

    if (decoded.type !== "2fa-challenge") {
      return res.status(401).json({
        success: false,
        error: "Invalid verification session",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    if (!user || !(user as any).twoFactorEnabled) {
      return res.status(401).json({
        success: false,
        error: "Two-factor authentication is not enabled",
      });
    }

    // Rate-limit: allow resend only after 30 seconds since last code was issued.
    const existingExpires: Date | null = (user as any).twoFactorCodeExpires;
    if (existingExpires) {
      const issuedAt = existingExpires.getTime() - 10 * 60 * 1000;
      const secondsSinceIssued = (Date.now() - issuedAt) / 1000;
      if (secondsSinceIssued < 30) {
        return res.status(429).json({
          success: false,
          error: `Please wait ${Math.ceil(30 - secondsSinceIssued)} seconds before requesting a new code`,
        });
      }
    }

    const code = `${Math.floor(100000 + Math.random() * 900000)}`;
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    const codeExpires = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorCodeHash: codeHash,
        twoFactorCodeExpires: codeExpires,
      } as any,
    });

    // Issue a fresh challenge token so the session window resets.
    const newChallengeToken = signTwoFactorChallengeToken({
      id: user.id,
      email: user.email,
    });

    void emailService
      .sendTwoFactorCodeEmail(user.email, code)
      .catch((emailError) => {
        console.error("2FA resend email delivery failed:", emailError);
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            `[2FA DEV FALLBACK] Resend failed. Code for ${user.email}: ${code}`,
          );
        }
      });

    return res.json({
      success: true,
      data: { challengeToken: newChallengeToken },
    });
  } catch (error) {
    console.error("Resend 2FA error:", error);
    res.status(500).json({ success: false, error: "Failed to resend code" });
  }
};

export const sendTestEmail = async (req: AuthRequest, res: Response) => {
  try {
    if (!hasPermission(req.user?.role, "canAccessSystemSettings")) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const { email, kind } = req.body as {
      email?: string;
      kind?: "2fa" | "password-reset" | "welcome";
    };

    const targetEmail = email?.trim().toLowerCase() || req.user?.email;
    if (!targetEmail) {
      return res.status(400).json({
        success: false,
        error: "Target email is required",
      });
    }

    const selectedKind = kind || "2fa";

    if (selectedKind === "2fa") {
      const code = `${Math.floor(100000 + Math.random() * 900000)}`;
      await emailService.sendTwoFactorCodeEmail(targetEmail, code);
    } else if (selectedKind === "password-reset") {
      const resetToken = crypto.randomBytes(32).toString("hex");
      await emailService.sendPasswordResetEmail(targetEmail, resetToken);
    } else {
      await emailService.sendWelcomeEmail(
        targetEmail,
        req.user?.name || "User",
      );
    }

    res.json({
      success: true,
      data: {
        email: targetEmail,
        kind: selectedKind,
        message: "Test email sent",
      },
    });
  } catch (error) {
    console.error("Test email error:", error);
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to send test email",
    });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if email exists for security
      return res.json({
        success: true,
        data: { message: "If email exists, reset link will be sent" },
      });
    }

    // Generate reset token (expires in 1 hour)
    const resetToken = jwt.sign(
      { userId: user.id, email: user.email, type: "password-reset" },
      config.jwtSecret!,
      { expiresIn: "1h" },
    );

    // In production, send email with reset link containing the token
    // For now, just log it
    console.log(
      `[Mock] Reset token for ${email}: /reset-password?token=${resetToken}`,
    );

    res.json({
      success: true,
      data: { message: "Reset link sent to email" },
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ success: false, error: "Request failed" });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res
        .status(400)
        .json({ success: false, error: "Token and password required" });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 6 characters",
      });
    }

    // Verify token
    let decoded: any;
    try {
      decoded = jwt.verify(token, config.jwtSecret!) as any;
    } catch (err) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid or expired reset link" });
    }

    if (decoded.type !== "password-reset") {
      return res
        .status(401)
        .json({ success: false, error: "Invalid reset token" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, config.bcryptRounds);

    // Update user password
    const user = await prisma.user.update({
      where: { id: decoded.userId },
      data: { passwordHash: hashedPassword },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
      },
    });

    res.json({
      success: true,
      data: { message: "Password reset successfully", user },
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ success: false, error: "Reset failed" });
  }
};
