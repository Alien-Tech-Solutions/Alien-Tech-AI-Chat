import { DatabaseService } from './DatabaseService';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs/promises';

export interface MemoryContext {
  id?: number;
  sessionId: string;
  contextType: 'active' | 'long_term' | 'episodic';
  content: any;
  importanceScore: number;
  createdAt: Date;
  accessedAt: Date;
}

export interface ActiveMemory {
  sessionId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    sentiment?: number;
  }>;
  context: string;
  lastUpdated: Date;
}

export class MemoryService {
  private db: DatabaseService;
  private activeMemories: Map<string, ActiveMemory> = new Map();
  private memoryPath: string;
  private maxContextLength: number = 6000; // tokens - Increased from 4000 to support larger conversations with lackadaisical-assistant
  private maxActiveMessages: number = 50;

  constructor(db: DatabaseService, memoryPath: string = './memory') {
    this.db = db;
    this.memoryPath = memoryPath;
    this.initializeMemoryStorage();
  }

  private async initializeMemoryStorage(): Promise<void> {
    try {
      await fs.mkdir(this.memoryPath, { recursive: true });
      logger.info('Memory storage initialized');
    } catch (error) {
      logger.error('Failed to initialize memory storage:', error);
    }
  }

  /**
   * Load active memory for a session from both database and JSON cache
   */
  async loadSessionMemory(sessionId: string): Promise<ActiveMemory> {
    try {
      // Check if already loaded in memory
      if (this.activeMemories.has(sessionId)) {
        return this.activeMemories.get(sessionId)!;
      }

      // Try to load from JSON file first (faster)
      const memoryFile = path.join(this.memoryPath, `${sessionId}.json`);
      let activeMemory: ActiveMemory;

      try {
        const data = await fs.readFile(memoryFile, 'utf-8');
        activeMemory = JSON.parse(data);
        activeMemory.messages = activeMemory.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        activeMemory.lastUpdated = new Date(activeMemory.lastUpdated);
      } catch {
        // Create new active memory if file doesn't exist
        activeMemory = {
          sessionId,
          messages: [],
          context: '',
          lastUpdated: new Date()
        };

        // Load recent messages from database
        const result = await this.db.executeQuery(`
          SELECT user_message, ai_response, timestamp, sentiment_score
          FROM conversations 
          WHERE session_id = ? 
          ORDER BY timestamp DESC 
          LIMIT ?
        `, [sessionId, this.maxActiveMessages]);
        
        const recentMessages = result.data;

        for (const row of recentMessages.reverse()) {
          if (row.user_message) {
            activeMemory.messages.push({
              role: 'user',
              content: row.user_message,
              timestamp: new Date(row.timestamp),
              sentiment: row.sentiment_score
            });
          }
          if (row.ai_response) {
            activeMemory.messages.push({
              role: 'assistant',
              content: row.ai_response,
              timestamp: new Date(row.timestamp)
            });
          }
        }
      }

      this.activeMemories.set(sessionId, activeMemory);
      return activeMemory;
    } catch (error) {
      logger.error(`Failed to load session memory for ${sessionId}:`, error);
      // Return empty memory as fallback
      const fallbackMemory: ActiveMemory = {
        sessionId,
        messages: [],
        context: '',
        lastUpdated: new Date()
      };
      this.activeMemories.set(sessionId, fallbackMemory);
      return fallbackMemory;
    }
  }

