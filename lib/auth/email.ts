import { promises as fs } from 'fs'
import path from 'path'
import { Client as PostmarkClient } from 'postmark'

const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'dev'
const EMAIL_FROM = process.env.EMAIL_FROM || 'ArtistMgmt <no-reply@artistmgmt.org>'

// Email template types
export type TemplateId =
  | 'verify_email'
  | 'password_reset'
  | 'email_change_confirm'
  | 'email_changed_notification'
  | 'login_alert'

// Postmark client
const postmark = EMAIL_PROVIDER === 'postmark' 
  ? new PostmarkClient(process.env.POSTMARK_TOKEN || '')
  : null

// Postmark template IDs mapping
const POSTMARK_TEMPLATES: Record<TemplateId, string> = {
  verify_email: process.env.POSTMARK_TEMPLATE_VERIFY_EMAIL || 'verify-email-template',
  password_reset: process.env.POSTMARK_TEMPLATE_PASSWORD_RESET || 'password-reset-template',
  email_change_confirm: process.env.POSTMARK_TEMPLATE_EMAIL_CHANGE_CONFIRM || 'email-change-confirm-template',
  email_changed_notification: process.env.POSTMARK_TEMPLATE_EMAIL_CHANGED || 'email-changed-notification-template',
  login_alert: process.env.POSTMARK_TEMPLATE_LOGIN_ALERT || 'login-alert-template',
}

// Dev mailbox directory
const DEV_MAILBOX_DIR = path.join(process.cwd(), '.mailbox')

// Ensure dev mailbox directory exists
async function ensureMailboxDir(): Promise<void> {
  try {
    await fs.access(DEV_MAILBOX_DIR)
  } catch {
    await fs.mkdir(DEV_MAILBOX_DIR, { recursive: true })
  }
}

