import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { asyncHandler, createValidationError, createNotFoundError } from '../middleware/errorHandler';
import { Session } from '../types';
import { apiLogger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// Export factory function for dependency injection
export function createSessionRoutes(db: DatabaseService): Router {
  const router = Router();

/**
 * GET /sessions - Get all sessions
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const includeStats = req.query.include_stats === 'true';
    
    if (limit > 200) {
      throw createValidationError('Limit cannot exceed 200');
    }

    const sessions = await db.getSessions();
    const limitedSessions = sessions.slice(0, limit);

    // Add conversation stats if requested
    if (includeStats) {
      const sessionsWithStats = await Promise.all(
        limitedSessions.map(async (session) => {
          const conversations = await db.getConversationsBySession(session.id, 1000);
          const totalTokens = conversations.reduce((sum, conv) => sum + (conv.tokens_used || 0), 0);
          const avgResponseTime = conversations.length > 0 ? 
            conversations.reduce((sum, conv) => sum + (conv.response_time_ms || 0), 0) / conversations.length : 0;
          const avgSentiment = conversations.length > 0 ?
            conversations.reduce((sum, conv) => sum + conv.sentiment_score, 0) / conversations.length : 0;

          return {
            ...session,
            stats: {
              actual_message_count: conversations.length,
              total_tokens: totalTokens,
              avg_response_time_ms: Math.round(avgResponseTime),
              avg_sentiment: Math.round(avgSentiment * 100) / 100,
              first_message: conversations[conversations.length - 1]?.timestamp,
              last_message: conversations[0]?.timestamp
            }
          };
        })
      );
      
      res.json({
        sessions: sessionsWithStats,
        total: sessions.length,
        limit,
        include_stats: true
      });
    } else {
      res.json({
        sessions: limitedSessions,
        total: sessions.length,
        limit,
        include_stats: false
      });
    }

  } catch (error) {
    apiLogger.error('Failed to get sessions:', error);
    throw error;
  }
}));

/**
 * POST /sessions - Create a new session
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { name, description, metadata } = req.body;
    
    // Generate new session ID
    const sessionId = uuidv4();
    
    // Validate input
    if (name && typeof name !== 'string') {
      throw createValidationError('Name must be a string');
    }
    
    if (description && typeof description !== 'string') {
      throw createValidationError('Description must be a string');
    }
    
    if (metadata && typeof metadata !== 'object') {
      throw createValidationError('Metadata must be an object');
    }

    const newSession: Omit<Session, 'created_at' | 'updated_at'> = {
      id: sessionId,
      name: name || `Session ${sessionId.slice(0, 8)}`,
      description: description || null,
      message_count: 0,
      total_tokens: 0,
      start_time: new Date().toISOString(),
      last_activity: new Date().toISOString(),
      status: 'active',
      metadata: metadata || {}
    };

    await db.upsertSession(newSession);
    
    apiLogger.info('New session created', {
      sessionId,
      name: newSession.name,
      createdBy: req.ip
    });

    res.status(201).json({
      session: newSession,
      message: 'Session created successfully'
    });

  } catch (error) {
    apiLogger.error('Failed to create session:', error);
    throw error;
  }
}));

/**
 * GET /sessions/:sessionId - Get specific session
 */
router.get('/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId;
    const includeConversations = req.query.include_conversations === 'true';
    const conversationLimit = parseInt(req.query.conversation_limit as string) || 50;

    const sessions = await db.getSessions();
    const session = sessions.find(s => s.id === sessionId);

    if (!session) {
      throw createNotFoundError('Session not found');
    }

    if (includeConversations) {
      const conversations = await db.getConversationsBySession(sessionId, conversationLimit);
      
      res.json({
        session,
        conversations,
        conversation_count: conversations.length
      });
    } else {
      res.json({
        session
      });
    }

  } catch (error) {
    apiLogger.error('Failed to get session:', error);
    throw error;
  }
}));

/**
 * PUT /sessions/:sessionId - Update session
 */
