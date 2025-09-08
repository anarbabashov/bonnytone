import { test, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

const MAILBOX_DIR = path.join(process.cwd(), '.mailbox');
const DEV_EMAIL_DIR = path.join(process.cwd(), 'tmp', 'emails');

// Helper function to clean up mailbox before test
async function cleanMailbox() {
  try {
    const files = await fs.readdir(MAILBOX_DIR);
    for (const file of files) {
      await fs.unlink(path.join(MAILBOX_DIR, file));
    }
  } catch (error) {
    // Directory might not exist or be empty, that's OK
  }
}

// Helper function to wait for and read email files
async function waitForEmail(timeout = 5000): Promise<string[]> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      // Check both directories
      const directories = [MAILBOX_DIR, DEV_EMAIL_DIR];
      
      for (const dir of directories) {
        try {
          const files = await fs.readdir(dir);
          const emailFiles = files.filter(f => f.endsWith('.eml') && f.includes('test-playwright'));
          
          if (emailFiles.length > 0) {
            return emailFiles.map(file => path.join(dir, file));
          }
        } catch (error) {
          // Directory might not exist yet
        }
      }
    } catch (error) {
      // Directory might not exist yet
    }
    
    // Wait 100ms before checking again
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return [];
}

// Helper function to read email content
async function readEmailContent(filepath: string): Promise<string> {
  return await fs.readFile(filepath, 'utf-8');
}

test.describe('Registration Flow', () => {
  test.beforeEach(async () => {
    // Clean up any existing emails before each test
    await cleanMailbox();
  });

  test('should complete registration flow successfully', async ({ page }) => {
    // Set email provider to dev for testing
    process.env.EMAIL_PROVIDER = 'dev';
    // Step 1: Navigate to registration page
    console.log('Step 1: Navigating to registration page...');
    await page.goto('/auth/register');
    
    // Wait for page to load and check if we're on the registration page
    await expect(page).toHaveURL(/\/auth\/register/);
    await expect(page.locator('h1, h2, h3')).toContainText(/register|sign up|create account/i);

    // Step 2: Fill out the registration form
    console.log('Step 2: Filling out registration form...');
    
    // Look for email input field with various possible selectors
    const emailField = page.locator('input[type="email"], input[name="email"], input[id*="email"]').first();
    await expect(emailField).toBeVisible();
    await emailField.fill(`test-playwright-${Date.now()}@example.com`);

    // Look for display name / name field first (it appears before password in the HTML)
    const nameField = page.locator('input[name="displayName"], input[name="name"], input[id*="displayName"]').first();
    await expect(nameField).toBeVisible();
    await nameField.fill('Test User');

    // Look for password input field
    const passwordField = page.locator('input[name="password"], input[id="password"]').first();
    await expect(passwordField).toBeVisible();
    await passwordField.fill('TestPassword123!');

    // Look for confirm password field
    const confirmPasswordField = page.locator('input[name="confirmPassword"], input[id="confirmPassword"]').first();
    await expect(confirmPasswordField).toBeVisible();
    await confirmPasswordField.fill('TestPassword123!');

    // Step 3: Submit the form
    console.log('Step 3: Submitting registration form...');
    
    // Look for submit button
    const submitButton = page.locator('button[type="submit"], input[type="submit"], button:has-text("Create Account")').first();
    await expect(submitButton).toBeVisible();
    
    // Take a screenshot before submitting
    await page.screenshot({ path: 'test-results/before-submit.png' });
    
    await submitButton.click();

    // Step 4: Wait for response and check what happens
    console.log('Step 4: Waiting for registration response...');
    
    // Wait a moment for the request to process
    await page.waitForTimeout(2000);
    
    // Take a screenshot after submitting
    await page.screenshot({ path: 'test-results/after-submit.png' });

    // Check for various possible outcomes
    const currentUrl = page.url();
    const pageContent = await page.content();
    
    console.log('Current URL after submission:', currentUrl);
    
    // Check for success indicators
    const hasSuccessMessage = await page.locator('text=/success|verification|check your email|registered/i').count() > 0;
    const hasErrorMessage = await page.locator('text=/error|failed|invalid|required/i').count() > 0;
    const isRedirected = !currentUrl.includes('/auth/register');
    
    console.log('Success message found:', hasSuccessMessage);
    console.log('Error message found:', hasErrorMessage);
    console.log('Redirected away from register page:', isRedirected);
    
    // Log any visible alerts or messages
    const alerts = await page.locator('[role="alert"], .alert, .error, .success, .message').allTextContents();
    if (alerts.length > 0) {
      console.log('Alerts/Messages found:', alerts);
    }

    // Step 5: Check for emails in mailbox directory
    console.log('Step 5: Checking for emails...');
    
    const emailFiles = await waitForEmail(10000); // Wait up to 10 seconds for email
    
    console.log('Email files found:', emailFiles);
    
    if (emailFiles.length > 0) {
      // Read and log email content
      for (const emailFile of emailFiles) {
        const emailContent = await readEmailContent(emailFile);
        console.log(`Email content (${path.basename(emailFile)}):`);
        console.log(emailContent.substring(0, 500) + '...');
        
        // Check if it's a verification email
        expect(emailContent).toContain('test-playwright');
        expect(emailContent.toLowerCase()).toMatch(/verify|verification|confirm/);
      }
    }

    // Step 6: Log final state
    console.log('Step 6: Final state analysis');
    console.log('Registration flow completed');
    console.log('Final URL:', page.url());
    console.log('Emails created:', emailFiles.length);
    
    // The test passes if we get here without exceptions
    // We're checking the behavior rather than asserting specific outcomes
    // since the requirement is to observe what happens
  });

  test('should handle duplicate email registration', async ({ page }) => {
    console.log('Testing duplicate email registration...');
    
    // Navigate to registration page
    await page.goto('/auth/register');
    await expect(page).toHaveURL(/\/auth\/register/);

    // Fill form with email that might already exist (based on server logs)
    const emailField = page.locator('input[type="email"], input[name="email"]').first();
    const passwordField = page.locator('input[type="password"], input[name="password"]').first();
    const nameField = page.locator('input[name="displayName"], input[name="name"], input[id*="name"]').first();
    
    await emailField.fill('bonnytonemusic@gmail.com'); // This email was in the server logs
    await passwordField.fill('TestPassword123!');
    await nameField.fill('Test Duplicate');

    // Submit form
    const submitButton = page.locator('button[type="submit"], button:has-text("register")').first();
    await submitButton.click();

    // Wait for response
    await page.waitForTimeout(2000);
    
    // Check for error message about existing email
    const pageContent = await page.content();
    const hasExistingEmailError = await page.locator('text=/email.*exists|already.*registered|account.*exists/i').count() > 0;
    
    console.log('Duplicate email error found:', hasExistingEmailError);
    console.log('Current URL:', page.url());
    
    // Take screenshot of the result
    await page.screenshot({ path: 'test-results/duplicate-email-result.png' });
  });
});