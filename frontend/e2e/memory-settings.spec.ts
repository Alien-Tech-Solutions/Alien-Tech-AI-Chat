import { test, expect } from '@playwright/test';

/**
 * Production-grade E2E tests for Memory Settings
 * These tests run against the real frontend and backend without mocks
 */

test.describe('Memory Settings', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the settings page
    await page.goto('/settings');
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display Memory tab in settings', async ({ page }) => {
    // Verify Memory tab exists
    const memoryTab = page.getByRole('button', { name: /memory/i });
    await expect(memoryTab).toBeVisible();
  });

  test('should load Memory settings tab and show preferences', async ({ page }) => {
    // Click on Memory tab
    await page.getByRole('button', { name: /memory/i }).click();
    
    // Wait for content to load (either loading spinner disappears or content appears)
    await page.waitForSelector('text=Cross-Session Memory', { timeout: 10000 });
    
    // Verify key memory settings are visible
    await expect(page.getByText('Cross-Session Memory')).toBeVisible();
    await expect(page.getByText('Auto-Summarize')).toBeVisible();
    await expect(page.getByText('Cross-Session History Limit')).toBeVisible();
    await expect(page.getByText('Memory Privacy Level')).toBeVisible();
  });

  test('should toggle cross-session memory setting', async ({ page }) => {
    // Navigate to Memory tab
    await page.getByRole('button', { name: /memory/i }).click();
    await page.waitForSelector('text=Cross-Session Memory', { timeout: 10000 });

    // Find the cross-session toggle
    const crossSessionSection = page.locator('div').filter({ hasText: /^Cross-Session Memory/ }).first();
    const toggle = crossSessionSection.locator('input[type="checkbox"]');
    
    // Wait for toggle to be visible and interactable
    await toggle.waitFor({ state: 'attached' });
    
    // Get initial state
    const initialState = await toggle.isChecked();
    
    // Click the label/container instead of the hidden checkbox input
    await crossSessionSection.locator('label').click();
    
    // Verify state changed
    const newState = await toggle.isChecked();
    expect(newState).toBe(!initialState);
  });

  test('should adjust cross-session history limit slider', async ({ page }) => {
    // Navigate to Memory tab
    await page.getByRole('button', { name: /memory/i }).click();
    await page.waitForSelector('text=Cross-Session History Limit', { timeout: 10000 });

    // Find the slider
    const slider = page.locator('input[type="range"]');
    await expect(slider).toBeVisible();

    // Get current value
    const initialValue = await slider.inputValue();
    
    // Change slider value
    await slider.fill('15');
    
    // Verify the display updates
    await expect(page.getByText('15 sessions')).toBeVisible();
  });

  test('should change privacy level selection', async ({ page }) => {
    // Navigate to Memory tab
    await page.getByRole('button', { name: /memory/i }).click();
    await page.waitForSelector('text=Memory Privacy Level', { timeout: 10000 });

    // Find and click Strict privacy option
    const strictOption = page.getByRole('radio', { name: /strict/i });
    await strictOption.click();
    await expect(strictOption).toBeChecked();

    // Change to Relaxed
    const relaxedOption = page.getByRole('radio', { name: /relaxed/i });
    await relaxedOption.click();
    await expect(relaxedOption).toBeChecked();
  });

  test('should show unsaved changes indicator after modification', async ({ page }) => {
    // Navigate to Memory tab
    await page.getByRole('button', { name: /memory/i }).click();
    await page.waitForSelector('text=Cross-Session Memory', { timeout: 10000 });

    // Make a change by clicking the label
    const crossSessionSection = page.locator('div').filter({ hasText: /^Cross-Session Memory/ }).first();
    await crossSessionSection.locator('label').click();

    // Verify unsaved changes indicator appears
    await expect(page.getByText('Unsaved changes')).toBeVisible();
  });

  test('should save memory preferences', async ({ page }) => {
    // Navigate to Memory tab
    await page.getByRole('button', { name: /memory/i }).click();
    await page.waitForSelector('text=Cross-Session Memory', { timeout: 10000 });

    // Make a change
    const slider = page.locator('input[type="range"]');
    await slider.fill('12');

    // Click Save button
    const saveButton = page.getByRole('button', { name: /save changes/i });
    await saveButton.click();

    // Wait for save to complete (button should show "Saved!" or return to normal)
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });
  });

  test('should display system memory capabilities info', async ({ page }) => {
    // Navigate to Memory tab
    await page.getByRole('button', { name: /memory/i }).click();
    await page.waitForSelector('text=System Memory Capabilities', { timeout: 10000 });

    // Verify capabilities are displayed
    await expect(page.getByText('1,000 messages per session')).toBeVisible();
    await expect(page.getByText('128K token context window')).toBeVisible();
    await expect(page.getByText('32K token cross-session budget')).toBeVisible();
  });

  test('should display privacy note', async ({ page }) => {
    // Navigate to Memory tab
    await page.getByRole('button', { name: /memory/i }).click();
    await page.waitForSelector('text=Privacy Note', { timeout: 10000 });

    // Verify privacy note is visible
    await expect(page.getByText('Privacy Note')).toBeVisible();
    await expect(page.getByText(/server instance/i)).toBeVisible();
  });
});

test.describe('Settings Navigation', () => {
  test('should navigate between all settings tabs', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Test each tab
    const tabs = ['General', 'Appearance', 'AI Settings', 'Memory', 'Privacy', 'Advanced'];
    
    for (const tabName of tabs) {
      const tab = page.getByRole('button', { name: new RegExp(tabName, 'i') });
      await tab.click();
      // Each tab should show its heading
      await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    }
  });
});