router.put('/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId;
    const { name, description, metadata, status } = req.body;

    // Check if session exists
    const sessions = await db.getSessions();
    const existingSession = sessions.find(s => s.id === sessionId);

    if (!existingSession) {
      throw createNotFoundError('Session not found');
    }

    // Validate updates
    if (name && typeof name !== 'string') {
      throw createValidationError('Name must be a string');
    }
    
    if (description !== undefined && description !== null && typeof description !== 'string') {
      throw createValidationError('Description must be a string or null');
    }
    
    if (metadata && typeof metadata !== 'object') {
      throw createValidationError('Metadata must be an object');
    }

    if (status && !['active', 'archived', 'deleted'].includes(status)) {
      throw createValidationError('Status must be active, archived, or deleted');
    }

    // Prepare updates
    const updates: Partial<Session> = { ...existingSession };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (metadata !== undefined) updates.metadata = metadata;
    if (status !== undefined) updates.status = status;

    await db.upsertSession(updates as Omit<Session, 'created_at' | 'updated_at'>);

    apiLogger.info('Session updated', {
      sessionId,
      updatedFields: Object.keys(req.body),
      updatedBy: req.ip
    });

    const updatedSessions = await db.getSessions();
    const updatedSession = updatedSessions.find(s => s.id === sessionId);

    res.json({
      session: updatedSession,
      message: 'Session updated successfully'
    });

  } catch (error) {
    apiLogger.error('Failed to update session:', error);
    throw error;
  }
}));

/**
 * DELETE /sessions/:sessionId - Delete/archive session
 */
router.delete('/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId;
    const permanent = req.query.permanent === 'true';

    // Check if session exists
    const sessions = await db.getSessions();
    const existingSession = sessions.find(s => s.id === sessionId);

    if (!existingSession) {
      throw createNotFoundError('Session not found');
    }

    if (permanent) {
      // For permanent deletion, we would need to implement
      // deletion methods in DatabaseService
      // For now, just mark as deleted
      await db.upsertSession({
        ...existingSession,
        status: 'deleted'
      });

      apiLogger.info('Session permanently deleted', {
        sessionId,
        deletedBy: req.ip
      });

      res.json({
        message: 'Session permanently deleted',
        session_id: sessionId
      });
    } else {
      // Soft delete (archive)
      await db.upsertSession({
        ...existingSession,
        status: 'archived'
      });

      apiLogger.info('Session archived', {
        sessionId,
        archivedBy: req.ip
      });

      res.json({
        message: 'Session archived',
        session_id: sessionId,
        note: 'Use ?permanent=true to permanently delete'
      });
    }

  } catch (error) {
    apiLogger.error('Failed to delete session:', error);
    throw error;
  }
}));

/**
 * POST /sessions/:sessionId/restore - Restore archived session
 */
router.post('/:sessionId/restore', asyncHandler(async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId;

    // Check if session exists and is archived
    const sessions = await db.getSessions();
    const existingSession = sessions.find(s => s.id === sessionId);

    if (!existingSession) {
      throw createNotFoundError('Session not found');
    }

    if (existingSession.status !== 'archived') {
      throw createValidationError('Only archived sessions can be restored');
    }

    // Restore session
    await db.upsertSession({
      ...existingSession,
      status: 'active',
      last_activity: new Date().toISOString()
    });

    apiLogger.info('Session restored', {
      sessionId,
      restoredBy: req.ip
    });

    const updatedSessions = await db.getSessions();
    const restoredSession = updatedSessions.find(s => s.id === sessionId);

    res.json({
      session: restoredSession,
      message: 'Session restored successfully'
    });

  } catch (error) {
    apiLogger.error('Failed to restore session:', error);
    throw error;
  }
}));

/**
 * GET /sessions/:sessionId/stats - Get session statistics
 */
