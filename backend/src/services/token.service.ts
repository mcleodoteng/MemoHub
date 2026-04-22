import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { UserRepository } from "../repositories/user.repository.js";
import { LoggingService } from "./logging.service.js";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class TokenService {
  private userRepository: UserRepository;
  private loggingService: LoggingService;

  constructor() {
    this.userRepository = new UserRepository();
    this.loggingService = new LoggingService();
  }

  /**
   * Generate access and refresh token pair
   */
  generateTokens(userId: string, userEmail: string): TokenPair {
    const accessTokenOptions: SignOptions = {
      expiresIn: (process.env.JWT_EXPIRES_IN ||
        "15m") as SignOptions["expiresIn"],
    };
    const refreshTokenOptions: SignOptions = {
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ||
        "7d") as SignOptions["expiresIn"],
    };

    const accessToken = jwt.sign(
      { userId, email: userEmail },
      process.env.JWT_SECRET!,
      accessTokenOptions,
    );

    const refreshToken = jwt.sign(
      { userId, email: userEmail, type: "refresh" },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!,
      refreshTokenOptions,
    );

    return { accessToken, refreshToken };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!,
      ) as any;

      if (decoded.type !== "refresh") {
        throw new Error("Invalid token type");
      }

      // Check if user still exists
      const user = await this.userRepository.findById(decoded.userId);
      if (!user) {
        throw new Error("User not found");
      }

      // Generate new token pair
      const tokens = this.generateTokens(user.id, user.email);

      // Log token refresh
      await this.loggingService.logActivity({
        userId: user.id,
        action: "token_refreshed",
        resourceType: "user",
        resourceId: user.id,
        details: { email: user.email },
        ipAddress,
        userAgent,
      });

      return tokens;
    } catch (error: any) {
      console.error("Token refresh error:", error.message);
      throw new Error("Invalid or expired refresh token");
    }
  }

  /**
   * Verify access token (for middleware)
   */
  verifyAccessToken(token: string): any {
    try {
      return jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      throw new Error("Invalid access token");
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): any {
    try {
      return jwt.verify(
        token,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!,
      );
    } catch (error) {
      throw new Error("Invalid refresh token");
    }
  }
}
