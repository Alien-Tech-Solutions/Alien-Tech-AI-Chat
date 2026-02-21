/**
 * Database Service Unit Tests
 * Tests for the core database operations
 */

import { DatabaseService } from '../services/DatabaseService';
import { Conversation, JournalEntry, PersonalityState } from '../types';

// Mock better-sqlite3
jest.mock('better-sqlite3', () => {
  return jest.fn().mockImplementation(() => ({
    prepare: jest.fn().mockReturnValue({
      all: jest.fn().mockReturnValue([]),
      run: jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
      get: jest.fn().mockReturnValue(null),
    }),
    exec: jest.fn(),
    pragma: jest.fn(),
    close: jest.fn(),
    transaction: jest.fn((fn) => fn),
  }));
});

// Mock config
jest.mock('../config/settings', () => ({
  config: {
    database: {
      type: 'sqlite',
      path: ':memory:',
    },
  },
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  dbLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock initDatabase
jest.mock('../utils/initDatabase', () => ({
  initializeDatabase: jest.fn().mockResolvedValue({
    prepare: jest.fn().mockReturnValue({
      all: jest.fn().mockReturnValue([]),
      run: jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
      get: jest.fn().mockReturnValue(null),
    }),
    exec: jest.fn(),
    pragma: jest.fn(),
    close: jest.fn(),
    transaction: jest.fn((fn) => fn),
  }),
}));

describe('DatabaseService', () => {
  let db: DatabaseService;

  beforeEach(async () => {
    db = new DatabaseService();
    await db.initialize();
  });

  afterEach(async () => {
    await db.close();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const newDb = new DatabaseService();
      await expect(newDb.initialize()).resolves.not.toThrow();
    });
  });

  describe('Conversation Operations', () => {
    it('should insert a conversation and return an ID', async () => {
      const conversation = {
        session_id: 'test-session',
        user_message: 'Hello',
        ai_response: 'Hi there!',
        timestamp: new Date().toISOString(),
        sentiment_score: 0.5,
        sentiment_label: 'positive',
        context_tags: ['greeting'],
        message_type: 'chat' as const,
        tokens_used: 100,
        response_time_ms: 500,
        model_used: 'test-model',
      };

      const id = await db.insertConversation(conversation);
      expect(typeof id).toBe('number');
    });

    it('should handle conversation retrieval by session', async () => {
      const conversations = await db.getConversationsBySession('test-session', 10);
      expect(Array.isArray(conversations)).toBe(true);
    });

    it('should handle recent conversations retrieval', async () => {
      const conversations = await db.getRecentConversations(10);
      expect(Array.isArray(conversations)).toBe(true);
    });

    it('should handle conversation search', async () => {
      const results = await db.searchConversations('test', 10);
      expect(Array.isArray(results)).toBe(true);
    });

    it('should delete conversation history for a session', async () => {
      const deletedCount = await db.deleteConversationHistory('test-session');
      expect(typeof deletedCount).toBe('number');
    });
  });

  describe('Session Operations', () => {
    it('should create a new session', async () => {
      const sessionId = await db.createSession('Test Session');
      expect(typeof sessionId).toBe('string');
    });

    it('should get all sessions', async () => {
      const sessions = await db.getSessions();
      expect(Array.isArray(sessions)).toBe(true);
    });

    it('should update session activity', async () => {
      await expect(db.updateSessionActivity('test-session')).resolves.not.toThrow();
    });

    it('should delete a session', async () => {
      await expect(db.deleteSession('test-session')).resolves.not.toThrow();
    });
  });

  describe('Personality State Operations', () => {
    it('should get personality state', async () => {
      const state = await db.getPersonalityState();
      // Can be null if not initialized
      expect(state === null || typeof state === 'object').toBe(true);
    });

    it('should update personality state', async () => {
      const updates: Partial<PersonalityState> = {
        energy_level: 80,
        empathy_level: 90,
      };
      await expect(db.updatePersonalityState(updates)).resolves.not.toThrow();
    });
  });

  describe('Journal Operations', () => {
    it('should create a journal entry', async () => {
      const entry = {
        title: 'Test Entry',
        content: 'This is a test journal entry',
        tags: ['test', 'journal'],
        mood: 'happy',
        session_id: 'test-session',
        privacy_level: 'private' as const,
        word_count: 10,
        reading_time_minutes: 1,
        themes: ['testing'],
        emotions: ['happy'],
      };

      const id = await db.createJournalEntry(entry);
      expect(typeof id).toBe('string');
    });

    it('should get journal entries with filters', async () => {
      const entries = await db.getJournalEntries({
        limit: 10,
        sortBy: 'created_at',
        sortOrder: 'desc',
      });
      expect(Array.isArray(entries)).toBe(true);
    });

    it('should get journal entries count', async () => {
      const count = await db.getJournalEntriesCount({});
      expect(typeof count).toBe('number');
    });

    it('should delete a journal entry', async () => {
      await expect(db.deleteJournalEntry('test-id')).resolves.not.toThrow();
    });
  });

  describe('Plugin State Operations', () => {
    it('should get plugin state', async () => {
      const state = await db.getPluginState('test-plugin');
      expect(state === null || typeof state === 'object').toBe(true);
    });

    it('should update plugin state', async () => {
      await expect(db.updatePluginState('test-plugin', { enabled: true })).resolves.not.toThrow();
    });
  });

  describe('Utility Operations', () => {
    it('should get database stats', async () => {
      const stats = await db.getDatabaseStats();
      expect(typeof stats).toBe('object');
    });

    it('should cleanup old data', async () => {
      await expect(db.cleanupOldData(365)).resolves.not.toThrow();
    });
  });
});