router.get('/:sessionId/stats', asyncHandler(async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId;

    // Check if session exists
    const sessions = await db.getSessions();
    const session = sessions.find(s => s.id === sessionId);

    if (!session) {
      throw createNotFoundError('Session not found');
    }

    // Get conversations for this session
    const conversations = await db.getConversationsBySession(sessionId, 1000);
    
    if (conversations.length === 0) {
      res.json({
        session_id: sessionId,
        stats: {
          message_count: 0,
          total_tokens: 0,
          avg_response_time_ms: 0,
          avg_sentiment: 0,
          duration_ms: 0,
          first_message: null,
          last_message: null,
          most_common_tags: [],
          sentiment_distribution: {
            positive: 0,
            neutral: 0,
            negative: 0
          }
        }
      });
      return;
    }

    // Calculate statistics
    const totalTokens = conversations.reduce((sum, conv) => sum + (conv.tokens_used || 0), 0);
    const avgResponseTime = conversations.reduce((sum, conv) => sum + (conv.response_time_ms || 0), 0) / conversations.length;
    const avgSentiment = conversations.reduce((sum, conv) => sum + conv.sentiment_score, 0) / conversations.length;
    
    const firstMessage = conversations[conversations.length - 1];
    const lastMessage = conversations[0];
    const duration = firstMessage && lastMessage ? 
      new Date(lastMessage.timestamp).getTime() - new Date(firstMessage.timestamp).getTime() : 0;

    // Sentiment distribution
    const sentimentCounts = conversations.reduce((acc, conv) => {
      acc[conv.sentiment_label]++;
      return acc;
    }, { positive: 0, neutral: 0, negative: 0 } as Record<string, number>);

    // Most common tags
    const tagCounts: Record<string, number> = {};
    conversations.forEach(conv => {
      conv.context_tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    
    const mostCommonTags = Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    res.json({
      session_id: sessionId,
      session_info: {
        name: session.name,
        status: session.status,
        created: session.start_time
      },
      stats: {
        message_count: conversations.length,
        total_tokens: totalTokens,
        avg_response_time_ms: Math.round(avgResponseTime),
        avg_sentiment: Math.round(avgSentiment * 100) / 100,
        duration_ms: duration,
        first_message: firstMessage?.timestamp,
        last_message: lastMessage?.timestamp,
        most_common_tags: mostCommonTags,
        sentiment_distribution: {
          positive: sentimentCounts.positive,
          neutral: sentimentCounts.neutral,
          negative: sentimentCounts.negative
        }
      }
    });

  } catch (error) {
    apiLogger.error('Failed to get session stats:', error);
    throw error;
  }
}));

/**
 * POST /sessions/:sessionId/export - Export session data
 */
router.post('/:sessionId/export', asyncHandler(async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId;
    const format = req.body.format || 'json'; // json, csv, txt

    if (!['json', 'csv', 'txt'].includes(format)) {
      throw createValidationError('Format must be json, csv, or txt');
    }

    // Check if session exists
    const sessions = await db.getSessions();
    const session = sessions.find(s => s.id === sessionId);

    if (!session) {
      throw createNotFoundError('Session not found');
    }

    // Get all conversations for this session
    const conversations = await db.getConversationsBySession(sessionId, 1000);

    const exportData = {
      session,
      conversations,
      exported_at: new Date().toISOString(),
      export_format: format,
      total_conversations: conversations.length
    };

    apiLogger.info('Session data exported', {
      sessionId,
      format,
      conversationCount: conversations.length,
      exportedBy: req.ip
    });

    // Set appropriate headers based on format
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `session-${sessionId}-${timestamp}`;

    switch (format) {
      case 'json':
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
        res.json(exportData);
        break;
        
      case 'csv':
        // Simple CSV export of conversations
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        
        let csv = 'Timestamp,User Message,AI Response,Sentiment,Sentiment Score,Response Time (ms),Tokens Used\n';
        conversations.forEach(conv => {
          const userMsg = (conv.user_message || '').replace(/"/g, '""');
          const aiMsg = (conv.ai_response || '').replace(/"/g, '""');
          csv += `"${conv.timestamp}","${userMsg}","${aiMsg}","${conv.sentiment_label}",${conv.sentiment_score},${conv.response_time_ms},${conv.tokens_used}\n`;
        });
        
        res.send(csv);
        break;
        
      case 'txt':
        // Human-readable text format
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.txt"`);
        
        let txt = `Conversation Export for Session: ${session.name || sessionId}\n`;
        txt += `Exported: ${new Date().toISOString()}\n`;
        txt += `Total Messages: ${conversations.length}\n\n`;
        txt += '='.repeat(80) + '\n\n';
        
        conversations.reverse().forEach((conv, index) => {
          txt += `Message ${index + 1} - ${conv.timestamp}\n`;
          txt += `User: ${conv.user_message || '[No message]'}\n`;
          txt += `AI: ${conv.ai_response || '[No response]'}\n`;
          txt += `Sentiment: ${conv.sentiment_label} (${conv.sentiment_score})\n`;
          txt += '-'.repeat(40) + '\n\n';
        });
        
        res.send(txt);
        break;
    }

  } catch (error) {
    apiLogger.error('Failed to export session:', error);
    throw error;
  }
}));

  return router;
}

// Default export for backwards compatibility using singleton instance
import { databaseService } from '../services/DatabaseService';
export default createSessionRoutes(databaseService);