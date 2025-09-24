'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { User, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthContext'

export default function AuthButtons() {
  const { user, loading, logout, isAuthenticated } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center space-x-4">
        <div className="w-16 h-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></div>
        <div className="w-20 h-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded"></div>
      </div>
    )
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center space-x-4">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Welcome, {user.displayName || user.email}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={logout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center space-x-4">
      <Link href="/auth/login">
        <Button variant="outline" size="sm">
          <User className="mr-2 h-4 w-4" />
          Login
        </Button>
      </Link>
      <Link href="/auth/register">
        <Button size="sm">
          Get Started
        </Button>
      </Link>
    </div>
  )
}