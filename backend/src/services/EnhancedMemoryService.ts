import { DatabaseService } from './DatabaseService';
import { ResourceOptimizer, WriteOperation } from './ResourceOptimizer';
import { logger } from '../utils/logger';
import { Conversation } from '../types';
import * as path from 'path';
import * as fs from 'fs/promises';

// Common English stop words for text processing
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under',
  'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how',
  'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
  'and', 'but', 'if', 'or', 'because', 'until', 'while', 'although', 'though', 'since', 'unless',
  'that', 'this', 'these', 'those', 'what', 'which', 'who', 'whom', 'whose',
  'i', 'me', 'my', 'mine', 'myself', 'we', 'us', 'our', 'ours', 'ourselves',
  'you', 'your', 'yours', 'yourself', 'yourselves',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
  'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves'
]);

export interface ConversationEntry {
  id?: number;
  sessionId: string;
  userMessage: string;
  aiResponse: string;
  timestamp: Date;
  sentimentScore: number;
  sentimentLabel: string;
  contextTags: string[];
  tokensUsed: number;
  responseTimeMs: number;
  modelUsed: string;
  provider: string;
  context: ConversationContext;
}

export interface ConversationContext {
  previousTopics: string[];
  emotionalState: string;
  conversationPhase: 'greeting' | 'discussion' | 'deepening' | 'closing';
  userIntents: string[];
  aiObjectives: string[];
  relevantMemories: string[];
  importanceScore: number;
}

export interface ContextWindow {
  recentMessages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    sentiment?: number;
  }>;
  summary: string;
  topics: string[];
  emotionalTrend: string;
  conversationDepth: number;
  totalTokens: number;
}

export interface MemorySearchResult {
  entries: ConversationEntry[];
  totalFound: number;
  relevanceScores: number[];
}

export class EnhancedMemoryService {
  private db: DatabaseService;
  private resourceOptimizer: ResourceOptimizer;
  private memoryPath: string;
  
  // In-memory caches for fast access
  private activeContexts: Map<string, ContextWindow> = new Map();
  private contextCache: Map<string, ConversationEntry[]> = new Map();
  private cacheMaxAge = 5 * 60 * 1000; // 5 minutes
  private cacheTimestamps: Map<string, number> = new Map();
  
  // Configuration
  private config = {
    maxContextMessages: 50,
    maxContextTokens: 8000,
    contextSummaryThreshold: 20,
    batchWriteEnabled: true,
    cacheEnabled: true,
    autoSummarize: true
  };

  constructor(db: DatabaseService, memoryPath: string = './memory') {
    this.db = db;
    this.memoryPath = memoryPath;
    this.resourceOptimizer = ResourceOptimizer.getInstance();
    
    // Set up batch write callback
    this.resourceOptimizer.setBatchCallback(this.processBatchWrites.bind(this));
    
    this.initializeMemoryStorage();
    logger.info('EnhancedMemoryService initialized');
  }

  /**
   * Initialize memory storage directory
   */
  private async initializeMemoryStorage(): Promise<void> {
    try {
      await fs.mkdir(this.memoryPath, { recursive: true });
      logger.info('Memory storage initialized at:', this.memoryPath);
    } catch (error) {
      logger.error('Failed to initialize memory storage:', error);
    }
  }

  /**
   * Save a complete conversation entry with full context
   */
  async saveConversation(entry: Omit<ConversationEntry, 'id'>): Promise<number> {
    const writeOp = {
      type: 'conversation' as const,
      data: entry,
      priority: 'high' as const
    };

    // Queue for batched write if enabled
    if (this.config.batchWriteEnabled) {
      const metrics = this.resourceOptimizer.getResourceMetrics();
      
      if (metrics.optimization.shouldBatchWrites) {
        this.resourceOptimizer.queueWrite(writeOp);
        
        // Update cache immediately for fast reads
        this.updateContextCache(entry.sessionId, entry as ConversationEntry);
        
        return -1; // Indicate queued write
      }
    }

    // Direct write if batching not needed
    return await this.writeConversationToDB(entry);
  }

