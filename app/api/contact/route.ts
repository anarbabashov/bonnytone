import { NextResponse } from 'next/server'
import { Client as PostmarkClient } from 'postmark'
import { promises as fs } from 'fs'
import path from 'path'

const CONTACT_EMAIL = 'bonnytonemusic@gmail.com'
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'dev'
const EMAIL_FROM = process.env.EMAIL_FROM || 'Bonnytone <no-reply@bonnytone.org>'

const postmark =
  EMAIL_PROVIDER === 'postmark'
    ? new PostmarkClient(process.env.POSTMARK_TOKEN || '')
    : null

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, message, captchaA, captchaB, captchaAnswer } = body

    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }
    if (typeof name !== 'string' || name.length > 200) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
    }
    if (typeof email !== 'string' || !email.includes('@') || email.length > 320) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }
    if (typeof message !== 'string' || message.length > 5000) {
      return NextResponse.json(
        { error: 'Message is too long (max 5000 characters)' },
        { status: 400 }
      )
    }

    // Verify captcha
    if (
      typeof captchaA !== 'number' ||
      typeof captchaB !== 'number' ||
      typeof captchaAnswer !== 'number' ||
      captchaA < 1 || captchaA > 10 ||
      captchaB < 1 || captchaB > 10
    ) {
      return NextResponse.json({ error: 'Invalid captcha' }, { status: 400 })
    }
    if (captchaA + captchaB !== captchaAnswer) {
      return NextResponse.json(
        { error: 'Incorrect captcha answer' },
        { status: 400 }
      )
    }

    const subject = `Contact Form: ${name}`
    const textBody = `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
    const htmlBody = `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <hr>
      <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
    `

    if (EMAIL_PROVIDER === 'postmark' && postmark) {
      await postmark.sendEmail({
        From: EMAIL_FROM,
        To: CONTACT_EMAIL,
        ReplyTo: email,
        Subject: subject,
        TextBody: textBody,
        HtmlBody: htmlBody,
      })
    } else {
      // Dev mode: save to .mailbox
      const mailboxDir = path.join(process.cwd(), '.mailbox')
      try {
        await fs.access(mailboxDir)
      } catch {
        await fs.mkdir(mailboxDir, { recursive: true })
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `${timestamp}-contact-${email.replace('@', '_at_')}.eml`
      const emlContent = [
        `From: ${EMAIL_FROM}`,
        `To: ${CONTACT_EMAIL}`,
        `Reply-To: ${email}`,
        `Subject: ${subject}`,
        `Date: ${new Date().toUTCString()}`,
        `Content-Type: text/html; charset=UTF-8`,
        '',
        htmlBody,
      ].join('\n')
      await fs.writeFile(path.join(mailboxDir, filename), emlContent)
      console.log(`📧 Contact form saved: ${filename}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Contact form error:', error)
    return NextResponse.json(
      { error: 'Failed to send message. Please try again later.' },
      { status: 500 }
    )
  }
}
