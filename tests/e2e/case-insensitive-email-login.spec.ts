import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/crypto';

test.describe.serial('Case-Insensitive Email Login Flow', () => {
  const baseEmail = `casetest${Date.now()}${Math.random().toString(36).substring(7)}@example.com`;
  const testPassword = 'TestPassword123!';
  let userId: string;

  test.beforeAll(async () => {
    // Create a verified user in the database with lowercase email
    const passwordHash = await hashPassword(testPassword);

    const user = await prisma.user.create({
      data: {
        email: baseEmail.toLowerCase(), // Store in lowercase
        displayName: 'Case Test User',
        passwordHash,
        emailVerifiedAt: new Date(),
        isBlocked: false,
      },
    });

    userId = user.id;
    console.log(`✅ Created test user with email: ${baseEmail.toLowerCase()}`);
  });

  test.afterAll(async () => {
    // Clean up: delete the test user
    if (userId) {
      await prisma.user.delete({
        where: { id: userId },
      }).catch(() => {
        // Ignore errors if user doesn't exist
      });
      console.log('✅ Cleaned up test user');
    }
  });

  test('should login with original lowercase email', async ({ page }) => {
    console.log('Step 1: Testing login with original lowercase email...');

    const response = await page.request.post('/api/auth/login', {
      data: {
        email: baseEmail.toLowerCase(),
        password: testPassword,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(response.status()).toBe(200);

    const responseData = await response.json();
    expect(responseData.token).toBeDefined();
    expect(responseData.user).toBeDefined();
    expect(responseData.user.email).toBe(baseEmail.toLowerCase());

    console.log('✅ Login with lowercase email successful');
  });

  test('should login with uppercase email variant', async ({ page }) => {
    console.log('Step 2: Testing login with uppercase email...');

    const response = await page.request.post('/api/auth/login', {
      data: {
        email: baseEmail.toUpperCase(),
        password: testPassword,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(response.status()).toBe(200);

    const responseData = await response.json();
    expect(responseData.token).toBeDefined();
    expect(responseData.user).toBeDefined();
    expect(responseData.user.email).toBe(baseEmail.toLowerCase()); // Should return stored lowercase version

    console.log('✅ Login with uppercase email successful');
  });

  test('should login with mixed case email variant', async ({ page }) => {
    console.log('Step 3: Testing login with mixed case email...');

    // Create a mixed case version (first letter uppercase, rest mixed)
    const mixedCaseEmail = baseEmail.charAt(0).toUpperCase() +
      baseEmail.slice(1, baseEmail.indexOf('@')).split('').map((char, i) =>
        i % 2 === 0 ? char.toUpperCase() : char.toLowerCase()
      ).join('') + baseEmail.slice(baseEmail.indexOf('@'));

    console.log(`Testing with mixed case email: ${mixedCaseEmail}`);

    const response = await page.request.post('/api/auth/login', {
      data: {
        email: mixedCaseEmail,
        password: testPassword,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(response.status()).toBe(200);

    const responseData = await response.json();
    expect(responseData.token).toBeDefined();
    expect(responseData.user).toBeDefined();
    expect(responseData.user.email).toBe(baseEmail.toLowerCase()); // Should return stored lowercase version

    console.log('✅ Login with mixed case email successful');
  });

  test('should login with domain case variations', async ({ page }) => {
    console.log('Step 4: Testing login with domain case variations...');

    // Test with uppercase domain
    const [localPart, domain] = baseEmail.split('@');
    const upperDomainEmail = `${localPart}@${domain.toUpperCase()}`;

    console.log(`Testing with uppercase domain: ${upperDomainEmail}`);

    const response = await page.request.post('/api/auth/login', {
      data: {
        email: upperDomainEmail,
        password: testPassword,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(response.status()).toBe(200);

    const responseData = await response.json();
    expect(responseData.token).toBeDefined();
    expect(responseData.user).toBeDefined();
    expect(responseData.user.email).toBe(baseEmail.toLowerCase());

    console.log('✅ Login with uppercase domain successful');
  });

  test('should handle completely uppercase email', async ({ page }) => {
    console.log('Step 5: Testing login with completely uppercase email...');

    const response = await page.request.post('/api/auth/login', {
      data: {
        email: baseEmail.toUpperCase(),
        password: testPassword,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(response.status()).toBe(200);

    const responseData = await response.json();
    expect(responseData.token).toBeDefined();
    expect(responseData.user).toBeDefined();
    expect(responseData.user.email).toBe(baseEmail.toLowerCase());

    console.log('✅ Login with completely uppercase email successful');
  });

  test('should fail with wrong password regardless of case', async ({ page }) => {
    console.log('Step 6: Testing that wrong password still fails with case variants...');

    const response = await page.request.post('/api/auth/login', {
      data: {
        email: baseEmail.toUpperCase(), // Different case but wrong password
        password: 'WrongPassword123!',
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    expect(response.status()).toBe(401);

    const responseData = await response.json();
    expect(responseData.error).toBe('Invalid email or password');
    expect(responseData.token).toBeUndefined();
    expect(responseData.user).toBeUndefined();

    console.log('✅ Wrong password correctly rejected with case variant email');
  });
});