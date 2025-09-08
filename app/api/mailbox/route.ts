import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const DEV_MAILBOX_DIR = path.join(process.cwd(), '.mailbox')

interface EmailFile {
  filename: string
  timestamp: string
  template: string
  recipient: string
  subject: string
  content: string
  size: string
}

function parseEmailFile(filename: string, content: string): EmailFile {
  const lines = content.split('\n')
  
  // Parse headers
  let subject = ''
  let recipient = ''
  let date = ''
  let htmlContent = ''
  
  let inHtmlSection = false
  let headersParsed = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    if (!headersParsed) {
      if (line.startsWith('Subject: ')) {
        subject = line.substring(9).trim()
      } else if (line.startsWith('To: ')) {
        recipient = line.substring(4).trim()
      } else if (line.startsWith('Date: ')) {
        date = line.substring(6).trim()
      } else if (line === '') {
        headersParsed = true
      }
    } else {
      if (line === 'Content-Type: text/html; charset=UTF-8') {
        inHtmlSection = true
        continue
      }
      
      if (inHtmlSection && !line.startsWith('--boundary')) {
        if (line === '') {
          // Start collecting HTML content after empty line
          htmlContent = lines.slice(i + 1).join('\n')
          // Stop at boundary
          const boundaryIndex = htmlContent.indexOf('\n--boundary123--')
          if (boundaryIndex > 0) {
            htmlContent = htmlContent.substring(0, boundaryIndex).trim()
          }
          break
        }
      }
    }
  }
  
  // Extract template and timestamp from filename
  // Format: 2024-01-01T12-00-00-000Z-verify_email-user_at_example_com.eml
  const parts = filename.replace('.eml', '').split('-')
  let template = 'unknown'
  
  // Find template part (after timestamp)
  for (let i = 5; i < parts.length; i++) {
    if (parts[i] && !parts[i].includes('_at_')) {
      template = parts[i]
      break
    }
  }
  
  // Parse timestamp from filename
  const timestampStr = parts.slice(0, 5).join('-').replace(/-/g, ':').replace(/T/, 'T').replace(/Z$/, 'Z')
  let formattedDate = date
  try {
    const parsedDate = new Date(timestampStr.replace(/:/g, '-').replace('T', 'T').replace('Z', 'Z'))
    if (!isNaN(parsedDate.getTime())) {
      formattedDate = parsedDate.toLocaleString()
    }
  } catch {
    // Keep original date
  }
  
  return {
    filename,
    timestamp: formattedDate || new Date().toLocaleString(),
    template,
    recipient,
    subject,
    content: htmlContent,
    size: `${Math.round(content.length / 1024)}KB`,
  }
}

export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const filename = searchParams.get('file')

  try {
    // Check if directory exists
    try {
      await fs.access(DEV_MAILBOX_DIR)
    } catch {
      return NextResponse.json({ emails: [] })
    }

    if (filename) {
      // Return specific file content
      const filepath = path.join(DEV_MAILBOX_DIR, filename)
      try {
        const content = await fs.readFile(filepath, 'utf-8')
        const emailData = parseEmailFile(filename, content)
        return NextResponse.json(emailData)
      } catch {
        return NextResponse.json({ error: 'Email not found' }, { status: 404 })
      }
    }

    // Return list of emails
    const files = await fs.readdir(DEV_MAILBOX_DIR)
    const emailFiles = files.filter(file => file.endsWith('.eml'))

    const emails: EmailFile[] = []
    
    for (const file of emailFiles) {
      try {
        const filepath = path.join(DEV_MAILBOX_DIR, file)
        const content = await fs.readFile(filepath, 'utf-8')
        const emailData = parseEmailFile(file, content)
        emails.push(emailData)
      } catch (error) {
        console.error(`Error parsing email file ${file}:`, error)
      }
    }

    // Sort by filename (which includes timestamp) descending
    emails.sort((a, b) => b.filename.localeCompare(a.filename))

    return NextResponse.json({ emails })

  } catch (error) {
    console.error('Mailbox error:', error)
    return NextResponse.json(
      { error: 'Failed to read mailbox' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const filename = searchParams.get('file')

  try {
    if (filename) {
      // Delete specific file
      const filepath = path.join(DEV_MAILBOX_DIR, filename)
      try {
        await fs.unlink(filepath)
        return NextResponse.json({ message: 'Email deleted' })
      } catch {
        return NextResponse.json({ error: 'Email not found' }, { status: 404 })
      }
    } else {
      // Clear all emails
      try {
        const files = await fs.readdir(DEV_MAILBOX_DIR)
        const emailFiles = files.filter(file => file.endsWith('.eml'))
        
        for (const file of emailFiles) {
          await fs.unlink(path.join(DEV_MAILBOX_DIR, file))
        }
        
        return NextResponse.json({ message: `Cleared ${emailFiles.length} emails` })
      } catch {
        // Directory might not exist
        return NextResponse.json({ message: 'No emails to clear' })
      }
    }
  } catch (error) {
    console.error('Mailbox delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete emails' },
      { status: 500 }
    )
  }
}