  /**
   * Write conversation directly to database
   */
  private async writeConversationToDB(entry: Omit<ConversationEntry, 'id'>): Promise<number> {
    try {
      const result = await this.db.insertConversation({
        session_id: entry.sessionId,
        user_message: entry.userMessage,
        ai_response: entry.aiResponse,
        timestamp: entry.timestamp.toISOString(),
        sentiment_score: entry.sentimentScore,
        sentiment_label: entry.sentimentLabel,
        context_tags: entry.contextTags,
        message_type: 'chat',
        tokens_used: entry.tokensUsed,
        response_time_ms: entry.responseTimeMs,
        model_used: entry.modelUsed
      });

      // Save extended context to memory_contexts table
      await this.saveExtendedContext(entry.sessionId, entry.context, result);

      // Update cache
      this.updateContextCache(entry.sessionId, { ...entry, id: result } as ConversationEntry);

      logger.debug(`Saved conversation ${result} for session ${entry.sessionId}`);
      return result;
    } catch (error) {
      logger.error('Failed to save conversation:', error);
      throw error;
    }
  }

  /**
   * Save extended context data
   */
  private async saveExtendedContext(
    sessionId: string, 
    context: ConversationContext, 
    conversationId: number
  ): Promise<void> {
    try {
      await this.db.executeStatement(`
        INSERT INTO memory_contexts (
          session_id, context_type, content, importance_score, created_at, accessed_at
        ) VALUES (?, 'active', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        sessionId,
        JSON.stringify({
          conversationId,
          ...context
        }),
        context.importanceScore
      ]);
    } catch (error) {
      logger.error('Failed to save extended context:', error);
      // Non-critical error, don't throw
    }
  }

  /**
   * Process batch writes from ResourceOptimizer
   */
  private async processBatchWrites(operations: WriteOperation[]): Promise<void> {
    const conversationOps = operations.filter(op => op.type === 'conversation');
    const contextOps = operations.filter(op => op.type === 'context');
    const memoryOps = operations.filter(op => op.type === 'memory');

    // Process conversations in parallel groups
    const batchSize = 10;
    for (let i = 0; i < conversationOps.length; i += batchSize) {
      const batch = conversationOps.slice(i, i + batchSize);
      await Promise.all(batch.map(op => this.writeConversationToDB(op.data)));
    }

    // Process context updates
    for (const op of contextOps) {
      await this.saveExtendedContext(op.data.sessionId, op.data.context, op.data.conversationId);
    }

    // Process memory operations
    for (const op of memoryOps) {
      await this.archiveToLongTermMemory(op.data.sessionId, op.data.memories);
    }

    logger.debug(`Processed batch: ${conversationOps.length} conversations, ${contextOps.length} contexts, ${memoryOps.length} memories`);
  }

  /**
   * Get context window for AI prompts
   */
  async getContextWindow(sessionId: string, maxTokens?: number): Promise<ContextWindow> {
    // Check cache first
    if (this.config.cacheEnabled && this.activeContexts.has(sessionId)) {
      const cached = this.activeContexts.get(sessionId)!;
      const cacheTime = this.cacheTimestamps.get(`context_${sessionId}`);
      
      if (cacheTime && Date.now() - cacheTime < this.cacheMaxAge) {
        return cached;
      }
    }

    // Build context from database
    const tokenLimit = maxTokens || this.config.maxContextTokens;
    const context = await this.buildContextWindow(sessionId, tokenLimit);
    
    // Cache the result
    this.activeContexts.set(sessionId, context);
    this.cacheTimestamps.set(`context_${sessionId}`, Date.now());
    
    return context;
  }

  /**
   * Build context window from database
   */
  private async buildContextWindow(sessionId: string, maxTokens: number): Promise<ContextWindow> {
    try {
      const result = await this.db.executeQuery(`
        SELECT 
          user_message, ai_response, timestamp, sentiment_score, 
          sentiment_label, context_tags, tokens_used
        FROM conversations 
        WHERE session_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `, [sessionId, this.config.maxContextMessages]);

      const rows = result.data;
      const messages: ContextWindow['recentMessages'] = [];
      const allTopics = new Set<string>();
      const sentiments: number[] = [];
      let totalTokens = 0;

      // Process in reverse to maintain chronological order
      for (let i = rows.length - 1; i >= 0 && totalTokens < maxTokens; i--) {
        const row = rows[i];
        const messageTokens = row.tokens_used || Math.ceil(((row.user_message?.length || 0) + (row.ai_response?.length || 0)) / 4);
        
        if (totalTokens + messageTokens > maxTokens) break;

        if (row.user_message) {
          messages.push({
            role: 'user',
            content: row.user_message,
            timestamp: new Date(row.timestamp),
            sentiment: row.sentiment_score
          });
          sentiments.push(row.sentiment_score || 0);
        }

        if (row.ai_response) {
          messages.push({
            role: 'assistant',
            content: row.ai_response,
            timestamp: new Date(row.timestamp)
          });
        }

        // Extract topics from context tags
        const tags = JSON.parse(row.context_tags || '[]');
        tags.forEach((tag: string) => allTopics.add(tag));

        totalTokens += messageTokens;
      }

      // Calculate emotional trend
      const avgSentiment = sentiments.length > 0
        ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length
        : 0;
      const recentSentiment = sentiments.slice(0, 5).reduce((a, b) => a + b, 0) / Math.max(1, sentiments.slice(0, 5).length);
      const emotionalTrend = recentSentiment > avgSentiment + 0.1 ? 'improving' :
                            recentSentiment < avgSentiment - 0.1 ? 'declining' : 'stable';

      // Generate summary if needed
      let summary = '';
      if (messages.length > this.config.contextSummaryThreshold && this.config.autoSummarize) {
        summary = await this.generateContextSummary(messages.slice(0, -10));
      }

      return {
        recentMessages: messages,
        summary,
        topics: Array.from(allTopics),
        emotionalTrend,
        conversationDepth: messages.length,
        totalTokens
      };
    } catch (error) {
      logger.error('Failed to build context window:', error);
      return {
        recentMessages: [],
        summary: '',
        topics: [],
        emotionalTrend: 'stable',
        conversationDepth: 0,
        totalTokens: 0
      };
    }
  }

  /**
   * Generate context summary (simple extraction for now)
   */
  private async generateContextSummary(messages: ContextWindow['recentMessages']): Promise<string> {
    // Simple keyword extraction - could be enhanced with AI summarization
    const keywords = new Map<string, number>();

    for (const msg of messages) {
      const words = msg.content.toLowerCase().split(/\s+/);
      for (const word of words) {
        const cleanWord = word.replace(/[^a-z]/g, '');
        if (cleanWord.length > 3 && !STOP_WORDS.has(cleanWord)) {
          keywords.set(cleanWord, (keywords.get(cleanWord) || 0) + 1);
        }
      }
    }

    // Get top keywords
    const topKeywords = Array.from(keywords.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);

    return `Discussion topics: ${topKeywords.join(', ')}. Total exchanges: ${messages.length}.`;
  }

  /**
   * Extract context from user message and AI response
   */
  extractContext(
    userMessage: string,
    aiResponse: string,
    previousContext?: ConversationContext
  ): ConversationContext {
    // Extract topics using simple keyword extraction
    const combinedText = `${userMessage} ${aiResponse}`.toLowerCase();
    const words = combinedText.split(/\s+/);
    const topics = words
      .filter(word => word.length > 4)
      .slice(0, 10);

    // Detect emotional state from message
    const positiveWords = ['happy', 'great', 'good', 'love', 'thanks', 'appreciate', 'wonderful', 'amazing', 'excellent'];
    const negativeWords = ['sad', 'bad', 'hate', 'angry', 'frustrated', 'disappointed', 'terrible', 'awful'];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    for (const word of words) {
      if (positiveWords.some(pw => word.includes(pw))) positiveCount++;
      if (negativeWords.some(nw => word.includes(nw))) negativeCount++;
    }
    
    const emotionalState = positiveCount > negativeCount ? 'positive' :
                          negativeCount > positiveCount ? 'negative' : 'neutral';

    // Detect conversation phase
    const isGreeting = /^(hi|hello|hey|good morning|good evening)/i.test(userMessage);
    const isClosing = /^(bye|goodbye|thanks|thank you|see you)/i.test(userMessage);
    
    let conversationPhase: ConversationContext['conversationPhase'] = 'discussion';
    if (isGreeting && !previousContext) {
      conversationPhase = 'greeting';
    } else if (isClosing) {
      conversationPhase = 'closing';
    } else if (previousContext && previousContext.conversationPhase !== 'greeting') {
      conversationPhase = 'deepening';
    }

    // Detect user intents
    const intents: string[] = [];
    if (/\?/.test(userMessage)) intents.push('asking_question');
    if (/help|assist|support/i.test(userMessage)) intents.push('seeking_help');
    if (/tell me|explain|what is/i.test(userMessage)) intents.push('seeking_information');
    if (/feel|feeling|emotion/i.test(userMessage)) intents.push('expressing_emotion');
    if (/think|opinion|believe/i.test(userMessage)) intents.push('sharing_opinion');

    // Calculate importance score
    const importanceScore = Math.min(1, 
      (intents.length * 0.2) + 
      (topics.length * 0.05) +
      (userMessage.length > 100 ? 0.2 : 0) +
      (aiResponse.length > 200 ? 0.2 : 0)
    );

    return {
      previousTopics: previousContext?.previousTopics.slice(-5) || [],
      emotionalState,
      conversationPhase,
      userIntents: intents,
      aiObjectives: ['provide_helpful_response', 'maintain_engagement'],
      relevantMemories: [],
      importanceScore
    };
  }

  /**
   * Search conversations by content or context
   */
  async searchConversations(
    sessionId: string,
    query: string,
    options: {
      limit?: number;
      dateFrom?: Date;
      dateTo?: Date;
      minImportance?: number;
    } = {}
  ): Promise<MemorySearchResult> {
    try {
      let sql = `
        SELECT * FROM conversations 
        WHERE session_id = ?
        AND (user_message LIKE ? OR ai_response LIKE ? OR context_tags LIKE ?)
      `;
      const params: any[] = [sessionId, `%${query}%`, `%${query}%`, `%${query}%`];

      if (options.dateFrom) {
        sql += ` AND timestamp >= ?`;
        params.push(options.dateFrom.toISOString());
      }

      if (options.dateTo) {
        sql += ` AND timestamp <= ?`;
        params.push(options.dateTo.toISOString());
      }

      sql += ` ORDER BY timestamp DESC LIMIT ?`;
      params.push(options.limit || 20);

      const result = await this.db.executeQuery(sql, params);
      
      const entries: ConversationEntry[] = result.data.map((row: any) => ({
        id: row.id,
        sessionId: row.session_id,
        userMessage: row.user_message,
        aiResponse: row.ai_response,
        timestamp: new Date(row.timestamp),
        sentimentScore: row.sentiment_score,
        sentimentLabel: row.sentiment_label,
        contextTags: JSON.parse(row.context_tags || '[]'),
        tokensUsed: row.tokens_used,
        responseTimeMs: row.response_time_ms,
        modelUsed: row.model_used,
        provider: row.provider || 'unknown',
        context: {
          previousTopics: [],
          emotionalState: row.sentiment_label,
          conversationPhase: 'discussion',
          userIntents: [],
          aiObjectives: [],
          relevantMemories: [],
          importanceScore: 0.5
        }
      }));

      // Calculate relevance scores based on query match
      const relevanceScores = entries.map(entry => {
        let score = 0;
        const searchText = `${entry.userMessage} ${entry.aiResponse}`.toLowerCase();
        const queryWords = query.toLowerCase().split(/\s+/);
        
        for (const word of queryWords) {
          if (searchText.includes(word)) {
            score += 0.2;
          }
        }
        
        return Math.min(1, score);
      });

      return {
        entries,
        totalFound: entries.length,
        relevanceScores
      };
    } catch (error) {
      logger.error('Failed to search conversations:', error);
      return { entries: [], totalFound: 0, relevanceScores: [] };
    }
  }

  /**
   * Archive old messages to long-term memory
   */
  private async archiveToLongTermMemory(sessionId: string, memories: any[]): Promise<void> {
    try {
      for (const memory of memories) {
        await this.db.executeStatement(`
          INSERT INTO memory_contexts (
            session_id, context_type, content, importance_score, created_at, accessed_at
          ) VALUES (?, 'long_term', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [sessionId, JSON.stringify(memory), memory.importanceScore || 0.5]);
      }
      logger.debug(`Archived ${memories.length} memories for session ${sessionId}`);
    } catch (error) {
      logger.error('Failed to archive memories:', error);
    }
  }

