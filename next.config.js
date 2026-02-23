/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'argon2'],
  },
  async rewrites() {
    const streamOrigin = process.env.AZURACAST_ORIGIN || 'http://localhost'
    return [
      {
        source: '/stream/hls/:path*',
        destination: `${streamOrigin}/stream/hls/:path*`,
      },
      {
        source: '/api/azuracast/:path*',
        destination: `${streamOrigin}/api/azuracast/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
