import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { aiLogger } from '../utils/logger';

// Export factory function for dependency injection
export function createCompanionRoutes(dbService: DatabaseService): Router {
  const router = Router();

/**
 * GET /api/companion/stats
 * Get companion interaction statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    aiLogger.info('[COMPANION] Fetching companion stats');

    // Get total conversations
    const totalConversationsQuery = `
      SELECT COUNT(*) as total 
      FROM conversations
    `;
    
    // Get conversations today
    const todayConversationsQuery = `
      SELECT COUNT(*) as today
      FROM conversations 
      WHERE date(timestamp) = date('now', 'localtime')
    `;
    
    // Get total messages (user + AI responses count as 2 messages per conversation)
    const totalMessagesQuery = `
      SELECT COUNT(*) * 2 as total
      FROM conversations
      WHERE user_message IS NOT NULL AND ai_response IS NOT NULL
    `;
    
    // Get messages today  
    const todayMessagesQuery = `
      SELECT COUNT(*) * 2 as today
      FROM conversations 
      WHERE date(timestamp) = date('now', 'localtime')
      AND user_message IS NOT NULL AND ai_response IS NOT NULL
    `;

    const [totalConversations, todayConversations, totalMessages, todayMessages] = await Promise.all([
      dbService.executeQuery(totalConversationsQuery),
      dbService.executeQuery(todayConversationsQuery),
      dbService.executeQuery(totalMessagesQuery),
      dbService.executeQuery(todayMessagesQuery)
    ]);

    const stats = {
      totalConversations: totalConversations.data[0]?.total || 0,
      conversationsToday: todayConversations.data[0]?.today || 0,
      totalMessages: totalMessages.data[0]?.total || 0,
      messagesToday: todayMessages.data[0]?.today || 0,
      uptime: process.uptime(),
      lastInteraction: new Date().toISOString()
    };

    aiLogger.info('[COMPANION] Stats retrieved successfully', { stats });
    res.json(stats);

  } catch (error) {
    aiLogger.error('[COMPANION] Failed to fetch stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch companion stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/companion/mood-history
 * Get recent mood/interaction history for companion dashboard
 */
router.get('/mood-history', async (req: Request, res: Response) => {
  try {
    aiLogger.info('[COMPANION] Fetching mood history');

    // Get recent conversations with sentiment analysis if available
    const moodHistoryQuery = `
      SELECT 
        id,
        session_id,
        user_message,
        ai_response,
        timestamp,
        sentiment_score,
        message_type
      FROM conversations
      WHERE timestamp >= datetime('now', '-7 days', 'localtime')
      AND user_message IS NOT NULL
      ORDER BY timestamp DESC
      LIMIT 10
    `;

    const conversations = await dbService.executeQuery(moodHistoryQuery);

    // Process mood data (simple sentiment analysis based on keywords)
    const moodHistory = conversations.data.map((conv: any) => {
      const userText = conv.user_message || '';
      let mood = 'neutral';
      
      // Use existing sentiment_score if available, otherwise analyze keywords
      if (conv.sentiment_score !== null) {
        if (conv.sentiment_score > 0.2) {
          mood = 'positive';
        } else if (conv.sentiment_score < -0.2) {
          mood = 'negative';
        }
      } else {
        // Simple keyword-based mood detection
        if (userText.match(/\b(happy|great|awesome|wonderful|excited|joy|love)\b/i)) {
          mood = 'positive';
        } else if (userText.match(/\b(sad|upset|angry|frustrated|worried|anxious|bad)\b/i)) {
          mood = 'negative';
        } else if (userText.match(/\b(help|question|how|what|learn|understand)\b/i)) {
          mood = 'curious';
        }
      }

      return {
        id: conv.id,
        date: conv.timestamp,
        mood: mood,
        messageCount: 1, // Each conversation record is one exchange
        title: `Conversation ${conv.id}`,
        timestamp: new Date(conv.timestamp).getTime(),
        sentimentScore: conv.sentiment_score
      };
    });

    aiLogger.info('[COMPANION] Mood history retrieved successfully', { 
      count: moodHistory.length 
    });
    
    res.json(moodHistory);

  } catch (error) {
    aiLogger.error('[COMPANION] Failed to fetch mood history:', error);
    res.status(500).json({ 
      error: 'Failed to fetch mood history',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/companion/status
 * Get current companion status and health
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = {
      status: 'active',
      mood: 'helpful',
      energy: 'high',
      availability: 'ready',
      lastActivity: new Date().toISOString(),
      capabilities: [
        'conversation',
        'assistance',
        'learning',
        'companionship'
      ]
    };

    res.json(status);

  } catch (error) {
    aiLogger.error('[COMPANION] Failed to fetch status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch companion status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

  return router;
}

// Default export for backwards compatibility
const defaultDbService = new DatabaseService();
defaultDbService.initialize().catch(error => {
  aiLogger.error('[COMPANION] Failed to initialize default database service:', error);
});
export default createCompanionRoutes(defaultDbService);