  /**
   * Update context cache
   */
  private updateContextCache(sessionId: string, entry: ConversationEntry): void {
    if (!this.config.cacheEnabled) return;

    let cache = this.contextCache.get(sessionId) || [];
    cache.push(entry);

    // Keep cache size manageable
    if (cache.length > this.config.maxContextMessages) {
      cache = cache.slice(-this.config.maxContextMessages);
    }

    this.contextCache.set(sessionId, cache);
    this.cacheTimestamps.set(`cache_${sessionId}`, Date.now());

    // Invalidate context window cache to force rebuild
    this.activeContexts.delete(sessionId);
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(sessionId: string): Promise<{
    activeMessages: number;
    archivedMessages: number;
    totalTokens: number;
    cacheStatus: string;
    resourceMetrics: any;
  }> {
    try {
      const contextWindow = await this.getContextWindow(sessionId);
      
      const archivedResult = await this.db.executeQuery(
        `SELECT COUNT(*) as count FROM memory_contexts WHERE session_id = ?`,
        [sessionId]
      );

      const cacheHit = this.activeContexts.has(sessionId);

      return {
        activeMessages: contextWindow.recentMessages.length,
        archivedMessages: archivedResult.data[0]?.count || 0,
        totalTokens: contextWindow.totalTokens,
        cacheStatus: cacheHit ? 'hit' : 'miss',
        resourceMetrics: this.resourceOptimizer.getResourceMetrics()
      };
    } catch (error) {
      logger.error('Failed to get memory stats:', error);
      return {
        activeMessages: 0,
        archivedMessages: 0,
        totalTokens: 0,
        cacheStatus: 'error',
        resourceMetrics: null
      };
    }
  }

  /**
   * Clear session memory
   */
  async clearSessionMemory(sessionId: string): Promise<void> {
    // Clear caches
    this.activeContexts.delete(sessionId);
    this.contextCache.delete(sessionId);
    this.cacheTimestamps.delete(`context_${sessionId}`);
    this.cacheTimestamps.delete(`cache_${sessionId}`);

    // Clear from database
    await this.db.executeStatement(
      'DELETE FROM memory_contexts WHERE session_id = ?',
      [sessionId]
    );

    logger.info(`Cleared memory for session ${sessionId}`);
  }

  /**
   * Cleanup old cache entries
   */
  cleanupCache(): void {
    const now = Date.now();
    
    for (const [key, timestamp] of this.cacheTimestamps.entries()) {
      if (now - timestamp > this.cacheMaxAge) {
        if (key.startsWith('context_')) {
          this.activeContexts.delete(key.replace('context_', ''));
        } else if (key.startsWith('cache_')) {
          this.contextCache.delete(key.replace('cache_', ''));
        }
        this.cacheTimestamps.delete(key);
      }
    }

    logger.debug('Cache cleanup completed');
  }

  /**
   * Flush pending writes
   */
  async flush(): Promise<void> {
    await this.resourceOptimizer.flushQueue();
  }
}

export default EnhancedMemoryService;
