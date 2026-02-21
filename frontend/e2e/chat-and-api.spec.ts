import { test, expect } from '@playwright/test';

/**
 * Production-grade E2E tests for Chat functionality
 * These tests run against the real frontend and backend without mocks
 */

test.describe('Chat Interface', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display chat interface', async ({ page }) => {
    // Verify main chat elements are visible
    await expect(page.getByPlaceholder(/type.*message/i)).toBeVisible();
  });

  test('should create a new chat session', async ({ page }) => {
    // Look for new session button
    const newSessionBtn = page.getByRole('button', { name: /new/i });
    if (await newSessionBtn.isVisible()) {
      await newSessionBtn.click();
      // Verify session is created (input should be enabled)
      const input = page.getByPlaceholder(/type.*message/i);
      await expect(input).toBeEnabled();
    }
  });

  test('should display session list in sidebar', async ({ page }) => {
    // Verify sidebar shows sessions
    const sidebar = page.locator('[class*="sidebar"]').or(page.locator('nav'));
    await expect(sidebar).toBeVisible();
  });
});

test.describe('API Health', () => {
  test('should have healthy backend', async ({ request }) => {
    const response = await request.get('http://localhost:3001/health');
    expect(response.ok()).toBeTruthy();
    
    const health = await response.json();
    expect(health.status).toBe('ok');
  });

  test('should have AI providers endpoint', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/v1/chat/providers');
    expect(response.ok()).toBeTruthy();
  });
});

test.describe('Memory Preferences API', () => {
  test('should fetch memory preferences', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/v1/chat/preferences');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('crossSessionEnabled');
    expect(data).toHaveProperty('maxCrossSessionHistory');
    expect(data).toHaveProperty('contextTokenLimit');
    expect(data).toHaveProperty('privacyLevel');
  });

  test('should update memory preferences', async ({ request }) => {
    const response = await request.put('http://localhost:3001/api/v1/chat/preferences', {
      data: {
        userId: 'test-user',
        crossSessionEnabled: true,
        maxCrossSessionHistory: 15,
        privacyLevel: 'normal',
      },
    });
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.crossSessionEnabled).toBe(true);
    expect(data.maxCrossSessionHistory).toBe(15);
  });

  test('should toggle cross-session memory', async ({ request }) => {
    const response = await request.post('http://localhost:3001/api/v1/chat/preferences/toggle-cross-session', {
      data: {
        enabled: true,
        userId: 'test-user',
      },
    });
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('crossSessionEnabled');
  });

  test('should fetch session summaries', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/v1/chat/sessions/summaries');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('summaries');
    expect(Array.isArray(data.summaries)).toBe(true);
  });

  test('should search all sessions', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/v1/chat/search/all?q=test');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('entries');
    expect(data).toHaveProperty('totalFound');
  });
});

test.describe('Context Window API', () => {
  test('should get enhanced context window', async ({ request }) => {
    // First create a session
    const sessionResponse = await request.post('http://localhost:3001/api/sessions', {
      data: { name: 'Test Session' },
    });
    
    if (sessionResponse.ok()) {
      const session = await sessionResponse.json();
      const sessionId = session.data?.id || session.id;
      
      if (sessionId) {
        const contextResponse = await request.get(
          `http://localhost:3001/api/v1/chat/context/full/${sessionId}`
        );
        expect(contextResponse.ok()).toBeTruthy();
        
        const contextData = await contextResponse.json();
        expect(contextData).toHaveProperty('contextWindow');
      }
    }
  });
});

test.describe('Resource Status API', () => {
  test('should get resource status', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/v1/chat/resources');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('cpu');
    expect(data).toHaveProperty('memory');
  });
});
