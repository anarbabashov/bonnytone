import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/guards'

export const dynamic = 'force-dynamic'

export const GET = withAuth(
  async (request: NextRequest, context) => {
    try {
      // User data is already loaded by the auth guard
      const { user } = context
      
      if (!user) {
        return NextResponse.json(
          { error: 'User data not available' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          emailVerifiedAt: user.emailVerifiedAt,
          mfaEnabled: user.mfaEnabled,
        },
      })

    } catch (error) {
      console.error('Get current user error:', error)
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  },
  {
    requireNotBlocked: true,
    includeUserData: true,
  }
)