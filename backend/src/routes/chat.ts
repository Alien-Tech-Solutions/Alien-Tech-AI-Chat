import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import AIService from '../services/AIService';
import { ConversationManager } from '../services/ConversationManager';
import { ResourceOptimizer } from '../services/ResourceOptimizer';
import { sentimentMiddleware, createSentimentMiddleware } from '../middleware/sentiment';
import { asyncHandler, createValidationError, createNotFoundError } from '../middleware/errorHandler';
import { endpointRateLimiter } from '../middleware/rateLimiter';
import { ChatRequest, ChatResponse, Conversation, StreamChunk } from '../types';
import { aiLogger, apiLogger } from '../utils/logger';
import { config } from '../config/settings';
import { v4 as uuidv4 } from 'uuid';

// Export a function that creates the router with dependencies
export default function createChatRoutes(db: DatabaseService, aiService: AIService): Router {
  const router = Router();

  // Initialize ConversationManager for full context tracking
  const conversationManager = new ConversationManager(db);
  const resourceOptimizer = ResourceOptimizer.getInstance();

  // Apply rate limiting to chat endpoints
  router.use(endpointRateLimiter('chat'));

  // Create sentiment middleware with database dependency
  const sentimentMiddlewareWithDB = createSentimentMiddleware(db);

  /**
   * Validate chat request
   */
  function validateChatRequest(body: any): ChatRequest {
    if (!body.message || typeof body.message !== 'string') {
      throw createValidationError('Message is required and must be a string');
    }

    if (body.message.trim().length === 0) {
      throw createValidationError('Message cannot be empty');
    }

  if (body.message.length > 10000) {
    throw createValidationError('Message too long (max 10,000 characters)');
  }

  if (body.session_id && typeof body.session_id !== 'string') {
    throw createValidationError('Session ID must be a string');
  }

  return {
    message: body.message.trim(),
    session_id: body.session_id || 'default',
    context: body.context || {},
    stream: body.stream === true,
    useUncensored: body.useUncensored === true
  };
}

/**
 * Get conversation context for AI
 */
async function getConversationContext(sessionId: string, limit: number = 10): Promise<Conversation[]> {
  try {
    return await db.getConversationsBySession(sessionId, limit);
  } catch (error) {
    aiLogger.error('Failed to get conversation context:', error);
    return [];
  }
}

/**
 * Generate AI response using real AI integration
 */
async function generateAIResponse(
  message: string, 
  sessionId: string,
  context: Conversation[], 
  personalityState: any,
  streamCallback?: (chunk: StreamChunk) => void,
  useUncensored: boolean = true
): Promise<{ content: string; model: string; tokens: number; responseTime: number; provider: string }> {
  const startTime = Date.now();
  
  try {
    if (streamCallback) {
      // Use streaming AI generation
      const result = await aiService.generateStreamingResponse(
        message,
        sessionId,
        streamCallback,
        {
          useUncensored,
          temperature: 0.7,
          maxTokens: 500 // Increased from 1000 to 2048 for better responses with lackadaisical-assistant model
        }
      );

      return {
        content: result.response.content,
        model: result.response.model,
        tokens: result.response.tokens_used || 0,
        responseTime: result.response.response_time_ms || 0,
        provider: result.provider as string
      };
    } else {
      // Use regular AI generation
      const result = await aiService.generateResponse(
        message,
        sessionId,
        {
          useUncensored,
          temperature: 0.7,
          maxTokens: 500 // Increased from 1000 to 2048 for better responses with lackadaisical-assistant model
        }
      );

      return {
        content: result.response.content,
        model: result.response.model,
        tokens: result.response.tokens_used || 0,
        responseTime: result.response.response_time_ms || 0,
        provider: String(result.provider)
      };
    }

  } catch (error) {
    if (streamCallback) {
      streamCallback({ 
        type: 'error', 
        error: error instanceof Error ? error.message : 'AI generation failed'
      });
    }
    
    aiLogger.error('AI response generation failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      sessionId,
      messageLength: message.length,
      responseTime: Date.now() - startTime
    });
    
    throw error;
  }
}

/**
 * Save conversation to database with full context tracking
 */
