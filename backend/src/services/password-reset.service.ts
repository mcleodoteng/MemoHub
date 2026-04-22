import crypto from "crypto";
import bcrypt from "bcrypt";
import { UserRepository } from "../repositories/user.repository.js";
import { EmailService } from "./email.service.js";
import { LoggingService } from "./logging.service.js";

export class PasswordResetService {
  private userRepository: UserRepository;
  private emailService: EmailService;
  private loggingService: LoggingService;

  constructor() {
    this.userRepository = new UserRepository();
    this.emailService = new EmailService();
    this.loggingService = new LoggingService();
  }

  /**
   * Generate a password reset token and send email
   */
  async requestPasswordReset(
    email: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ devResetUrl?: string; emailNotFound?: boolean }> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      return { emailNotFound: true };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Set expiry (1 hour from now)
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

    // Update user with reset token
    await this.userRepository.updatePasswordResetToken(
      user.id,
      hashedToken,
      resetExpires,
    );

    const devResetUrl =
      process.env.NODE_ENV !== "production"
        ? `${process.env.FRONTEND_URL || "http://localhost:8080"}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`
        : undefined;

    // Send reset email
    try {
      await this.emailService.sendPasswordResetEmail(user.email, resetToken);

      // Log the password reset request
      await this.loggingService.logActivity({
        userId: user.id,
        action: "password_reset_requested",
        resourceType: "user",
        resourceId: user.id,
        details: { email: user.email },
        ipAddress,
        userAgent,
      });
    } catch (error) {
      console.error("Failed to send password reset email:", error);
      // Do not throw here; forgot-password should remain idempotent and
      // avoid leaking operational delivery failures to clients.
      if (devResetUrl) {
        console.warn(
          `[PASSWORD RESET DEV FALLBACK] Delivery failed for ${user.email}. Reset URL: ${devResetUrl}`,
        );
      }

      await this.loggingService.logActivity({
        userId: user.id,
        action: "password_reset_email_failed",
        resourceType: "user",
        resourceId: user.id,
        details: { email: user.email },
        ipAddress,
        userAgent,
      });
    }

    return { devResetUrl };
  }

  /**
   * Consume a reset link token as soon as it is opened and issue a fresh,
   * short-lived token for the active reset session.
   */
  async consumeResetLink(
    token: string,
  ): Promise<{ valid: boolean; nextToken?: string }> {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user =
      await this.userRepository.findByPasswordResetToken(hashedToken);

    if (!user) {
      return { valid: false };
    }

    const nextToken = crypto.randomBytes(32).toString("hex");
    const nextHashedToken = crypto
      .createHash("sha256")
      .update(nextToken)
      .digest("hex");

    // Keep the second-step token short-lived.
    const nextExpires = new Date(Date.now() + 15 * 60 * 1000);

    await this.userRepository.updatePasswordResetToken(
      user.id,
      nextHashedToken,
      nextExpires,
    );

    return { valid: true, nextToken };
  }

  /**
   * Reset password using token
   */
  async resetPassword(
    token: string,
    newPassword: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user =
      await this.userRepository.findByPasswordResetToken(hashedToken);
    if (!user) {
      throw new Error("Invalid or expired reset token");
    }

    // Token is valid (findByPasswordResetToken filters by expiration)
    // Hash the new password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password and clear reset token
    await this.userRepository.updatePasswordAndClearResetToken(
      user.id,
      passwordHash,
    );

    // Log the password reset
    await this.loggingService.logActivity({
      userId: user.id,
      action: "password_reset_completed",
      resourceType: "user",
      resourceId: user.id,
      details: { email: user.email },
      ipAddress,
      userAgent,
    });
  }

  /**
   * Validate reset token (without using it)
   */
  async validateResetToken(token: string): Promise<boolean> {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user =
      await this.userRepository.findByPasswordResetToken(hashedToken);
    // If user exists, token is valid (already checked in findByPasswordResetToken)
    return !!user;
  }
}
