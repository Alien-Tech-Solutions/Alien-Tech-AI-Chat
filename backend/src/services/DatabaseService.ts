import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { dbLogger } from '../utils/logger';
import { config } from '../config/settings';
import {
  Conversation,
  PersonalityState,
  JournalEntry,
  Session,
  PluginState,
  QueryResult,
  MoodState,
  MoodSnapshot
} from '../types';

// Database interface for abstraction
interface IDatabaseAdapter {
  initialize(): Promise<void>;
  close(): Promise<void>;
  executeQuery<T = any>(query: string, params?: any[]): Promise<QueryResult<T>>;
  executeStatement(query: string, params?: any[]): Promise<QueryResult<void>>;
  transaction<T>(fn: () => T): () => T;
  runMigrations(): Promise<void>;
}

// SQLite implementation
class SQLiteAdapter implements IDatabaseAdapter {
  private db: Database.Database | null = null;

  async initialize(): Promise<void> {
    try {
      // Initialize database with schema if it doesn't exist
      const { initializeDatabase } = await import('../utils/initDatabase');
      this.db = await initializeDatabase();
      
      dbLogger.info('SQLite database initialized:', { path: config.database.path });
    } catch (error) {
      dbLogger.error('Failed to initialize SQLite database:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      dbLogger.info('SQLite database connection closed');
    }
  }

  async executeQuery<T = any>(query: string, params: any[] = []): Promise<QueryResult<T>> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      const stmt = this.db.prepare(query);
      const data = stmt.all(...params) as T;
      return { data };
    } catch (error) {
      dbLogger.error('SQLite query failed:', { query, error });
      throw error;
    }
  }

  async executeStatement(query: string, params: any[] = []): Promise<QueryResult<void>> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      const stmt = this.db.prepare(query);
      const result = stmt.run(...params);
      return {
        data: undefined,
        affected_rows: result.changes,
        last_insert_id: Number(result.lastInsertRowid)
      };
    } catch (error) {
      dbLogger.error('SQLite statement failed:', { query, error });
      throw error;
    }
  }

  transaction<T>(fn: () => T): () => T {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.transaction(fn);
  }

  public async runMigrations(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      // Import and run the initialization script
      const { initializeDatabase } = await import('../utils/initDatabase');
      this.db = await initializeDatabase();
      dbLogger.info('SQLite schema initialization completed');
    } catch (error) {
      dbLogger.error('SQLite migration failed:', error);
      throw error;
    }
  }
}

// PostgreSQL implementation (placeholder for now)
class PostgreSQLAdapter implements IDatabaseAdapter {
  async initialize(): Promise<void> {
    dbLogger.info('PostgreSQL adapter - not yet implemented');
    throw new Error('PostgreSQL support coming soon');
  }

  async close(): Promise<void> {
    dbLogger.info('PostgreSQL connection closed');
  }

  async executeQuery<T = any>(query: string, params: any[] = []): Promise<QueryResult<T>> {
    throw new Error('PostgreSQL support coming soon');
  }

  async executeStatement(query: string, params: any[] = []): Promise<QueryResult<void>> {
    throw new Error('PostgreSQL support coming soon');
  }

  transaction<T>(fn: () => T): () => T {
    throw new Error('PostgreSQL support coming soon');
  }

  async runMigrations(): Promise<void> {
    throw new Error('PostgreSQL support coming soon');
  }
}

// MySQL implementation (placeholder for now)
class MySQLAdapter implements IDatabaseAdapter {
  async initialize(): Promise<void> {
    dbLogger.info('MySQL adapter - not yet implemented');
    throw new Error('MySQL support coming soon');
  }

  async close(): Promise<void> {
    dbLogger.info('MySQL connection closed');
  }

  async executeQuery<T = any>(query: string, params: any[] = []): Promise<QueryResult<T>> {
    throw new Error('MySQL support coming soon');
  }

  async executeStatement(query: string, params: any[] = []): Promise<QueryResult<void>> {
    throw new Error('MySQL support coming soon');
  }

  transaction<T>(fn: () => T): () => T {
    throw new Error('MySQL support coming soon');
  }

  async runMigrations(): Promise<void> {
    throw new Error('MySQL support coming soon');
  }
}

