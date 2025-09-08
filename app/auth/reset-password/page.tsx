'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Eye, EyeOff, Loader2, CheckCircle, XCircle } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)

  useEffect(() => {
    if (!token) {
      setError('No reset token provided')
      setTokenValid(false)
      return
    }

    // Validate token on page load
    validateToken(token)
  }, [token])

  const validateToken = async (token: string) => {
    try {
      const response = await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`, {
        method: 'GET'
      })

      if (response.ok) {
        setTokenValid(true)
      } else {
        const data = await response.json()
        setError(data.error || 'Invalid or expired reset token')
        setTokenValid(false)
      }
    } catch (err) {
      setError('Network error. Please check your connection.')
      setTokenValid(false)
    }
  }

  const validatePassword = (password: string) => {
    return {
      length: password.length >= 8 && password.length <= 128,
      hasUpper: /[A-Z]/.test(password),
      hasLower: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    }
  }

  const validateForm = () => {
    if (!formData.password) {
      setError('Password is required')
      return false
    }
    
    const passwordValidation = validatePassword(formData.password)
    if (!passwordValidation.length) {
      setError('Password must be between 8 and 128 characters')
      return false
    }
    if (!passwordValidation.hasUpper || !passwordValidation.hasLower) {
      setError('Password must contain both uppercase and lowercase letters')
      return false
    }
    if (!passwordValidation.hasNumber) {
      setError('Password must contain at least one number')
      return false
    }
    if (!passwordValidation.hasSpecial) {
      setError('Password must contain at least one special character')
      return false
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return false
    }
    
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!validateForm() || !token) return

    setLoading(true)
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password: formData.password
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Password reset failed')
      }

      setSuccess(true)
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/auth/login')
      }, 3000)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    setError('')
  }

  // Show loading while validating token
  if (tokenValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
            <CardTitle className="text-2xl font-bold">Validating Reset Link</CardTitle>
            <CardDescription>
              Please wait while we validate your reset token...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Show error if token is invalid
  if (tokenValid === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-red-600">Invalid Reset Link</CardTitle>
            <CardDescription>
              This password reset link is invalid or has expired
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-red-200 bg-red-50 text-red-800">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Link href="/auth/forgot-password">
                <Button className="w-full">
                  Request New Reset Link
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
      </div>
    )
  }

  // Show success message
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-green-600">Password Reset Complete</CardTitle>
            <CardDescription>
              Your password has been successfully updated
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              You can now sign in with your new password. You will be automatically redirected to the login page.
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
      </div>
    )
  }

  const passwordValidation = validatePassword(formData.password)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Reset Password</CardTitle>
          <CardDescription className="text-center">
            Choose a new secure password for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert className="border-red-200 bg-red-50 text-red-800">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create a new password"
                  disabled={loading}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              
              {formData.password && (
                <div className="mt-2 space-y-1">
                  <div className={`text-xs flex items-center gap-1 ${passwordValidation.length ? 'text-green-600' : 'text-red-500'}`}>
                    <span className={`w-1 h-1 rounded-full ${passwordValidation.length ? 'bg-green-600' : 'bg-red-500'}`} />
                    8-128 characters
                  </div>
                  <div className={`text-xs flex items-center gap-1 ${passwordValidation.hasUpper && passwordValidation.hasLower ? 'text-green-600' : 'text-red-500'}`}>
                    <span className={`w-1 h-1 rounded-full ${passwordValidation.hasUpper && passwordValidation.hasLower ? 'bg-green-600' : 'bg-red-500'}`} />
                    Upper & lowercase letters
                  </div>
                  <div className={`text-xs flex items-center gap-1 ${passwordValidation.hasNumber ? 'text-green-600' : 'text-red-500'}`}>
                    <span className={`w-1 h-1 rounded-full ${passwordValidation.hasNumber ? 'bg-green-600' : 'bg-red-500'}`} />
                    At least one number
                  </div>
                  <div className={`text-xs flex items-center gap-1 ${passwordValidation.hasSpecial ? 'text-green-600' : 'text-red-500'}`}>
                    <span className={`w-1 h-1 rounded-full ${passwordValidation.hasSpecial ? 'bg-green-600' : 'bg-red-500'}`} />
                    Special character
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm your new password"
                  disabled={loading}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={loading}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting Password...
                </>
              ) : (
                'Reset Password'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/auth/login">
              <Button variant="outline" className="w-full">
                Back to Sign In
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}