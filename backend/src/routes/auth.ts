import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { endpointRateLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';
import { DatabaseService } from '../services/DatabaseService';
import { 
  generateToken, 
  generateRefreshToken, 
  hashPassword, 
  comparePassword,
  requireAuth,
  AuthenticatedRequest
} from '../middleware/auth';
import { ApiError } from '../utils/ApiError';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { config } from '../config/settings';

const router = Router();

// In-memory user store for demo purposes
// In production, this would be replaced with database queries
const users = new Map<string, { 
  id: string; 
  email: string; 
  name: string;
  passwordHash: string; 
  role: 'user' | 'admin';
  refreshTokens: Set<string>;
}>();

// Apply strict rate limiting to auth endpoints
const authRateLimiter = endpointRateLimiter('auth');

/**
 * POST /auth/register - Register a new user
 */
router.post('/register', authRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  if (password.length < 8) {
    throw new ApiError(400, 'Password must be at least 8 characters');
  }

  // Check if user already exists
  const existingUser = Array.from(users.values()).find(u => u.email === email);
  if (existingUser) {
    throw new ApiError(409, 'User with this email already exists');
  }
  
  const userId = uuidv4();
  const hashedPassword = await hashPassword(password);

  // Store user
  users.set(userId, {
    id: userId,
    email,
    name: name || email.split('@')[0],
    passwordHash: hashedPassword,
    role: 'user',
    refreshTokens: new Set()
  });

  // Generate tokens
  const accessToken = generateToken(userId, email, 'user');
  const refreshToken = generateRefreshToken(userId);
  
  // Store refresh token
  users.get(userId)!.refreshTokens.add(refreshToken);

  logger.info('User registered successfully', { userId, email });

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: userId,
        email,
        name: name || email.split('@')[0],
        role: 'user'
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 604800 // 7 days in seconds
      }
    },
    message: 'Registration successful'
  });
}));

/**
 * POST /auth/login - Authenticate user
 */
router.post('/login', authRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  // Find user by email
  const user = Array.from(users.values()).find(u => u.email === email);
  
  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }
  
  // Verify password
  const isValidPassword = await comparePassword(password, user.passwordHash);
  if (!isValidPassword) {
    throw new ApiError(401, 'Invalid email or password');
  }
  
  // Generate tokens
  const accessToken = generateToken(user.id, email, user.role);
  const refreshToken = generateRefreshToken(user.id);
  
  // Store refresh token
  user.refreshTokens.add(refreshToken);

  logger.info('User logged in', { userId: user.id, email });

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 604800
      }
    },
    message: 'Login successful'
  });
}));

/**
 * POST /auth/refresh - Refresh access token
 */
router.post('/refresh', authRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new ApiError(400, 'Refresh token is required');
  }

  // Verify refresh token
  let payload: { userId: string; type: string };
  try {
    payload = jwt.verify(refreshToken, config.security.jwtSecret) as { userId: string; type: string };
  } catch (error) {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }
  
  if (payload.type !== 'refresh') {
    throw new ApiError(401, 'Invalid token type');
  }
  
  // Find user and verify refresh token is valid
  const user = users.get(payload.userId);
  if (!user || !user.refreshTokens.has(refreshToken)) {
    throw new ApiError(401, 'Invalid refresh token');
  }
  
  // Revoke old refresh token
  user.refreshTokens.delete(refreshToken);
  
  // Generate new tokens
  const newAccessToken = generateToken(user.id, user.email, user.role);
  const newRefreshToken = generateRefreshToken(user.id);
  
  // Store new refresh token
  user.refreshTokens.add(newRefreshToken);

  res.json({
    success: true,
    data: {
      tokens: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 604800
      }
    },
    message: 'Token refreshed successfully'
  });
}));

/**
 * POST /auth/logout - Logout user
 */
router.post('/logout', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;

  if (userId) {
    const user = users.get(userId);
    if (user) {
      // Revoke all refresh tokens for this user
      user.refreshTokens.clear();
    }
  }

  logger.info('User logged out', { userId });

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
}));

/**
 * GET /auth/me - Get current user info
 */
router.get('/me', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new ApiError(401, 'Not authenticated');
  }
  
  const user = users.get(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    }
  });
}));

/**
 * POST /auth/change-password - Change user password
 */
router.post('/change-password', requireAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user?.userId;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'Current password and new password are required');
  }

  if (newPassword.length < 8) {
    throw new ApiError(400, 'New password must be at least 8 characters');
  }

  if (!userId) {
    throw new ApiError(401, 'Not authenticated');
  }
  
  const user = users.get(userId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  // Verify current password
  const isValidPassword = await comparePassword(currentPassword, user.passwordHash);
  if (!isValidPassword) {
    throw new ApiError(401, 'Current password is incorrect');
  }
  
  // Hash and store new password
  user.passwordHash = await hashPassword(newPassword);
  
  // Revoke all refresh tokens (force re-login)
  user.refreshTokens.clear();

  logger.info('Password changed', { userId });

  res.json({
    success: true,
    message: 'Password changed successfully. Please log in again.'
  });
}));

export default router;
