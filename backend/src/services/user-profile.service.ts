import { UserRepository } from "../repositories/user.repository.js";
import { LoggingService } from "./logging.service.js";
import { EmailService } from "./email.service.js";
import { prisma } from "../config/prisma.js";

export interface ProfileUpdateData {
  name?: string;
  bio?: string;
  department?: string;
  avatar?: string;
  status?: string;
}

export class UserProfileService {
  private userRepository: UserRepository;
  private loggingService: LoggingService;
  private emailService: EmailService;

  constructor() {
    this.userRepository = new UserRepository();
    this.loggingService = new LoggingService();
    this.emailService = new EmailService();
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    data: ProfileUpdateData,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Update profile
    const updatedUser = await this.userRepository.update(userId, data);

    // Log profile update
    await this.loggingService.logActivity({
      userId,
      action: "profile_updated",
      resourceType: "user",
      resourceId: userId,
      details: data,
      ipAddress,
      userAgent,
    });

    return updatedUser;
  }

  /**
   * Upload avatar
   */
  async updateAvatar(
    userId: string,
    avatarUrl: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const updatedUser = await this.updateProfile(
      userId,
      { avatar: avatarUrl },
      ipAddress,
      userAgent,
    );

    return updatedUser;
  }

  /**
   * Update user status
   */
  async updateStatus(
    userId: string,
    status: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const validStatuses = ["online", "away", "busy", "offline"];
    if (!validStatuses.includes(status)) {
      throw new Error("Invalid status");
    }

    const updatedUser = await this.updateProfile(
      userId,
      { status },
      ipAddress,
      userAgent,
    );

    return updatedUser;
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const [totalMemos, totalComments, totalReactions, joinedGroups] =
      await Promise.all([
        prisma.memo.count({ where: { creatorId: userId } }),
        prisma.comment.count({ where: { authorId: userId } }),
        prisma.reaction.count({ where: { userId } }),
        prisma.groupMember.count({ where: { userId } }),
      ]);

    return {
      userId,
      totalMemos,
      totalComments,
      totalReactions,
      joinedGroups,
      lastActivity: user.lastLoginAt,
      accountCreated: user.createdAt,
    };
  }

  /**
   * Send welcome email (for new users)
   */
  async sendWelcomeEmail(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    try {
      await this.emailService.sendWelcomeEmail(user.email, user.name);
    } catch (error) {
      console.error("Failed to send welcome email:", error);
      // Don't throw error for welcome email failure
    }
  }
}
