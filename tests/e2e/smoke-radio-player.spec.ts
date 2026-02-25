import { test, expect } from '@playwright/test';

test.describe('Smoke: Radio Player Page', () => {
  test('page loads with correct title', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/BTRadio/);
  });

  test('top bar renders branding, theme toggle, and auth buttons', async ({ page }) => {
    await page.goto('/');

    // BTRadio DJ branding text
    await expect(page.locator('text=BTRadio DJ')).toBeVisible();

    // Auth buttons (unauthenticated state)
    await expect(page.locator('text=Sign In')).toBeVisible();
    await expect(page.locator('text=Get Started')).toBeVisible();

    // Theme toggle button (the outline icon button in top bar)
    const themeToggle = page.locator('button').filter({ has: page.locator('.sr-only', { hasText: 'Toggle theme' }) });
    await expect(themeToggle).toBeVisible();
  });

  test('GlassPlayButton is visible and clickable', async ({ page }) => {
    await page.goto('/');

    // Play button should be visible with aria-label
    const playButton = page.locator('button[aria-label="Play"], button[aria-label="Pause"], button[aria-label="Buffering"]');
    await expect(playButton).toBeVisible();
    await expect(playButton).toBeEnabled();
  });

  test('VolumeSlider is visible', async ({ page }) => {
    await page.goto('/');

    const slider = page.locator('input[type="range"]');
    await expect(slider).toBeVisible();
  });

  test('ActionButtons (mute, share, more) are visible', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('button[aria-label="Mute"], button[aria-label="Unmute"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Share"]')).toBeVisible();
    await expect(page.locator('button[aria-label="More options"]')).toBeVisible();
  });

  test('theme toggle switches between light and dark mode', async ({ page }) => {
    await page.goto('/');

    const themeToggle = page.locator('button').filter({ has: page.locator('.sr-only', { hasText: 'Toggle theme' }) });

    // Select "Dark" mode
    await themeToggle.click();
    await page.locator('[role="menuitem"]', { hasText: 'Dark' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Wait for dropdown to fully close before re-opening
    await expect(page.locator('[role="menu"]')).not.toBeVisible();

    // Switch to "Light" mode
    await themeToggle.click();
    await page.locator('[role="menuitem"]', { hasText: 'Light' }).click();
    await expect(page.locator('html')).toHaveClass(/light/);
  });

  test('dynamic favicon link element exists', async ({ page }) => {
    await page.goto('/');

    // Wait for client-side hydration to create the favicon
    await page.waitForTimeout(1000);
    const faviconLink = page.locator('link[rel="icon"]');
    await expect(faviconLink).toHaveCount(1);
  });
});
