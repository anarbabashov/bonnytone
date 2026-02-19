/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const streamOrigin = process.env.AZURACAST_ORIGIN || 'http://localhost'
    return [
      {
        source: '/stream/hls/:path*',
        destination: `${streamOrigin}/hls/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