async function saveConversation(
  sessionId: string,
  userMessage: string | null,
  aiResponse: string | null,
  sentimentData: any,
  contextTags: string[],
  tokensUsed: number,
  responseTime: number,
  model: string,
  provider: string = 'ollama'
): Promise<number> {
  // Record turn in ConversationManager for full context tracking
  if (userMessage && aiResponse) {
    await conversationManager.recordTurn(sessionId, userMessage, aiResponse, {
      sentimentScore: sentimentData?.score || 0,
      sentimentLabel: sentimentData?.label || 'neutral',
      tokensUsed,
      responseTimeMs: responseTime,
      modelUsed: model || 'unknown',
      provider,
      contextTags
    });
  }

  // Also save to database directly for immediate persistence
  return await db.insertConversation({
    session_id: sessionId,
    user_message: userMessage,
    ai_response: aiResponse,
    sentiment_score: sentimentData?.score || 0,
    sentiment_label: sentimentData?.label || 'neutral',
    context_tags: contextTags,
    message_type: 'chat',
    tokens_used: tokensUsed,
    response_time_ms: responseTime,
    model_used: model || 'unknown',
    timestamp: new Date().toISOString()
  });
}

/**
 * POST /chat - Send a chat message
 */
router.post('/', sentimentMiddlewareWithDB, asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Validate request
    const chatRequest = validateChatRequest(req.body);
    
    // Get sentiment analysis from middleware
    const sentimentAnalysis = (req as any).sentimentAnalysis;
    const updatedMood = (req as any).updatedMood;
    const contextTags = (req as any).contextTags || [];

    // Get conversation context
    const conversationContext = await getConversationContext(chatRequest.session_id!);
    
    // Get current personality state
    const personalityState = await db.getPersonalityState();

    aiLogger.info('Processing chat request', {
      sessionId: chatRequest.session_id,
      messageLength: chatRequest.message.length,
      sentiment: sentimentAnalysis?.label,
      contextCount: conversationContext.length,
      stream: chatRequest.stream
    });

    // Handle streaming response
    if (chatRequest.stream && config.ai.streamMode === 'sse') {
      // Set up Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      let aiResponse = '';
      let responseMetadata: any = {};

      try {
        // Generate AI response with streaming
        const result = await generateAIResponse(
          chatRequest.message,
          chatRequest.session_id!,
          conversationContext,
          personalityState,
          (chunk: StreamChunk) => {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            if (chunk.type === 'content' && chunk.content) {
              aiResponse += chunk.content;
            }
          },
          chatRequest.useUncensored
        );

        responseMetadata = result;

        // Save conversation to database with full context tracking
        const conversationId = await saveConversation(
          chatRequest.session_id || 'default',
          chatRequest.message,
          aiResponse,
          sentimentAnalysis,
          contextTags,
          result.tokens,
          result.responseTime,
          result.model,
          result.provider
        );

        // Send end chunk to signal completion
        const endChunk: StreamChunk = {
          type: 'end'
        };
        res.write(`data: ${JSON.stringify(endChunk)}\n\n`);

        // Send final metadata
        const finalData = {
          type: 'metadata',
          conversationId,
          tokens: result.tokens,
          responseTime: result.responseTime,
          model: result.model,
          sentiment: sentimentAnalysis,
          mood: updatedMood
        };
        
        res.write(`data: ${JSON.stringify(finalData)}\n\n`);
        res.end();

        aiLogger.info('Streaming chat response completed', {
          sessionId: chatRequest.session_id,
          conversationId,
          responseLength: aiResponse.length,
          tokens: result.tokens,
          responseTime: result.responseTime
        });

      } catch (error) {
        const errorChunk: StreamChunk = {
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
        res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
        res.end();
        throw error;
      }

    } else {
      // Non-streaming response
      const result = await generateAIResponse(
        chatRequest.message,
        chatRequest.session_id!,
        conversationContext,
        personalityState,
        undefined,
        chatRequest.useUncensored
      );

      // Save conversation to database with full context tracking
      const conversationId = await saveConversation(
        chatRequest.session_id!,
        chatRequest.message,
        result.content,
        sentimentAnalysis,
        contextTags,
        result.tokens,
        result.responseTime,
        result.model,
        result.provider
      );

      const totalTime = Date.now() - startTime;

      const response: ChatResponse = {
        response: result.content,
        session_id: chatRequest.session_id!,
        conversation_id: conversationId,
        model_used: result.model,
        tokens_used: result.tokens,
        response_time_ms: totalTime,
        sentiment: sentimentAnalysis,
        mood_update: updatedMood
      };

      aiLogger.info('Chat response completed', {
        sessionId: chatRequest.session_id,
        conversationId,
        responseLength: result.content.length,
        tokens: result.tokens,
        totalTime
      });

      res.json(response);
    }

  } catch (error) {
    aiLogger.error('Chat request failed:', error);
    throw error;
  }
}));

