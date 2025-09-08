import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const DEV_MAILBOX_DIR = path.join(process.cwd(), '.mailbox')

export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const filename = searchParams.get('file')

  if (!filename) {
    return NextResponse.json({ error: 'File parameter required' }, { status: 400 })
  }

  try {
    const filepath = path.join(DEV_MAILBOX_DIR, filename)
    const content = await fs.readFile(filepath, 'utf-8')
    
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'message/rfc822',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 })
  }
}