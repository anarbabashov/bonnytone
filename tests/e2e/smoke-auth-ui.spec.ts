import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/crypto';

test.describe.serial('Smoke: Auth UI Flows', () => {
  const testEmail = `smoke-auth-ui-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';
  const testDisplayName = 'Smoke Auth User';
  let userId: string;

  test.beforeAll(async () => {
    const passwordHash = await hashPassword(testPassword);
    const user = await prisma.user.create({
      data: {
        email: testEmail.toLowerCase(),
        displayName: testDisplayName,
        passwordHash,
        emailVerifiedAt: new Date(),
        isBlocked: false,
      },
    });
    userId = user.id;
  });

  test.afterAll(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  test('navigate to login from radio player', async ({ page }) => {
    await page.goto('/');
    await page.locator('a[href="/auth/login"]').click();
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('navigate to register from radio player', async ({ page }) => {
    await page.goto('/');
    await page.locator('a[href="/auth/register"]').click();
    await expect(page).toHaveURL(/\/auth\/register/);
  });

  test('register page renders correctly', async ({ page }) => {
    await page.goto('/auth/register');

    // Title
    await expect(page.locator('text=Create Account').first()).toBeVisible();

    // Form fields
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#displayName')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#confirmPassword')).toBeVisible();

    // Submit button
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Create Account');

    // Link to login
    await expect(page.locator('a[href="/auth/login"]')).toBeVisible();
  });

  test('login page renders correctly', async ({ page }) => {
    await page.goto('/auth/login');

    // Title (CardTitle renders as a styled div, not h1/h2)
    await expect(page.locator('text=Sign In').first()).toBeVisible();

    // Form fields
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();

    // Submit button
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Sign In');

    // Forgot password link
    await expect(page.locator('a[href="/auth/forgot-password"]')).toBeVisible();

    // Create account link
    await expect(page.locator('a[href="/auth/register"]')).toBeVisible();
  });

  test('login with valid credentials redirects to home with welcome message', async ({ page }) => {
    await page.goto('/auth/login');

    // Fill form
    await page.locator('#email').fill(testEmail);
    await page.locator('#password').fill(testPassword);

    // Submit
    await page.locator('button[type="submit"]').click();

    // Should redirect to home
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // Top bar should show welcome message and logout button
    await expect(page.locator(`text=Welcome, ${testDisplayName}`)).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button', { hasText: 'Logout' })).toBeVisible();

    // Sign In / Get Started should NOT be visible
    await expect(page.locator('a[href="/auth/login"]')).not.toBeVisible();
  });

  test('authenticated state persists on refresh', async ({ page }) => {
    // Login first
    await page.goto('/auth/login');
    await page.locator('#email').fill(testEmail);
    await page.locator('#password').fill(testPassword);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL('/', { timeout: 10000 });
    await expect(page.locator(`text=Welcome, ${testDisplayName}`)).toBeVisible({ timeout: 5000 });

    // Reload
    await page.reload();

    // Should still show authenticated state
    await expect(page.locator(`text=Welcome, ${testDisplayName}`)).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button', { hasText: 'Logout' })).toBeVisible();
  });

  test('logout flow returns to unauthenticated state', async ({ page }) => {
    // Login first
    await page.goto('/auth/login');
    await page.locator('#email').fill(testEmail);
    await page.locator('#password').fill(testPassword);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL('/', { timeout: 10000 });
    await expect(page.locator('button', { hasText: 'Logout' })).toBeVisible({ timeout: 5000 });

    // Click logout
    await page.locator('button', { hasText: 'Logout' }).click();

    // Should show unauthenticated buttons again
    await expect(page.locator('text=Sign In')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Get Started')).toBeVisible();
  });
});