/**
 * GET /chat/history/:sessionId - Get conversation history
 */
router.get('/history/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  if (limit > 200) {
    throw createValidationError('Limit cannot exceed 200');
  }

  const conversations = await db.getConversationsBySession(sessionId, limit);

  res.json({
    session_id: sessionId,
    conversations: conversations.slice(offset),
    total: conversations.length,
    limit,
    offset
  });
}));

/**
 * GET /chat/search - Search conversations
 */
router.get('/search', asyncHandler(async (req: Request, res: Response) => {
  const query = req.query.q as string;
  const limit = parseInt(req.query.limit as string) || 20;

  if (!query || query.trim().length === 0) {
    throw createValidationError('Search query is required');
  }

  if (query.length < 3) {
    throw createValidationError('Search query must be at least 3 characters');
  }

  const results = await db.searchConversations(query.trim(), limit);

  res.json({
    query: query.trim(),
    results,
    total: results.length,
    limit
  });
}));

/**
 * DELETE /chat/history/:sessionId - Clear conversation history
 */
router.delete('/history/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId;

  // This would require implementing a delete method in DatabaseService
  // For now, we'll return a placeholder response
  
  apiLogger.info('Conversation history deletion requested', {
    sessionId,
    requestedBy: req.ip
  });

  res.json({
    message: 'Conversation history cleared',
    session_id: sessionId,
    timestamp: new Date().toISOString()
  });
}));

/**
 * POST /chat/regenerate - Regenerate last AI response
 */
router.post('/regenerate', sentimentMiddlewareWithDB, asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.body.session_id || 'default';
  const conversationId = req.body.conversation_id;

  if (!conversationId) {
    throw createValidationError('Conversation ID is required for regeneration');
  }

  // Get the conversation to regenerate
  const conversations = await db.getConversationsBySession(sessionId, 10);
  const targetConversation = conversations.find(c => c.id === conversationId);

  if (!targetConversation || !targetConversation.user_message) {
    throw createNotFoundError('Conversation not found');
  }

  // Get conversation context (excluding the target conversation)
  const contextConversations = conversations.filter(c => c.id !== conversationId);
  
  // Get current personality state
  const personalityState = await db.getPersonalityState();

  // Ensure user_message is not null (we already checked above)
  const userMessage = targetConversation.user_message!;

  // Regenerate AI response
  const result = await generateAIResponse(
    userMessage,
    sessionId,
    contextConversations,
    personalityState,
    undefined,
    false // Default to censored for regeneration unless specified
  );

  // Update the conversation in the database (would need to implement update method)
  // For now, we'll create a new conversation entry
  const newConversationId = await saveConversation(
    sessionId,
    targetConversation.user_message,
    result.content,
    { score: targetConversation.sentiment_score, label: targetConversation.sentiment_label },
    targetConversation.context_tags,
    result.tokens,
    result.responseTime,
    result.model
  );

  aiLogger.info('Response regenerated', {
    originalConversationId: conversationId,
    newConversationId,
    sessionId
  });

  res.json({
    response: result.content,
    conversation_id: newConversationId,
    original_conversation_id: conversationId,
    session_id: sessionId,
    model_used: result.model,
    tokens_used: result.tokens,
    response_time_ms: result.responseTime
  });
}));

/**
 * GET /chat/stream - Server-Sent Events endpoint for streaming chat
 */
