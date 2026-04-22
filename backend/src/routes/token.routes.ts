import { Router } from 'express';
import { refreshToken } from '../controllers/token.controller.js';

const router = Router();

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', refreshToken);

export default router;