// Generate email content from template and data
function generateEmailContent(templateId: TemplateId, data: Record<string, any>, appUrl: string): { subject: string; html: string; text: string } {
  switch (templateId) {
    case 'verify_email':
      const verifyUrl = `${appUrl}/auth/verify-email?token=${data.token}`
      return {
        subject: 'Verify your email address - ArtistMgmt',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify Your Email</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #2563eb;">Verify your email address</h1>
              <p>Welcome to ArtistMgmt, ${data.displayName || 'there'}!</p>
              <p>Please click the button below to verify your email address:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verifyUrl}" 
                   style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  Verify Email Address
                </a>
              </div>
              <p style="color: #666; font-size: 14px;">
                If you didn't create an account, you can safely ignore this email.<br>
                This link will expire in 24 hours.
              </p>
              <p style="color: #666; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
                If the button doesn't work, copy and paste this link:<br>
                <a href="${verifyUrl}">${verifyUrl}</a>
              </p>
            </div>
          </body>
          </html>
        `,
        text: `
Verify your email address

Welcome to ArtistMgmt, ${data.displayName || 'there'}!

Please visit the link below to verify your email address:
${verifyUrl}

If you didn't create an account, you can safely ignore this email.
This link will expire in 24 hours.
        `.trim(),
      }

    case 'password_reset':
      const resetUrl = `${appUrl}/auth/reset-password?token=${data.token}`
      return {
        subject: 'Reset your password - ArtistMgmt',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Password</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #dc2626;">Reset your password</h1>
              <p>Someone requested a password reset for your ArtistMgmt account.</p>
              <p>Click the button below to reset your password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" 
                   style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  Reset Password
                </a>
              </div>
              <p style="color: #666; font-size: 14px;">
                If you didn't request this, you can safely ignore this email.<br>
                This link will expire in 30 minutes.
              </p>
              <p style="color: #666; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
                If the button doesn't work, copy and paste this link:<br>
                <a href="${resetUrl}">${resetUrl}</a>
              </p>
            </div>
          </body>
          </html>
        `,
        text: `
Reset your password

Someone requested a password reset for your ArtistMgmt account.

Visit the link below to reset your password:
${resetUrl}

If you didn't request this, you can safely ignore this email.
This link will expire in 30 minutes.
        `.trim(),
      }

    case 'email_change_confirm':
      const confirmUrl = `${appUrl}/account/change-email/confirm?token=${data.token}`
      return {
        subject: 'Confirm your new email address - ArtistMgmt',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Confirm Email Change</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #2563eb;">Confirm your new email address</h1>
              <p>You requested to change your ArtistMgmt account email from <strong>${data.oldEmail}</strong> to <strong>${data.newEmail}</strong>.</p>
              <p>Click the button below to confirm this change:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${confirmUrl}" 
                   style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                  Confirm Email Change
                </a>
              </div>
              <p style="color: #666; font-size: 14px;">
                If you didn't request this change, you can safely ignore this email.<br>
                This link will expire in 24 hours.
              </p>
            </div>
          </body>
          </html>
        `,
        text: `
Confirm your new email address

You requested to change your ArtistMgmt account email from ${data.oldEmail} to ${data.newEmail}.

Visit the link below to confirm this change:
${confirmUrl}

If you didn't request this change, you can safely ignore this email.
This link will expire in 24 hours.
        `.trim(),
      }

    case 'email_changed_notification':
      return {
        subject: 'Email address changed - ArtistMgmt',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Changed</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #059669;">Email address changed</h1>
              <p>Your ArtistMgmt account email address has been successfully changed from <strong>${data.oldEmail}</strong> to <strong>${data.newEmail}</strong>.</p>
              <p style="color: #666; font-size: 14px;">
                This change was made on ${new Date().toLocaleString()}.<br>
                If you didn't make this change, please contact support immediately.
              </p>
            </div>
          </body>
          </html>
        `,
        text: `
Email address changed

Your ArtistMgmt account email address has been successfully changed from ${data.oldEmail} to ${data.newEmail}.

This change was made on ${new Date().toLocaleString()}.
If you didn't make this change, please contact support immediately.
        `.trim(),
      }

    case 'login_alert':
      return {
        subject: 'New login to your account - ArtistMgmt',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Login Alert</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #ea580c;">New login detected</h1>
              <p>Someone signed in to your ArtistMgmt account.</p>
              <div style="background-color: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                <p style="margin: 5px 0;"><strong>IP Address:</strong> ${data.ip || 'Unknown'}</p>
                <p style="margin: 5px 0;"><strong>Device:</strong> ${data.userAgent || 'Unknown'}</p>
                <p style="margin: 5px 0;"><strong>Location:</strong> ${data.location || 'Unknown'}</p>
              </div>
              <p style="color: #666; font-size: 14px;">
                If this was you, you can ignore this email. If not, please secure your account immediately by changing your password.
              </p>
            </div>
          </body>
          </html>
        `,
        text: `
New login detected

Someone signed in to your ArtistMgmt account.

Details:
- Time: ${new Date().toLocaleString()}
- IP Address: ${data.ip || 'Unknown'}
- Device: ${data.userAgent || 'Unknown'}
- Location: ${data.location || 'Unknown'}

If this was you, you can ignore this email. If not, please secure your account immediately by changing your password.
        `.trim(),
      }

    default:
      throw new Error(`Unknown template: ${templateId}`)
  }
}

// Template-based email sending
export async function sendEmail(tpl: TemplateId, to: string, data: Record<string, any>, appUrl?: string): Promise<boolean> {
  try {
    // Use provided appUrl or fallback to environment variable or localhost
    const baseUrl = appUrl || process.env.APP_URL || 'http://localhost:3000'

    switch (EMAIL_PROVIDER) {
      case 'postmark':
        if (!postmark) throw new Error('Postmark client not configured')

        const templateAlias = POSTMARK_TEMPLATES[tpl]
        await postmark.sendEmailWithTemplate({
          From: EMAIL_FROM,
          To: to,
          TemplateAlias: templateAlias,
          TemplateModel: {
            ...data,
            app_url: baseUrl,
            app_name: 'ArtistMgmt',
          },
        })
        return true

      case 'dev':
        await ensureMailboxDir()

        const emailContent = generateEmailContent(tpl, data, baseUrl)
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const filename = `${timestamp}-${tpl}-${to.replace('@', '_at_')}.eml`
        const filepath = path.join(DEV_MAILBOX_DIR, filename)
        
        // Create EML format
        const emlContent = [
          `From: ${EMAIL_FROM}`,
          `To: ${to}`,
          `Subject: ${emailContent.subject}`,
          `Date: ${new Date().toUTCString()}`,
          `Content-Type: multipart/alternative; boundary="boundary123"`,
          '',
          '--boundary123',
          'Content-Type: text/plain; charset=UTF-8',
          '',
          emailContent.text,
          '',
          '--boundary123',
          'Content-Type: text/html; charset=UTF-8',
          '',
          emailContent.html,
          '',
          '--boundary123--',
        ].join('\n')
        
        await fs.writeFile(filepath, emlContent)
        console.log(`📧 Dev email saved: ${filename}`)
        return true

      default:
        console.error(`Unsupported email provider: ${EMAIL_PROVIDER}`)
        return false
    }
  } catch (error) {
    console.error('Email send error:', error)
    return false
  }
}

// Legacy functions for backward compatibility
export function createVerificationEmail(email: string, token: string, appUrl?: string) {
  const baseUrl = appUrl || process.env.APP_URL || 'http://localhost:3000'
  return {
    to: email,
    subject: 'Verify your email address',
    html: generateEmailContent('verify_email', { token }, baseUrl).html,
    text: generateEmailContent('verify_email', { token }, baseUrl).text,
  }
}

export function createPasswordResetEmail(email: string, token: string, appUrl?: string) {
  const baseUrl = appUrl || process.env.APP_URL || 'http://localhost:3000'
  return {
    to: email,
    subject: 'Reset your password',
    html: generateEmailContent('password_reset', { token }, baseUrl).html,
    text: generateEmailContent('password_reset', { token }, baseUrl).text,
  }
}

export function createEmailChangeEmail(email: string, newEmail: string, token: string, appUrl?: string) {
  const baseUrl = appUrl || process.env.APP_URL || 'http://localhost:3000'
  return {
    to: newEmail,
    subject: 'Confirm your new email address',
    html: generateEmailContent('email_change_confirm', { oldEmail: email, newEmail, token }, baseUrl).html,
    text: generateEmailContent('email_change_confirm', { oldEmail: email, newEmail, token }, baseUrl).text,
  }
}