import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/prisma';
import { promises as fs } from 'fs';
import path from 'path';

const MAILBOX_DIR = path.join(process.cwd(), '.mailbox');
const DEV_EMAIL_DIR = path.join(process.cwd(), 'tmp', 'emails');

async function cleanMailbox() {
  for (const dir of [MAILBOX_DIR, DEV_EMAIL_DIR]) {
    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        await fs.unlink(path.join(dir, file));
      }
    } catch {
      // Directory might not exist, that's OK
    }
  }
}

async function waitForVerificationEmail(email: string, timeout = 10000): Promise<{ token: string; filePath: string } | null> {
  const startTime = Date.now();
  const emailKey = email.replace('@', '_at_');

  while (Date.now() - startTime < timeout) {
    for (const dir of [MAILBOX_DIR, DEV_EMAIL_DIR]) {
      try {
        const files = await fs.readdir(dir);
        const matchingFile = files.find(f =>
          f.endsWith('.eml') && (f.includes(emailKey) || f.includes('verification'))
        );

        if (matchingFile) {
          const filePath = path.join(dir, matchingFile);
          const content = await fs.readFile(filePath, 'utf-8');
          // Extract verification token from link
          const match = content.match(/\/auth\/verify-email\?token=([a-zA-Z0-9_-]+)/);
          if (match) {
            return { token: match[1], filePath };
          }
        }
      } catch {
        // Directory might not exist yet
      }
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return null;
}

test.describe.serial('Smoke: Register → Verify → Login', () => {
  const testEmail = `smoke-reg-${Date.now()}@example.com`;
  const testPassword = 'SmokeTest123!';
  const testDisplayName = 'Smoke Register User';

  test.beforeAll(async () => {
    process.env.EMAIL_PROVIDER = 'dev';
    await cleanMailbox();
  });

  test.afterAll(async () => {
    // Clean up test user
    await prisma.user.deleteMany({
      where: { email: testEmail.toLowerCase() },
    }).catch(() => {});
    await cleanMailbox();
  });

  test('register new account via UI', async ({ page }) => {
    await page.goto('/auth/register');

    // Fill registration form
    await page.locator('#email').fill(testEmail);
    await page.locator('#displayName').fill(testDisplayName);
    await page.locator('#password').fill(testPassword);
    await page.locator('#confirmPassword').fill(testPassword);

    // Verify password validation indicators turn green
    await expect(page.locator('text=8-128 characters')).toHaveClass(/text-green-600/);
    await expect(page.locator('text=Upper & lowercase letters')).toHaveClass(/text-green-600/);
    await expect(page.locator('text=At least one number')).toHaveClass(/text-green-600/);
    await expect(page.locator('text=Special character')).toHaveClass(/text-green-600/);

    // Submit
    await page.locator('button[type="submit"]').click();

    // Should show "Check Your Email" success message
    await expect(page.locator('text=Check Your Email')).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${testEmail}`)).toBeVisible();
  });

  test('verification email is sent and contains token', async () => {
    const result = await waitForVerificationEmail(testEmail);
    expect(result).toBeTruthy();
    expect(result!.token).toBeTruthy();
  });

  test('verify email via verification link', async ({ page }) => {
    const result = await waitForVerificationEmail(testEmail);
    expect(result).toBeTruthy();

    // Navigate to verification URL
    await page.goto(`/auth/verify-email?token=${result!.token}`);

    // Should show "Email Verified!" success message
    await expect(page.locator('text=Email Verified!')).toBeVisible({ timeout: 10000 });
  });

  test('login with newly verified account', async ({ page }) => {
    await page.goto('/auth/login');

    // Fill login form
    await page.locator('#email').fill(testEmail);
    await page.locator('#password').fill(testPassword);

    // Submit
    await page.locator('button[type="submit"]').click();

    // Should redirect to home with welcome message
    await expect(page).toHaveURL('/', { timeout: 10000 });
    await expect(page.locator(`text=Welcome, ${testDisplayName}`)).toBeVisible({ timeout: 5000 });
  });
});
