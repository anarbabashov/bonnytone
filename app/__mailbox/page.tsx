'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trash2, RefreshCw, Mail, ExternalLink } from 'lucide-react'

interface EmailFile {
  filename: string
  timestamp: string
  template: string
  recipient: string
  subject: string
  content: string
  size: string
}

export default function MailboxPage() {
  const [emails, setEmails] = useState<EmailFile[]>([])
  const [selectedEmail, setSelectedEmail] = useState<EmailFile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEmails = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/mailbox')
      if (!response.ok) {
        throw new Error('Failed to fetch emails')
      }
      const data = await response.json()
      setEmails(data.emails || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const clearAllEmails = async () => {
    try {
      const response = await fetch('/api/mailbox', { method: 'DELETE' })
      if (!response.ok) {
        throw new Error('Failed to clear emails')
      }
      await fetchEmails()
      setSelectedEmail(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear emails')
    }
  }

  const deleteEmail = async (filename: string) => {
    try {
      const response = await fetch(`/api/mailbox?file=${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        throw new Error('Failed to delete email')
      }
      await fetchEmails()
      if (selectedEmail?.filename === filename) {
        setSelectedEmail(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete email')
    }
  }

  useEffect(() => {
    fetchEmails()
  }, [])

  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Dev Mailbox</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This mailbox is only available in development mode.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Dev Mailbox</h1>
        <p className="text-muted-foreground mt-2">
          Preview emails sent during development
        </p>
      </div>

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Email List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Emails ({emails.length})
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchEmails}
                    disabled={loading}
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={clearAllEmails}
                    disabled={emails.length === 0}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Loading emails...
                </div>
              ) : emails.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No emails found
                </div>
              ) : (
                <div className="space-y-0">
                  {emails.map((email) => (
                    <div
                      key={email.filename}
                      className={`p-4 cursor-pointer hover:bg-muted/50 border-b last:border-b-0 ${
                        selectedEmail?.filename === email.filename ? 'bg-muted' : ''
                      }`}
                      onClick={() => setSelectedEmail(email)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="text-xs">
                              {email.template}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {email.size}
                            </span>
                          </div>
                          <p className="font-medium text-sm truncate">
                            {email.subject}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            To: {email.recipient}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {email.timestamp}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteEmail(email.filename)
                          }}
                          className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Email Preview */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              {selectedEmail ? (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{selectedEmail.subject}</CardTitle>
                      <CardDescription>
                        From: ArtistMgmt | To: {selectedEmail.recipient}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">
                        {selectedEmail.template}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <a
                          href={`/api/mailbox/raw?file=${encodeURIComponent(selectedEmail.filename)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedEmail.timestamp} • {selectedEmail.size}
                  </div>
                </>
              ) : (
                <CardTitle>Select an email to preview</CardTitle>
              )}
            </CardHeader>
            <CardContent className="h-full">
              {selectedEmail ? (
                <div className="border rounded-lg overflow-hidden h-full">
                  <iframe
                    srcDoc={selectedEmail.content}
                    className="w-full h-full min-h-[400px]"
                    title="Email preview"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  <div className="text-center">
                    <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select an email from the list to preview it here</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}