// Database factory
function createDatabaseAdapter(): IDatabaseAdapter {
  switch (config.database.type) {
    case 'sqlite':
      return new SQLiteAdapter();
    case 'postgresql':
      return new PostgreSQLAdapter();
    case 'mysql':
      return new MySQLAdapter();
    default:
      throw new Error(`Unsupported database type: ${config.database.type}`);
  }
}

// Main Database Service
export class DatabaseService {
  private adapter: IDatabaseAdapter;
  private isInitialized = false;

  constructor() {
    this.adapter = createDatabaseAdapter();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.adapter.initialize();
      await this.adapter.runMigrations();
      this.isInitialized = true;
      
      dbLogger.info('Database service initialized successfully', {
        type: config.database.type,
        path: config.database.path
      });
    } catch (error) {
      dbLogger.error('Failed to initialize database service:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.isInitialized) {
      await this.adapter.close();
      this.isInitialized = false;
      dbLogger.info('Database service closed');
    }
  }

  public async executeQuery<T = any>(query: string, params: any[] = []): Promise<QueryResult<T>> {
    if (!this.isInitialized) {
      throw new Error('Database service not initialized');
    }
    return this.adapter.executeQuery<T>(query, params);
  }

  public async executeStatement(query: string, params: any[] = []): Promise<QueryResult<void>> {
    if (!this.isInitialized) {
      throw new Error('Database service not initialized');
    }
    return this.adapter.executeStatement(query, params);
  }

  transaction<T>(fn: () => T): () => T {
    if (!this.isInitialized) {
      throw new Error('Database service not initialized');
    }
    return this.adapter.transaction(fn);
  }

  // =============================================================================
  // CONVERSATION METHODS
  // =============================================================================

  async insertConversation(conversation: Omit<Conversation, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const query = `
      INSERT INTO conversations (
        session_id, user_message, ai_response, timestamp, sentiment_score,
        sentiment_label, context_tags, message_type, tokens_used, response_time_ms, model_used
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      conversation.session_id,
      conversation.user_message,
      conversation.ai_response,
      conversation.timestamp,
      conversation.sentiment_score,
      conversation.sentiment_label,
      JSON.stringify(conversation.context_tags),
      conversation.message_type,
      conversation.tokens_used,
      conversation.response_time_ms,
      conversation.model_used
    ];

    const result = await this.executeStatement(query, params);
    return result.last_insert_id!;
  }

  async getConversationsBySession(sessionId: string, limit: number = 50): Promise<Conversation[]> {
    const query = `
      SELECT * FROM conversations 
      WHERE session_id = ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `;

    const result = await this.executeQuery<Conversation[]>(query, [sessionId, limit]);
    return result.data.map(this.parseConversation);
  }

  async getRecentConversations(limit: number = 20): Promise<Conversation[]> {
    const query = `
      SELECT * FROM conversations 
      ORDER BY timestamp DESC 
      LIMIT ?
    `;

    const result = await this.executeQuery<Conversation[]>(query, [limit]);
    return result.data.map(this.parseConversation);
  }

  async searchConversations(searchTerm: string, limit: number = 20): Promise<Conversation[]> {
    const query = `
      SELECT * FROM conversations 
      WHERE user_message LIKE ? OR ai_response LIKE ?
      ORDER BY timestamp DESC 
      LIMIT ?
    `;

    const result = await this.executeQuery<Conversation[]>(query, [`%${searchTerm}%`, `%${searchTerm}%`, limit]);
    return result.data.map(this.parseConversation);
  }

  private parseConversation(row: any): Conversation {
    return {
      id: row.id,
      session_id: row.session_id,
      user_message: row.user_message,
      ai_response: row.ai_response,
      timestamp: row.timestamp,
      sentiment_score: row.sentiment_score,
      sentiment_label: row.sentiment_label,
      context_tags: JSON.parse(row.context_tags || '[]'),
      message_type: row.message_type,
      tokens_used: row.tokens_used,
      response_time_ms: row.response_time_ms,
      model_used: row.model_used,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // =============================================================================
  // PERSONALITY METHODS
  // =============================================================================

  async getPersonalityState(): Promise<PersonalityState | null> {
    const query = 'SELECT * FROM personality_state WHERE id = 1';
    const result = await this.executeQuery<any[]>(query);
    
    if (result.data.length === 0) return null;
    
    const state = result.data[0];
    if (!state) return null;
     
    return {
      id: state.id,
      name: state.name,
      static_traits: JSON.parse(state.static_traits || '[]'),
      current_mood: JSON.parse(state.current_mood || '{}'),
      energy_level: state.energy_level,
      empathy_level: state.empathy_level,
      humor_level: state.humor_level,
      curiosity_level: state.curiosity_level,
      patience_level: state.patience_level,
      conversation_count: state.conversation_count,
      total_interactions: state.total_interactions,
      last_interaction: state.last_interaction,
      mood_history: JSON.parse(state.mood_history || '[]'),
      learning_data: JSON.parse(state.learning_data || '{}'),
      personality_version: state.personality_version,
      created_at: state.created_at,
      last_updated: state.last_updated,
    };
  }

  async updatePersonalityState(updates: Partial<PersonalityState>): Promise<void> {
    const setClause: string[] = [];
    const params: (string | number | boolean | null)[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'id') continue; // Skip ID updates
      
      setClause.push(`${key} = ?`);
      
      // Stringify JSON fields
      if (['static_traits', 'current_mood', 'mood_history', 'learning_data'].includes(key)) {
        params.push(JSON.stringify(value));
      } else {
        params.push(value as string | number | boolean | null);
      }
    }

    if (setClause.length === 0) return;

    const query = `
      UPDATE personality_state 
      SET ${setClause.join(', ')}, last_updated = CURRENT_TIMESTAMP 
      WHERE id = 1
    `;

    await this.executeStatement(query, params);
  }

  // =============================================================================
  // JOURNAL METHODS
  // =============================================================================

  async createJournalEntry(entry: Omit<JournalEntry, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const query = `
      INSERT INTO journal_entries (
        id, title, content, tags, mood, session_id, privacy_level,
        word_count, reading_time_minutes, themes, emotions, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      id, entry.title, entry.content, JSON.stringify(entry.tags), entry.mood,
      entry.session_id, entry.privacy_level, entry.word_count, entry.reading_time_minutes,
      JSON.stringify(entry.themes), JSON.stringify(entry.emotions), now, now
    ];

    await this.executeStatement(query, params);
    return id;
  }

