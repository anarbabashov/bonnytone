import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import AuthButtons from "@/components/layout/AuthButtons"

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                ArtistMgmt
              </h1>
            </div>
            <AuthButtons />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Artist Management Dashboard
            </h1>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
              SoundCloud artist promotion and management platform
            </p>
          </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>🎵 Bot Automation</CardTitle>
            <CardDescription>
              Automated following and engagement with targeted audiences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Schedule automated interactions to grow your fanbase organically.
            </p>
            <Button variant="outline" disabled>
              Coming Soon
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>📊 Analytics</CardTitle>
            <CardDescription>
              Track follower growth and engagement metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Detailed insights into your audience and performance.
            </p>
            <Button variant="outline" disabled>
              Coming Soon
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🔐 Authentication</CardTitle>
            <CardDescription>
              Secure user management and session handling
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Complete auth system with JWT, MFA, and security features.
            </p>
            <Button variant="outline">
              ✅ Ready
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>💳 Subscriptions</CardTitle>
            <CardDescription>
              Basic, Gold, and Platinum tiers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              $15, $25, and $35 monthly plans with different automation limits.
            </p>
            <Button variant="outline" disabled>
              Coming Soon
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🎛️ API Management</CardTitle>
            <CardDescription>
              SoundCloud API integration and rate limiting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Robust API handling with proper authentication and limits.
            </p>
            <Button variant="outline" disabled>
              Coming Soon
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>⚡ Real-time</CardTitle>
            <CardDescription>
              Live updates and notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Get instant feedback on your automation and growth.
            </p>
            <Button variant="outline" disabled>
              Coming Soon
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="text-center">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>🏗️ Current Status</CardTitle>
            <CardDescription>BE-01 Authentication System Implementation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 text-left">
              <div className="flex items-center gap-2">
                <span className="text-green-500">✅</span>
                <span>JWT Authentication with ES256/HS512</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✅</span>
                <span>Refresh Token Rotation & Reuse Detection</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✅</span>
                <span>Argon2id Password Hashing</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✅</span>
                <span>Rate Limiting with Redis</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✅</span>
                <span>Email Verification & Password Reset</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✅</span>
                <span>TOTP-based MFA Support</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✅</span>
                <span>Comprehensive Testing Suite</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✅</span>
                <span>Security Monitoring & Alerts</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
        </div>
      </main>
    </div>
  )
}
