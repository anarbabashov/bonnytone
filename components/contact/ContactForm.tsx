'use client'

import { useState, useCallback, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

function generateCaptcha() {
  const a = Math.floor(Math.random() * 10) + 1
  const b = Math.floor(Math.random() * 10) + 1
  return { a, b, answer: a + b }
}

export default function ContactForm() {
  const [captcha, setCaptcha] = useState<{ a: number; b: number; answer: number } | null>(null)

  useEffect(() => {
    setCaptcha(generateCaptcha())
  }, [])
  const [captchaInput, setCaptchaInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const refreshCaptcha = useCallback(() => {
    setCaptcha(generateCaptcha())
    setCaptchaInput('')
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setStatus('sending')
    setErrorMessage('')

    const form = e.currentTarget
    const formData = new FormData(form)
    const name = (formData.get('name') as string).trim()
    const email = (formData.get('email') as string).trim()
    const message = (formData.get('message') as string).trim()

    if (!captcha || parseInt(captchaInput, 10) !== captcha.answer) {
      setStatus('error')
      setErrorMessage('Incorrect captcha answer. Please try again.')
      refreshCaptcha()
      return
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          message,
          captchaA: captcha.a,
          captchaB: captcha.b,
          captchaAnswer: parseInt(captchaInput, 10),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send message')
      }

      setStatus('success')
      form.reset()
      setCaptchaInput('')
      refreshCaptcha()
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong')
      refreshCaptcha()
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded-lg border border-border/50 p-6 text-center space-y-2">
        <p className="font-medium text-foreground">Message sent!</p>
        <p className="text-sm text-muted-foreground">
          We&apos;ll get back to you within 48 hours.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setStatus('idle')}
          className="mt-4"
        >
          Send another message
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" style={{ maxWidth: '500px' }}>
      <div className="space-y-2">
        <Label htmlFor="name">Full Name</Label>
        <Input id="name" name="name" required placeholder="Your name" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          placeholder="your@email.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          name="message"
          required
          placeholder="How can we help?"
          rows={5}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="captcha">
          {captcha ? `What is ${captcha.a} + ${captcha.b}?` : 'Loading...'}
        </Label>
        <div className="flex items-center gap-2">
          <Input
            id="captcha"
            value={captchaInput}
            onChange={(e) => setCaptchaInput(e.target.value)}
            required
            placeholder="Your answer"
            className="w-32"
            inputMode="numeric"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={refreshCaptcha}
          >
            New question
          </Button>
        </div>
      </div>
      {status === 'error' && (
        <p className="text-sm text-red-500">{errorMessage}</p>
      )}
      <Button type="submit" disabled={status === 'sending'} className="w-full">
        {status === 'sending' ? 'Sending...' : 'Send Message'}
      </Button>
    </form>
  )
}
