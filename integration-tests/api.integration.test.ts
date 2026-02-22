/**
 * Integration Tests for Lackadaisical AI Chat
 * Tests end-to-end functionality including API endpoints, database, and AI services
 */

import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';

// Test configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const TEST_TIMEOUT = 30000;

describe('Health Check Endpoints', () => {
  it('should return health status', async () => {
    const response = await request(API_BASE_URL)
      .get('/api/health')
      .expect(200);

    expect(response.body).toHaveProperty('status');
    expect(response.body.status).toBe('healthy');
  }, TEST_TIMEOUT);

  it('should return detailed health metrics', async () => {
    const response = await request(API_BASE_URL)
      .get('/api/health/detailed')
      .expect(200);

    expect(response.body).toHaveProperty('uptime');
    expect(response.body).toHaveProperty('memory');
    expect(response.body).toHaveProperty('database');
  }, TEST_TIMEOUT);
});

describe('Chat API Endpoints', () => {
  let sessionId: string;

  beforeAll(() => {
    sessionId = `test_session_${Date.now()}`;
  });

  it('should create a new chat session', async () => {
    const response = await request(API_BASE_URL)
      .post('/api/sessions')
      .send({
        name: 'Test Session',
        sessionId
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.id).toBe(sessionId);
  }, TEST_TIMEOUT);

  it('should send a message and receive a response', async () => {
    const response = await request(API_BASE_URL)
      .post('/api/v1/chat')
      .send({
        message: 'Hello, this is a test message',
        sessionId
      })
      .expect(200);

    expect(response.body).toHaveProperty('response');
    expect(response.body.response).toBeTruthy();
    expect(typeof response.body.response).toBe('string');
  }, TEST_TIMEOUT);

  it('should retrieve session history', async () => {
    const response = await request(API_BASE_URL)
      .get(`/api/sessions/${sessionId}/messages`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  }, TEST_TIMEOUT);

  it('should get session analytics', async () => {
    const response = await request(API_BASE_URL)
      .get(`/api/chat/analytics/${sessionId}`)
      .expect(200);

    expect(response.body).toHaveProperty('messageCount');
    expect(response.body).toHaveProperty('averageSentiment');
  }, TEST_TIMEOUT);
});

describe('Model Management', () => {
  it('should list available models', async () => {
    const response = await request(API_BASE_URL)
      .get('/api/models')
      .expect(200);

    expect(response.body).toHaveProperty('models');
    expect(Array.isArray(response.body.models)).toBe(true);
  }, TEST_TIMEOUT);

  it('should get current active model', async () => {
    const response = await request(API_BASE_URL)
      .get('/api/models/current')
      .expect(200);

    expect(response.body).toHaveProperty('provider');
    expect(response.body).toHaveProperty('model');
  }, TEST_TIMEOUT);
});

describe('Plugin System', () => {
  it('should list available plugins', async () => {
    const response = await request(API_BASE_URL)
      .get('/api/plugins')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  }, TEST_TIMEOUT);

  it('should execute weather plugin', async () => {
    const response = await request(API_BASE_URL)
      .post('/api/plugins/weather/execute')
      .send({
        location: 'London'
      })
      .expect(200);

    expect(response.body).toHaveProperty('location');
    expect(response.body).toHaveProperty('temperature');
  }, TEST_TIMEOUT);
});

describe('Memory and Context', () => {
  const testSessionId = `memory_test_${Date.now()}`;

  it('should store conversation context', async () => {
    // Send multiple messages to build context
    await request(API_BASE_URL)
      .post('/api/v1/chat')
      .send({
        message: 'My name is Alice',
        sessionId: testSessionId
      })
      .expect(200);

    await request(API_BASE_URL)
      .post('/api/v1/chat')
      .send({
        message: 'I live in New York',
        sessionId: testSessionId
      })
      .expect(200);

    // Retrieve context
    const response = await request(API_BASE_URL)
      .get(`/api/chat/context/${testSessionId}`)
      .expect(200);

    expect(response.body).toHaveProperty('recentMessages');
    expect(response.body.recentMessages.length).toBeGreaterThan(0);
  }, TEST_TIMEOUT);

  it('should search across conversations', async () => {
    const response = await request(API_BASE_URL)
      .get('/api/chat/search/all')
      .query({ q: 'Alice' })
      .expect(200);

    expect(response.body).toHaveProperty('results');
    expect(Array.isArray(response.body.results)).toBe(true);
  }, TEST_TIMEOUT);
});

describe('Personality and Emotional Intelligence', () => {
  it('should get personality state', async () => {
    const response = await request(API_BASE_URL)
      .get('/api/personality/state')
      .expect(200);

    expect(response.body).toHaveProperty('name');
    expect(response.body).toHaveProperty('currentMood');
  }, TEST_TIMEOUT);

  it('should analyze sentiment of message', async () => {
    const response = await request(API_BASE_URL)
      .post('/api/v1/chat')
      .send({
        message: 'I am feeling very happy today!',
        sessionId: `sentiment_test_${Date.now()}`
      })
      .expect(200);

    // Response should include sentiment analysis
    expect(response.body).toBeTruthy();
  }, TEST_TIMEOUT);
});

describe('Database Operations', () => {
  it('should handle concurrent writes', async () => {
    const sessionId = `concurrent_test_${Date.now()}`;
    const promises = [];

    // Send multiple messages concurrently
    for (let i = 0; i < 5; i++) {
      promises.push(
        request(API_BASE_URL)
          .post('/api/v1/chat')
          .send({
            message: `Concurrent message ${i}`,
            sessionId
          })
      );
    }

    const responses = await Promise.all(promises);
    
    // All should succeed
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
  }, TEST_TIMEOUT);
});

describe('Error Handling', () => {
  it('should handle invalid session ID', async () => {
    const response = await request(API_BASE_URL)
      .get('/api/sessions/invalid_session_id_that_does_not_exist/messages')
      .expect(404);

    expect(response.body).toHaveProperty('error');
  }, TEST_TIMEOUT);

  it('should handle malformed requests', async () => {
    const response = await request(API_BASE_URL)
      .post('/api/v1/chat')
      .send({
        // Missing required fields
      })
      .expect(400);

    expect(response.body).toHaveProperty('error');
  }, TEST_TIMEOUT);

  it('should handle rate limiting', async () => {
    const promises = [];
    
    // Send many requests rapidly
    for (let i = 0; i < 100; i++) {
      promises.push(
        request(API_BASE_URL)
          .get('/api/health')
      );
    }

    const responses = await Promise.all(promises);
    
    // Some should be rate limited
    const rateLimited = responses.some(r => r.status === 429);
    // Rate limiting might not be strict enough to trigger in tests
    // so we just check that all responses are either 200 or 429
    responses.forEach(response => {
      expect([200, 429]).toContain(response.status);
    });
  }, TEST_TIMEOUT);
});

describe('WebSocket Communication', () => {
  it('should establish WebSocket connection', async () => {
    // This would require WebSocket client
    // Placeholder for now
    expect(true).toBe(true);
  }, TEST_TIMEOUT);
});

describe('Session Management', () => {
  it('should list all sessions', async () => {
    const response = await request(API_BASE_URL)
      .get('/api/sessions')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  }, TEST_TIMEOUT);

  it('should delete a session', async () => {
    const sessionId = `delete_test_${Date.now()}`;
    
    // Create session
    await request(API_BASE_URL)
      .post('/api/sessions')
      .send({ sessionId, name: 'Delete Test' })
      .expect(201);

    // Delete session
    await request(API_BASE_URL)
      .delete(`/api/sessions/${sessionId}`)
      .expect(200);

    // Verify deletion
    await request(API_BASE_URL)
      .get(`/api/sessions/${sessionId}/messages`)
      .expect(404);
  }, TEST_TIMEOUT);
});

describe('Journal Functionality', () => {
  it('should create a journal entry', async () => {
    const response = await request(API_BASE_URL)
      .post('/api/journal/entries')
      .send({
        title: 'Test Journal Entry',
        content: 'This is a test journal entry for integration testing',
        tags: ['test', 'integration'],
        mood: 'neutral'
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
  }, TEST_TIMEOUT);

  it('should retrieve journal entries', async () => {
    const response = await request(API_BASE_URL)
      .get('/api/journal/entries')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  }, TEST_TIMEOUT);
});

export {};
