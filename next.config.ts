import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Herramienta interna: no indexar nada (páginas, archivos ni API)
  async headers() {
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }] }]
  },
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
