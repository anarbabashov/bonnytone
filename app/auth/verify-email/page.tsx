'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react'

export default function VerifyEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'resend'>('loading')
  const [message, setMessage] = useState('')
  const [resending, setResending] = useState(false)

  const verifyEmail = useCallback(async (token: string) => {
    try {
      const response = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
        method: 'GET'
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 410) {
          setStatus('resend')
          setMessage('Your verification link has expired. Please request a new one.')
        } else {
          setStatus('error')
          setMessage(data.error || 'Email verification failed')
        }
        return
      }

      setStatus('success')
      setMessage('Your email has been successfully verified!')
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/auth/login')
      }, 3000)

    } catch (err) {
      setStatus('error')
      setMessage('Network error. Please check your connection and try again.')
    }
  }, [router])

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No verification token provided')
      return
    }

    verifyEmail(token)
  }, [token, verifyEmail])

  const handleResendVerification = async () => {
    const email = searchParams.get('email')
    if (!email) {
      setMessage('Email address not found. Please try registering again.')
      return
    }

    setResending(true)
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend verification email')
      }

      setStatus('success')
      setMessage('A new verification email has been sent to your inbox.')

    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to resend verification email')
    } finally {
      setResending(false)
    }
  }

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
              </div>
              <CardTitle className="text-2xl font-bold">Verifying Email</CardTitle>
              <CardDescription>
                Please wait while we verify your email address...
              </CardDescription>
            </CardHeader>
          </Card>
        )

      case 'success':
        return (
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <CardTitle className="text-2xl font-bold text-green-600">Email Verified!</CardTitle>
              <CardDescription>
                {message}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600 text-center">
                You will be automatically redirected to the login page in a few seconds.
              </p>
              <div className="text-center">
                <Link href="/auth/login">
                  <Button className="w-full">
                    Continue to Sign In
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )

      case 'resend':
        return (
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <Mail className="w-6 h-6 text-orange-600" />
              </div>
              <CardTitle className="text-2xl font-bold text-orange-600">Link Expired</CardTitle>
              <CardDescription>
                {message}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={handleResendVerification}
                disabled={resending}
                className="w-full"
              >
                {resending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send New Verification Email'
                )}
              </Button>
              <div className="text-center">
                <Link href="/auth/register">
                  <Button variant="outline" className="w-full">
                    Back to Registration
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )

      case 'error':
        return (
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <CardTitle className="text-2xl font-bold text-red-600">Verification Failed</CardTitle>
              <CardDescription>
                We couldn&apos;t verify your email address
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-red-200 bg-red-50 text-red-800">
                <AlertDescription>{message}</AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Link href="/auth/register">
                  <Button className="w-full">
                    Try Registration Again
                  </Button>
                </Link>
                <Link href="/auth/login">
                  <Button variant="outline" className="w-full">
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      {renderContent()}
    </div>
  )
}