  async getJournalEntry(id: string): Promise<JournalEntry | null> {
    const query = 'SELECT * FROM journal_entries WHERE id = ?';
    const result = await this.executeQuery<any[]>(query, [id]);
    
    if (result.data.length === 0) return null;
    
    const row = result.data[0];
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      tags: JSON.parse(row.tags || '[]'),
      mood: row.mood,
      session_id: row.session_id,
      privacy_level: row.privacy_level,
      word_count: row.word_count,
      reading_time_minutes: row.reading_time_minutes,
      themes: JSON.parse(row.themes || '[]'),
      emotions: JSON.parse(row.emotions || '[]'),
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  async getJournalEntries(filters: {
    sessionId?: string;
    mood?: string;
    tags?: string[];
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    limit?: number;
    offset?: number;
  }): Promise<JournalEntry[]> {
    let query = `SELECT * FROM journal_entries WHERE privacy_level != 'deleted'`;
    const params: any[] = [];
    
    if (filters.sessionId) {
      query += ` AND session_id = ?`;
      params.push(filters.sessionId);
    }
    
    if (filters.mood) {
      query += ` AND mood = ?`;
      params.push(filters.mood);
    }
    
    if (filters.search) {
      query += ` AND (title LIKE ? OR content LIKE ?)`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    
    if (filters.tags && filters.tags.length > 0) {
      const tagConditions = filters.tags.map(() => `tags LIKE ?`).join(' OR ');
      query += ` AND (${tagConditions})`;
      filters.tags.forEach(tag => params.push(`%"${tag}"%`));
    }
    
    const sortBy = filters.sortBy || 'created_at';
    const sortOrder = filters.sortOrder || 'desc';
    query += ` ORDER BY ${sortBy} ${sortOrder}`;
    
    if (filters.limit) {
      query += ` LIMIT ?`;
      params.push(filters.limit);
      
      if (filters.offset) {
        query += ` OFFSET ?`;
        params.push(filters.offset);
      }
    }
    
    const result = await this.executeQuery<any[]>(query, params);
    return result.data.map((row: any) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      tags: JSON.parse(row.tags || '[]'),
      mood: row.mood,
      session_id: row.session_id,
      privacy_level: row.privacy_level,
      word_count: row.word_count,
      reading_time_minutes: row.reading_time_minutes,
      themes: JSON.parse(row.themes || '[]'),
      emotions: JSON.parse(row.emotions || '[]'),
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  }

  async getJournalEntriesCount(filters: {
    sessionId?: string;
    mood?: string;
    tags?: string[];
    search?: string;
  }): Promise<number> {
    let query = `SELECT COUNT(*) as count FROM journal_entries WHERE privacy_level != 'deleted'`;
    const params: any[] = [];
    
    if (filters.sessionId) {
      query += ` AND session_id = ?`;
      params.push(filters.sessionId);
    }
    
    if (filters.mood) {
      query += ` AND mood = ?`;
      params.push(filters.mood);
    }
    
    if (filters.search) {
      query += ` AND (title LIKE ? OR content LIKE ?)`;
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    
    if (filters.tags && filters.tags.length > 0) {
      const tagConditions = filters.tags.map(() => `tags LIKE ?`).join(' OR ');
      query += ` AND (${tagConditions})`;
      filters.tags.forEach(tag => params.push(`%"${tag}"%`));
    }
    
    const result = await this.executeQuery<any[]>(query, params);
    return result.data[0]?.count ?? 0;
  }

  async updateJournalEntry(id: string, updates: Partial<JournalEntry>): Promise<void> {
    const fields: string[] = [];
    const params: any[] = [];
    
    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created_at' && value !== undefined) {
        fields.push(`${key} = ?`);
        if (key === 'tags' || key === 'themes' || key === 'emotions') {
          params.push(JSON.stringify(value));
        } else {
          params.push(value);
        }
      }
    });
    
    if (fields.length === 0) return;
    
    fields.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);
    
    const query = `UPDATE journal_entries SET ${fields.join(', ')} WHERE id = ?`;
    await this.executeStatement(query, params);
  }

