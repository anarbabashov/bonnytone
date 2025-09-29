import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/crypto';

test.describe.serial('Blocked User Login Flow', () => {
  const testEmail = `blocked-user-test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
  const testPassword = 'TestPassword123!';
  let userId: string;

  test.beforeAll(async () => {
    // Create a verified user in the database
    const passwordHash = await hashPassword(testPassword);

    const user = await prisma.user.create({
      data: {
        email: testEmail,
        displayName: 'Blocked User Test',
        passwordHash,
        emailVerifiedAt: new Date(), // Make sure email is verified
        isBlocked: false, // Start with unblocked user
      },
    });

    userId = user.id;
  });

  test.afterAll(async () => {
    // Clean up: delete the test user
    if (userId) {
      await prisma.user.delete({
        where: { id: userId },
      }).catch(() => {
        // Ignore errors if user doesn't exist
      });
    }
  });

  test('should prevent login for blocked user with clear error message', async ({ page }) => {
    // Step 1: Block the user in the database
    console.log('Step 1: Blocking user in database...');
    await prisma.user.update({
      where: { id: userId },
      data: { isBlocked: true },
    });

    // Step 2: Navigate to login page
    console.log('Step 2: Navigating to login page...');
    await page.goto('/auth/login');
    await expect(page).toHaveURL(/\/auth\/login/);

    // Step 3: Fill out login form
    console.log('Step 3: Filling out login form...');
    const emailField = page.locator('input[type="email"], input[name="email"]').first();
    await expect(emailField).toBeVisible();
    await emailField.fill(testEmail);

    const passwordField = page.locator('input[type="password"], input[name="password"]').first();
    await expect(passwordField).toBeVisible();
    await passwordField.fill(testPassword);

    // Step 4: Submit login form
    console.log('Step 4: Submitting login form...');
    const submitButton = page.locator('button[type="submit"], button:has-text("login"), button:has-text("sign in")').first();
    await expect(submitButton).toBeVisible();

    // Make a direct API request to test the endpoint
    const response = await page.request.post('/api/auth/login', {
      data: {
        email: testEmail,
        password: testPassword,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Step 5: Verify response
    console.log('Step 5: Verifying blocked user response...');
    expect(response.status()).toBe(403);

    const responseData = await response.json();
    expect(responseData.error).toBe('Account is blocked. Please contact support.');

    // Verify no token is issued
    expect(responseData.token).toBeUndefined();
    expect(responseData.user).toBeUndefined();

    console.log('✅ Blocked user login test completed successfully');
  });

  test('should allow login after unblocking user', async ({ page }) => {
    // Step 1: Unblock the user
    console.log('Step 1: Unblocking user in database...');
    await prisma.user.update({
      where: { id: userId },
      data: { isBlocked: false },
    });

    // Step 2: Try login again - should work now
    console.log('Step 2: Attempting login after unblocking...');
    const response = await page.request.post('/api/auth/login', {
      data: {
        email: testEmail,
        password: testPassword,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Step 3: Verify successful login
    console.log('Step 3: Verifying successful login...');
    expect(response.status()).toBe(200);

    const responseData = await response.json();
    expect(responseData.token).toBeDefined();
    expect(responseData.user).toBeDefined();
    expect(responseData.user.email).toBe(testEmail);

    console.log('✅ Unblocked user login test completed successfully');
  });
});