  /**
   * Add a new message to active memory
   */
  async addMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    sentiment?: number
  ): Promise<void> {
    try {
      const memory = await this.loadSessionMemory(sessionId);
      
      memory.messages.push({
        role,
        content,
        timestamp: new Date(),
        ...(sentiment !== undefined && { sentiment })
      });

      // Trim messages if exceeding limit
      if (memory.messages.length > this.maxActiveMessages) {
        const removedMessages = memory.messages.splice(0, memory.messages.length - this.maxActiveMessages);
        // Archive removed messages to long-term storage
        await this.archiveMessages(sessionId, removedMessages);
      }

      memory.lastUpdated = new Date();
      await this.updateContextSummary(memory);
      await this.saveActiveMemory(sessionId, memory);

      logger.debug(`Added ${role} message to session ${sessionId}`);
    } catch (error) {
      logger.error(`Failed to add message to session ${sessionId}:`, error);
    }
  }

  /**
   * Generate context window for AI prompts
   */
  async getContextWindow(sessionId: string, maxTokens?: number): Promise<string> {
    try {
      const memory = await this.loadSessionMemory(sessionId);
      const limit = maxTokens || this.maxContextLength;
      
      let context = '';
      let tokenCount = 0;

      // Add context summary first
      if (memory.context) {
        context += `Previous conversation context: ${memory.context}\n\n`;
        tokenCount += memory.context.length / 4; // rough token estimation
      }

      // Add recent messages in reverse order
      for (let i = memory.messages.length - 1; i >= 0 && tokenCount < limit; i--) {
        const message = memory.messages[i];
        if (!message) continue;
        
        const messageText = `${message.role}: ${message.content}\n`;
        const messageTokens = messageText.length / 4;

        if (tokenCount + messageTokens > limit) {
          break;
        }

        context = messageText + context;
        tokenCount += messageTokens;
      }

      return context.trim();
    } catch (error) {
      logger.error(`Failed to get context window for ${sessionId}:`, error);
      return '';
    }
  }

  /**
   * Update context summary using AI or simple extraction
   */
  private async updateContextSummary(memory: ActiveMemory): Promise<void> {
    try {
      // Simple context extraction for now - could be enhanced with AI summarization
      const recentMessages = memory.messages.slice(-10);
      const topics = new Set<string>();
      const sentiments: number[] = [];

      for (const message of recentMessages) {
        // Extract keywords (simple implementation)
        const words = message.content.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length > 4 && !['that', 'this', 'with', 'from', 'they', 'have', 'will', 'been', 'were'].includes(word)) {
            topics.add(word);
          }
        });

        if (message.sentiment !== undefined) {
          sentiments.push(message.sentiment);
        }
      }

      const avgSentiment = sentiments.length > 0 
        ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length 
        : 0;

      const topTopics = Array.from(topics).slice(0, 5);
      
      memory.context = `Recent topics: ${topTopics.join(', ')}. Conversation mood: ${this.describeSentiment(avgSentiment)}.`;
    } catch (error) {
      logger.error('Failed to update context summary:', error);
    }
  }

  private describeSentiment(score: number): string {
    if (score > 0.3) return 'positive';
    if (score < -0.3) return 'negative';
    return 'neutral';
  }

  /**
   * Save active memory to JSON file for fast access
   */
  private async saveActiveMemory(sessionId: string, memory: ActiveMemory): Promise<void> {
    try {
      const memoryFile = path.join(this.memoryPath, `${sessionId}.json`);
      await fs.writeFile(memoryFile, JSON.stringify(memory, null, 2));
    } catch (error) {
      logger.error(`Failed to save active memory for ${sessionId}:`, error);
    }
  }

  /**
   * Archive old messages to long-term database storage
   */
  private async archiveMessages(sessionId: string, messages: ActiveMemory['messages']): Promise<void> {
    try {
      for (const message of messages) {
        await this.db.executeStatement(`
          INSERT INTO memory_contexts (session_id, context_type, content, importance_score, created_at, accessed_at)
          VALUES (?, 'long_term', ?, ?, ?, ?)
        `, [
          sessionId,
          JSON.stringify(message),
          message.sentiment || 0.5, // importance based on sentiment
          message.timestamp.toISOString(),
          new Date().toISOString()
        ]);
      }
      logger.debug(`Archived ${messages.length} messages for session ${sessionId}`);
    } catch (error) {
      logger.error(`Failed to archive messages for ${sessionId}:`, error);
    }
  }

  /**
   * Recall memories based on query or date range
   */
  async recallMemories(
    sessionId: string, 
    query?: string, 
    startDate?: Date, 
    endDate?: Date,
    limit: number = 20
  ): Promise<MemoryContext[]> {
    try {
      let sql = `
        SELECT id, session_id, context_type, content, importance_score, created_at, accessed_at
        FROM memory_contexts 
        WHERE session_id = ?
      `;
      const params: any[] = [sessionId];

      if (startDate) {
        sql += ' AND created_at >= ?';
        params.push(startDate.toISOString());
      }

      if (endDate) {
        sql += ' AND created_at <= ?';
        params.push(endDate.toISOString());
      }

      if (query) {
        sql += ' AND content LIKE ?';
        params.push(`%${query}%`);
      }

      sql += ' ORDER BY importance_score DESC, created_at DESC LIMIT ?';
      params.push(limit);

      const result = await this.db.executeQuery(sql, params);
      const rows = result.data;
      
      return rows.map((row: any) => ({
        id: row.id,
        sessionId: row.session_id,
        contextType: row.context_type,
        content: JSON.parse(row.content),
        importanceScore: row.importance_score,
        createdAt: new Date(row.created_at),
        accessedAt: new Date(row.accessed_at)
      }));
    } catch (error) {
      logger.error(`Failed to recall memories for ${sessionId}:`, error);
      return [];
    }
  }

  /**
   * Clear session memory (both active and archived)
   */
  async clearSessionMemory(sessionId: string): Promise<void> {
    try {
      // Clear from active memory
      this.activeMemories.delete(sessionId);

      // Delete JSON file
      const memoryFile = path.join(this.memoryPath, `${sessionId}.json`);
      try {
        await fs.unlink(memoryFile);
      } catch {
        // File might not exist, ignore
      }

      // Clear from database
      await this.db.executeStatement('DELETE FROM memory_contexts WHERE session_id = ?', [sessionId]);
      
      logger.info(`Cleared all memory for session ${sessionId}`);
    } catch (error) {
      logger.error(`Failed to clear memory for ${sessionId}:`, error);
    }
  }

  /**
   * Get memory statistics for a session
   */
  async getMemoryStats(sessionId: string): Promise<{
    activeMessages: number;
    archivedMessages: number;
    totalContext: number;
    averageSentiment: number;
  }> {
    try {
      const activeMemory = await this.loadSessionMemory(sessionId);
      
      const archivedResult = await this.db.executeQuery(
        'SELECT COUNT(*) as count FROM memory_contexts WHERE session_id = ?',
        [sessionId]
      );
      const archivedCount = archivedResult.data;

      const sentiments = activeMemory.messages
        .filter(m => m.sentiment !== undefined)
        .map(m => m.sentiment!);

      const avgSentiment = sentiments.length > 0 
        ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length 
        : 0;

      return {
        activeMessages: activeMemory.messages.length,
        archivedMessages: archivedCount[0]?.count || 0,
        totalContext: activeMemory.context.length,
        averageSentiment: avgSentiment
      };
    } catch (error) {
      logger.error(`Failed to get memory stats for ${sessionId}:`, error);
      return {
        activeMessages: 0,
        archivedMessages: 0,
        totalContext: 0,
        averageSentiment: 0
      };
    }
  }

  // Legacy methods for backward compatibility
  async getContext(sessionId: string): Promise<any> {
    const memory = await this.loadSessionMemory(sessionId);
    return {
      messages: memory.messages,
      context: memory.context,
      lastUpdated: memory.lastUpdated
    };
  }

  async setContext(sessionId: string, context: any): Promise<void> {
    const memory = await this.loadSessionMemory(sessionId);
    if (context.messages) {
      memory.messages = context.messages;
    }
    if (context.context) {
      memory.context = context.context;
    }
    memory.lastUpdated = new Date();
    await this.saveActiveMemory(sessionId, memory);
  }

  async clearContext(sessionId: string): Promise<void> {
    await this.clearSessionMemory(sessionId);
  }
}

// Don't create instance here - will be created with proper dependency injection
// in the main application server
export default MemoryService;
