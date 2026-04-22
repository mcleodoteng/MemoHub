import { Request, Response } from 'express';
import { TokenService } from '../services/token.service.js';
import { z } from 'zod';

const tokenService = new TokenService();

// Validation schemas
const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * Refresh access token
 */
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const validationResult = refreshTokenSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.issues,
      });
    }

    const { refreshToken } = validationResult.data;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    const tokens = await tokenService.refreshAccessToken(refreshToken, ipAddress, userAgent);

    res.json({
      success: true,
      data: tokens,
    });
  } catch (error: any) {
    console.error('Token refresh error:', error);

    if (error.message.includes('Invalid') || error.message.includes('expired')) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to refresh token',
    });
  }
};