  async deleteJournalEntry(id: string): Promise<void> {
    const query = 'DELETE FROM journal_entries WHERE id = ?';
    await this.executeStatement(query, [id]);
  }

  async getJournalAnalytics(sessionId?: string, days: number = 30): Promise<any> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    let baseQuery = `FROM journal_entries WHERE privacy_level != 'deleted' AND created_at >= ?`;
    const params = [cutoffDate.toISOString()];
    
    if (sessionId) {
      baseQuery += ` AND session_id = ?`;
      params.push(sessionId);
    }
    
    const totalResult = await this.executeQuery<any[]>(`SELECT COUNT(*) as count ${baseQuery}`, params);
    const wordsResult = await this.executeQuery<any[]>(`SELECT SUM(word_count) as total ${baseQuery}`, params);
    const moodResult = await this.executeQuery<any[]>(`SELECT mood, COUNT(*) as count ${baseQuery} GROUP BY mood`, params);
    const themeResult = await this.executeQuery<any[]>(`SELECT themes ${baseQuery}`, params);
    
    // Process theme statistics
    const themeMap = new Map();
    themeResult.data.forEach((row: any) => {
      if (row.themes) {
        const themes = JSON.parse(row.themes);
        themes.forEach((theme: string) => {
          themeMap.set(theme, (themeMap.get(theme) || 0) + 1);
        });
      }
    });
    
