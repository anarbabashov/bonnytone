import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/crypto';
import { promises as fs } from 'fs';
import path from 'path';

const MAILBOX_DIR = path.join(process.cwd(), '.mailbox');

// Helper to clean mailbox
async function cleanMailbox() {
  try {
    const files = await fs.readdir(MAILBOX_DIR);
    for (const file of files) {
      await fs.unlink(path.join(MAILBOX_DIR, file));
    }
  } catch (error) {
    // Directory might not exist, that's OK
  }
}

// Helper to wait for and read password reset email
async function waitForPasswordResetEmail(email: string, timeout = 5000): Promise<string | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const files = await fs.readdir(MAILBOX_DIR);
      const resetEmailFile = files.find(f =>
        f.includes('password_reset') && f.includes(email.replace('@', '_at_'))
      );

      if (resetEmailFile) {
        const content = await fs.readFile(path.join(MAILBOX_DIR, resetEmailFile), 'utf-8');
        // Extract token from reset link
        const match = content.match(/\/auth\/reset-password\?token=([a-zA-Z0-9]+)/);
        return match ? match[1] : null;
      }
    } catch (error) {
      // Continue waiting
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return null;
}

test.describe.serial('Logout and Session Invalidation Flows', () => {
  const testEmail = `logout-test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
  const testPassword = 'TestPassword123!';
  const newPassword = 'NewTestPassword123!';
  let userId: string;

  test.beforeAll(async () => {
    // Set email provider for testing
    process.env.EMAIL_PROVIDER = 'dev';

    // Clean mailbox
    await cleanMailbox();

    // Create a verified user
    const passwordHash = await hashPassword(testPassword);
    const user = await prisma.user.create({
      data: {
        email: testEmail.toLowerCase(),
        displayName: 'Logout Test User',
        passwordHash,
        emailVerifiedAt: new Date(),
        isBlocked: false,
      },
    });

    userId = user.id;
    console.log(`✅ Created test user: ${testEmail}`);
  });

  test.afterAll(async () => {
    // Clean up
    if (userId) {
      await prisma.user.delete({
        where: { id: userId },
      }).catch(() => {});
      console.log('✅ Cleaned up test user');
    }
    await cleanMailbox();
  });

  test('should complete manual logout flow and invalidate session', async ({ page }) => {
    console.log('=== Manual Logout Flow Test ===');

    // Step 1: Login
    console.log('Step 1: Logging in...');
    const loginResponse = await page.request.post('/api/auth/login', {
      data: {
        email: testEmail,
        password: testPassword,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(loginResponse.status()).toBe(200);
    const loginData = await loginResponse.json();
    expect(loginData.token).toBeDefined();
    expect(loginData.user).toBeDefined();

    // Extract access token from login response
    const accessToken = loginData.token;
    console.log('✅ Login successful, access token obtained');

    // Step 2: Verify access to protected route
    console.log('Step 2: Testing access to protected route...');
    const meResponse1 = await page.request.get('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    expect(meResponse1.status()).toBe(200);
    const meData1 = await meResponse1.json();
    expect(meData1.user.email).toBe(testEmail.toLowerCase());
    console.log('✅ Protected route accessible with valid session');

    // Step 3: Logout
    console.log('Step 3: Logging out...');
    const logoutResponse = await page.request.post('/api/auth/logout', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    expect(logoutResponse.status()).toBe(200);
    const logoutData = await logoutResponse.json();
    expect(logoutData.message).toBe('Logged out successfully');

    // Check that auth cookies are cleared (if any were set)
    const logoutSetCookieHeader = logoutResponse.headers()['set-cookie'];
    if (logoutSetCookieHeader) {
      const logoutCookies = Array.isArray(logoutSetCookieHeader) ? logoutSetCookieHeader : [logoutSetCookieHeader];
      const hasExpiredCookies = logoutCookies.some(cookie =>
        cookie.includes('Max-Age=0') || cookie.includes('expires=Thu, 01 Jan 1970')
      );
      expect(hasExpiredCookies).toBe(true);
    }
    console.log('✅ Logout successful');

    // Step 4: Verify protected route is no longer accessible
    console.log('Step 4: Testing protected route after logout...');
    const meResponse2 = await page.request.get('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`, // Using old token
      },
    });

    expect(meResponse2.status()).toBe(401);
    const meData2 = await meResponse2.json();
    expect(meData2.error).toBeDefined();
    console.log('✅ Protected route correctly denies access after logout');

    // Step 5: Try using the old access token directly
    console.log('Step 5: Testing old access token...');
    const tokenTestResponse = await page.request.get('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${loginData.token}`,
      },
    });

    expect(tokenTestResponse.status()).toBe(401);
    console.log('✅ Old access token correctly rejected');

    console.log('🎉 Manual logout flow test completed successfully');
  });

  test('should invalidate all sessions after password reset', async ({ page }) => {
    console.log('=== Password Reset Session Invalidation Test ===');

    // Step 1: Login to create active session
    console.log('Step 1: Creating active session...');
    const loginResponse = await page.request.post('/api/auth/login', {
      data: {
        email: testEmail,
        password: testPassword,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(loginResponse.status()).toBe(200);
    const loginData = await loginResponse.json();
    const accessToken = loginData.token;
    console.log('✅ Active session created');

    // Step 2: Verify session is active
    console.log('Step 2: Verifying active session...');
    const meResponse1 = await page.request.get('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    expect(meResponse1.status()).toBe(200);
    console.log('✅ Session confirmed active');

    // Step 3: Initiate password reset
    console.log('Step 3: Initiating password reset...');
    const forgotPasswordResponse = await page.request.post('/api/auth/forgot-password', {
      data: {
        email: testEmail,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(forgotPasswordResponse.status()).toBe(200);
    console.log('✅ Password reset initiated');

    // Step 4: Wait for password reset email and extract token
    console.log('Step 4: Waiting for password reset email...');
    const resetToken = await waitForPasswordResetEmail(testEmail, 10000);
    expect(resetToken).toBeTruthy();
    console.log('✅ Password reset token extracted');

    // Step 5: Complete password reset
    console.log('Step 5: Completing password reset...');
    const resetPasswordResponse = await page.request.post('/api/auth/reset-password', {
      data: {
        token: resetToken,
        newPassword: newPassword,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(resetPasswordResponse.status()).toBe(200);
    const resetData = await resetPasswordResponse.json();
    expect(resetData.message).toContain('Password reset successful');
    console.log('✅ Password reset completed');

    // Step 6: Verify old session is now invalid
    console.log('Step 6: Testing old session after password reset...');
    const meResponse2 = await page.request.get('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`, // Using old access token
      },
    });

    expect(meResponse2.status()).toBe(401);
    const meData2 = await meResponse2.json();
    expect(meData2.error).toBeDefined();
    console.log('✅ Old session correctly invalidated after password reset');

    // Step 7: Verify old access token is invalid
    console.log('Step 7: Testing old access token...');
    const tokenTestResponse = await page.request.get('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${loginData.token}`,
      },
    });

    expect(tokenTestResponse.status()).toBe(401);
    console.log('✅ Old access token correctly invalidated');

    // Step 8: Verify new password works for login
    console.log('Step 8: Testing login with new password...');
    const newLoginResponse = await page.request.post('/api/auth/login', {
      data: {
        email: testEmail,
        password: newPassword,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(newLoginResponse.status()).toBe(200);
    const newLoginData = await newLoginResponse.json();
    expect(newLoginData.token).toBeDefined();
    expect(newLoginData.user).toBeDefined();
    console.log('✅ New password login successful');

    // Step 9: Verify new session works for protected routes
    console.log('Step 9: Testing new session...');
    const newAccessToken = newLoginData.token;
    const meResponse3 = await page.request.get('/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${newAccessToken}`,
      },
    });

    expect(meResponse3.status()).toBe(200);
    const meData3 = await meResponse3.json();
    expect(meData3.user.email).toBe(testEmail.toLowerCase());
    console.log('✅ New session correctly works for protected routes');

    console.log('🎉 Password reset session invalidation test completed successfully');
  });
});