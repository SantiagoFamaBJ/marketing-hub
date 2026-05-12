import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'larqxmgyutqiktsforgz.supabase.co',
      },
    ],
  },
}

export default nextConfig