    return {
      totalEntries: totalResult.data[0].count,
      totalWords: wordsResult.data[0].total || 0,
      averageWordsPerEntry: totalResult.data[0].count > 0 ? Math.round((wordsResult.data[0].total || 0) / totalResult.data[0].count) : 0,
      moodDistribution: moodResult.data.reduce((acc: any, row: any) => {
        acc[row.mood] = row.count;
        return acc;
      }, {}),
      topThemes: Array.from(themeMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([theme, count]) => ({ theme, count })),
      timeRange: { days, from: cutoffDate.toISOString() }
    };
  }

  async getJournalEntriesForExport(sessionId?: string, dateRange?: { from: string; to: string }): Promise<JournalEntry[]> {
    let query = `SELECT * FROM journal_entries WHERE privacy_level != 'deleted'`;
    const params: any[] = [];
    
    if (sessionId) {
      query += ` AND session_id = ?`;
      params.push(sessionId);
    }
    
    if (dateRange) {
      query += ` AND created_at BETWEEN ? AND ?`;
      params.push(dateRange.from, dateRange.to);
    }
    
    query += ` ORDER BY created_at ASC`;
    
    const result = await this.executeQuery<any[]>(query, params);
    return result.data.map((row: any) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      tags: JSON.parse(row.tags || '[]'),
      mood: row.mood,
      session_id: row.session_id,
      privacy_level: row.privacy_level,
      word_count: row.word_count,
      reading_time_minutes: row.reading_time_minutes,
      themes: JSON.parse(row.themes || '[]'),
      emotions: JSON.parse(row.emotions || '[]'),
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  }

  // =============================================================================
  // SESSION METHODS
  // =============================================================================

  async upsertSession(session: Omit<Session, 'created_at' | 'updated_at'>): Promise<void> {
    const query = `
      INSERT INTO sessions (id, name, description, metadata, status)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        metadata = excluded.metadata,
        status = excluded.status,
        updated_at = CURRENT_TIMESTAMP
    `;

    const params = [
      session.id,
      session.name,
      session.description,
      JSON.stringify(session.metadata),
      session.status
    ];

    await this.executeStatement(query, params);
  }

  // =============================================================================
  // PLUGIN METHODS
  // =============================================================================

  async getPluginState(pluginName: string): Promise<PluginState | null> {
    const query = 'SELECT * FROM plugin_states WHERE plugin_name = ?';
    const result = await this.executeQuery<any[]>(query, [pluginName]);
    
    if (result.data.length === 0) return null;
    
    const state = result.data[0];
    if (!state) return null;
    
    return {
      plugin_name: state.plugin_name,
      enabled: Boolean(state.enabled),
      config: JSON.parse(state.config || '{}'),
      state_data: JSON.parse(state.state_data || '{}'),
      last_used: state.last_used,
      usage_count: state.usage_count,
      version: state.version,
      author: state.author,
      description: state.description,
      permissions: JSON.parse(state.permissions || '[]'),
      created_at: state.created_at,
      updated_at: state.updated_at,
    };
  }

  async updatePluginState(pluginName: string, updates: Partial<PluginState>): Promise<void> {
    const setClause: string[] = [];
    const params: (string | number | boolean | null)[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'plugin_name') continue; // Skip plugin name updates
      
      setClause.push(`${key} = ?`);
      
      // Stringify JSON fields
      if (['config', 'state_data', 'permissions'].includes(key)) {
        params.push(JSON.stringify(value));
      } else {
        params.push(value as string | number | boolean | null);
      }
    }

    if (setClause.length === 0) return;

    const query = `
      UPDATE plugin_states 
      SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP 
      WHERE plugin_name = ?
    `;

    params.push(pluginName);
    await this.executeStatement(query, params);
  }

  // =============================================================================
  // SESSION METHODS
  // =============================================================================

  async getSessions(): Promise<Session[]> {
    const query = `
      SELECT s.*, 
             COUNT(c.id) as message_count,
             MAX(c.timestamp) as last_message_time
      FROM sessions s
      LEFT JOIN conversations c ON s.id = c.session_id
      GROUP BY s.id
      ORDER BY s.last_active DESC
    `;
    
    const result = await this.executeQuery<any[]>(query);
    
    return result.data.map((row: any) => ({
      id: row.id,
      name: row.name,
      created_at: row.created_at,
      last_active: row.last_active,
      context_summary: row.context_summary,
      message_count: row.message_count || 0
    }));
  }

  async createSession(name: string, contextSummary: string = ''): Promise<string> {
    const sessionId = uuidv4();
    const now = new Date().toISOString();
    
    const query = `
      INSERT INTO sessions (id, name, context_summary, created_at, last_active, message_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    await this.executeStatement(query, [sessionId, name, contextSummary, now, now, 0]);
    return sessionId;
  }

  async getSession(sessionId: string): Promise<Session | null> {
    const query = `
      SELECT s.*, 
             COUNT(c.id) as message_count,
             MAX(c.timestamp) as last_message_time
      FROM sessions s
      LEFT JOIN conversations c ON s.id = c.session_id
      WHERE s.id = ?
      GROUP BY s.id
    `;
    
    const result = await this.executeQuery<any[]>(query, [sessionId]);
    
    if (result.data.length === 0) return null;
    
    const row = result.data[0];
    return {
      id: row.id,
      name: row.name,
      created_at: row.created_at,
      last_active: row.last_active,
      context_summary: row.context_summary,
      message_count: row.message_count || 0
    };
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    const query = `
      UPDATE sessions 
      SET last_active = CURRENT_TIMESTAMP,
          message_count = (
            SELECT COUNT(*) FROM conversations WHERE session_id = ?
          )
      WHERE id = ?
    `;
    
    await this.executeStatement(query, [sessionId, sessionId]);
  }

  async deleteSession(sessionId: string): Promise<void> {
    // Delete conversations first
    await this.executeStatement('DELETE FROM conversations WHERE session_id = ?', [sessionId]);
    
    // Then delete the session
    await this.executeStatement('DELETE FROM sessions WHERE id = ?', [sessionId]);
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  async getDatabaseStats(): Promise<Record<string, number>> {
    const query = `
      SELECT 
        (SELECT COUNT(*) FROM conversations) as total_conversations,
        (SELECT COUNT(*) FROM journal_entries) as total_journal_entries,
        (SELECT COUNT(*) FROM sessions) as total_sessions,
        (SELECT COUNT(*) FROM plugin_states WHERE enabled = 1) as active_plugins
    `;
    
    const result = await this.executeQuery<any[]>(query);
    return result.data[0] ?? {
      total_conversations: 0,
      total_journal_entries: 0,
      total_sessions: 0,
      active_plugins: 0,
    };
  }

  async cleanupOldData(daysToKeep: number = 365): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const query = `
      DELETE FROM conversations 
      WHERE timestamp < ? AND session_id NOT IN (
        SELECT DISTINCT session_id FROM conversations 
        WHERE timestamp >= ?
        LIMIT 10
      )
    `;
    
    const result = await this.executeStatement(query, [cutoffDate.toISOString(), cutoffDate.toISOString()]);
    
    dbLogger.info(`Cleaned up ${result.affected_rows} old conversations older than ${daysToKeep} days`);
  }

  /**
   * Delete all conversation history for a specific session
   */
  async deleteConversationHistory(sessionId: string): Promise<number> {
    const query = `DELETE FROM conversations WHERE session_id = ?`;
    const result = await this.executeStatement(query, [sessionId]);
    
    // Also update session message count
    await this.executeStatement(
      `UPDATE sessions SET message_count = 0, last_active = CURRENT_TIMESTAMP WHERE id = ?`,
      [sessionId]
    );
    
    dbLogger.info(`Deleted ${result.affected_rows} conversations for session: ${sessionId}`);
    return result.affected_rows || 0;
  }

  /**
   * Delete specific conversation by ID
   */
  async deleteConversation(conversationId: number): Promise<boolean> {
    const query = `DELETE FROM conversations WHERE id = ?`;
    const result = await this.executeStatement(query, [conversationId]);
    
    if (result.affected_rows && result.affected_rows > 0) {
      dbLogger.info(`Deleted conversation: ${conversationId}`);
      return true;
    }
    return false;
  }

  /**
   * Update an existing conversation
   */
  async updateConversation(
    conversationId: number, 
    updates: Partial<Conversation>
  ): Promise<void> {
    const fields: string[] = [];
    const params: any[] = [];
    
    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'created_at' && value !== undefined) {
        fields.push(`${key} = ?`);
        if (key === 'context_tags') {
          params.push(JSON.stringify(value));
        } else {
          params.push(value);
        }
      }
    });
    
    if (fields.length === 0) return;
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(conversationId);
    
    const query = `UPDATE conversations SET ${fields.join(', ')} WHERE id = ?`;
    await this.executeStatement(query, params);
    
    dbLogger.info(`Updated conversation: ${conversationId}`);
  }
}

// Export singleton instance
export const databaseService = new DatabaseService(); 