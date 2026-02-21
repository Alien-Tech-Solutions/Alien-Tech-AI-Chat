import { Router, Request, Response } from 'express';
import { MemoryService } from '../services/MemoryService';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler, createNotFoundError } from '../middleware/errorHandler';
import { apiLogger } from '../utils/logger';

// Export factory function for dependency injection
export function createContextRoutes(databaseService: DatabaseService): Router {
  const router = Router();
  const memoryService = new MemoryService(databaseService);

/**
 * GET /api/v1/sessions/:id/context - Fetch context window for a session
 */
router.get('/sessions/:id/context', asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.params.id;
  if (!sessionId) {
    throw createNotFoundError('Session ID is required');
  }
  
  try {
    const context = await memoryService.getContext(sessionId);
    if (context === null) {
      throw createNotFoundError('Session context not found');
    }
    res.json({ context });
  } catch (error) {
    apiLogger.error('Failed to fetch session context:', error);
    throw error;
  }
}));

/**
 * POST /api/v1/sessions/:id/context - Update context window for a session
 */
router.post('/sessions/:id/context', asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.params.id;
  if (!sessionId) {
    throw createNotFoundError('Session ID is required');
  }
  
  const { context } = req.body;
  try {
    await memoryService.setContext(sessionId, context);
    res.json({ message: 'Session context updated' });
  } catch (error) {
    apiLogger.error('Failed to update session context:', error);
    throw error;
  }
}));

/**
 * DELETE /api/v1/sessions/:id/context - Clear context window for a session
 */
router.delete('/sessions/:id/context', asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.params.id;
  if (!sessionId) {
    throw createNotFoundError('Session ID is required');
  }
  
  try {
    await memoryService.clearContext(sessionId);
    res.json({ message: 'Session context cleared' });
  } catch (error) {
    apiLogger.error('Failed to clear session context:', error);
    throw error;
  }
}));

/**
 * GET /api/v1/sessions/:id/context/window - Get formatted context window for AI
 */
router.get('/sessions/:id/context/window', asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.params.id;
  if (!sessionId) {
    throw createNotFoundError('Session ID is required');
  }
  
  const maxTokens = req.query.maxTokens ? parseInt(req.query.maxTokens as string) : undefined;
  
  try {
    const contextWindow = await memoryService.getContextWindow(sessionId, maxTokens);
    res.json({ contextWindow });
  } catch (error) {
    apiLogger.error('Failed to fetch context window:', error);
    throw error;
  }
}));

/**
 * GET /api/v1/sessions/:id/memory/stats - Get memory statistics for a session
 */
router.get('/sessions/:id/memory/stats', asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.params.id;
  if (!sessionId) {
    throw createNotFoundError('Session ID is required');
  }
  
  try {
    const stats = await memoryService.getMemoryStats(sessionId);
    res.json(stats);
  } catch (error) {
    apiLogger.error('Failed to fetch memory stats:', error);
    throw error;
  }
}));

  return router;
}

// Default export for backwards compatibility
const defaultDatabaseService = new DatabaseService();
defaultDatabaseService.initialize().catch(error => {
  apiLogger.error('[CONTEXT] Failed to initialize default database service:', error);
});
export default createContextRoutes(defaultDatabaseService);