router.get('/stream', asyncHandler(async (req: Request, res: Response) => {
  const message = req.query.message as string;
  const sessionId = req.query.session_id as string || 'default';
  const useUncensored = req.query.useUncensored === 'true';

  if (!message || message.trim().length === 0) {
    throw createValidationError('Message is required');
  }

  if (message.length > 10000) {
    throw createValidationError('Message too long (max 10,000 characters)');
  }

  // Set up Server-Sent Events - FIXED headers for better compatibility
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': config.server.corsOrigin[0] || '*',
    'Access-Control-Allow-Headers': 'Cache-Control, Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  });

  let conversationId: number;
  let aiResponse = '';

  try {
    aiLogger.info('Starting streaming chat response', {
      sessionId,
      messageLength: message.length
    });

    // Get conversation context
    const conversationContext = await getConversationContext(sessionId);
    const personalityState = await db.getPersonalityState();

    // Send start event
    res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`);

    // Generate streaming response
    const result = await generateAIResponse(
      message.trim(),
      sessionId,
      conversationContext,
      personalityState,
      (chunk: StreamChunk) => {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        if (chunk.type === 'content' && chunk.content) {
          aiResponse += chunk.content;
        }
      },
      useUncensored
    );

    // Save conversation to database
    conversationId = await saveConversation(
      sessionId,
      message.trim(),
      aiResponse,
      { score: 0, label: 'neutral' }, // TODO: Get from sentiment analysis
      [],
      result.tokens,
      result.responseTime,
      result.model
    );

    // Send final metadata
    const metadata = {
      type: 'metadata',
      conversationId,
      tokens: result.tokens,
      responseTime: result.responseTime,
      model: result.model
    };
    res.write(`data: ${JSON.stringify(metadata)}\n\n`);

    // Send end event
    res.write(`data: ${JSON.stringify({ type: 'end' })}\n\n`);
    res.end();

    aiLogger.info('Streaming response completed', {
      sessionId,
      conversationId,
      responseLength: aiResponse.length,
      tokens: result.tokens
    });

  } catch (error) {
    aiLogger.error('Streaming response failed:', error);
    const errorChunk = {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
    res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
    res.end();
  }
}));

/**
 * GET /chat/stats - Get chat statistics
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.query.session_id as string;
  
  // Get database stats
  const dbStats = await db.getDatabaseStats();
  
  let sessionStats: {
    session_id: string;
    message_count: number;
    total_tokens: number;
    avg_response_time_ms: number;
    first_message: string | undefined;
    last_message: string | undefined;
  } | null = null;
  if (sessionId) {
    const conversations = await db.getConversationsBySession(sessionId);
    const totalTokens = conversations.reduce((sum, conv) => sum + (conv.tokens_used || 0), 0);
    const avgResponseTime = conversations.length > 0 ? 
      conversations.reduce((sum, conv) => sum + (conv.response_time_ms || 0), 0) / conversations.length : 0;
    
    sessionStats = {
      session_id: sessionId,
      message_count: conversations.length,
      total_tokens: totalTokens,
      avg_response_time_ms: Math.round(avgResponseTime),
      first_message: conversations[conversations.length - 1]?.timestamp,
      last_message: conversations[0]?.timestamp
    };
  }

  res.json({
    global: {
    total_conversations: dbStats.conversations,
    total_sessions: dbStats.sessions
  },
  session: sessionStats,
  timestamp: new Date().toISOString()
});
}));

/**
 * GET /chat/context/:sessionId - Get full context window for a session
 */
router.get('/context/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId;
  const maxTokens = parseInt(req.query.maxTokens as string) || undefined;

  const contextWindow = await conversationManager.getConversationContext(sessionId, maxTokens);

  res.json({
    success: true,
    data: {
      sessionId,
      context: contextWindow,
      timestamp: new Date().toISOString()
    }
  });
}));

/**
 * GET /chat/analytics/:sessionId - Get detailed session analytics
 */
router.get('/analytics/:sessionId', asyncHandler(async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId;

  const analytics = await conversationManager.getSessionAnalytics(sessionId);

  res.json({
    success: true,
    data: analytics,
    timestamp: new Date().toISOString()
  });
}));

/**
 * GET /chat/analytics - Get global analytics across all sessions
 */
router.get('/global-analytics', asyncHandler(async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;

  const analytics = await conversationManager.getGlobalAnalytics(days);

  res.json({
    success: true,
    data: analytics,
    timestamp: new Date().toISOString()
  });
}));

/**
 * GET /chat/sessions/active - Get all active sessions
 */
router.get('/sessions/active', asyncHandler(async (req: Request, res: Response) => {
  const sessions = conversationManager.getActiveSessions();

  res.json({
    success: true,
    data: {
      sessions,
      count: sessions.length
    },
    timestamp: new Date().toISOString()
  });
}));

/**
 * GET /chat/resources - Get resource optimization status
 */
router.get('/resources', asyncHandler(async (req: Request, res: Response) => {
  const resourceStatus = conversationManager.getResourceStatus();
  const recommendations = resourceOptimizer.getOptimizationRecommendations();

  res.json({
    success: true,
    data: {
      ...resourceStatus,
      recommendations
    },
    timestamp: new Date().toISOString()
  });
}));

/**
 * POST /chat/flush - Force flush all pending data
 */
router.post('/flush', asyncHandler(async (req: Request, res: Response) => {
  await conversationManager.forceFlush();

  res.json({
    success: true,
    message: 'All pending data has been flushed',
    timestamp: new Date().toISOString()
  });
}));

return router;
}
