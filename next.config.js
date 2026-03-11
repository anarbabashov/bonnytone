/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'argon2'],
  },
  async rewrites() {
    const streamOrigin = process.env.AZURACAST_ORIGIN || 'http://localhost'
    return {
      beforeFiles: [
        {
          source: '/stream/hls/:path*',
          destination: `${streamOrigin}/hls/:path*`,
        },
        {
          source: '/api/azuracast/:path*',
          destination: `${streamOrigin}/api/azuracast/:path*`,
        },
        {
          source: '/api/station/:path*',
          destination: `${streamOrigin}/api/station/:path*`,
        },
      ],
    }
  },
}

module.exports = nextConfig
