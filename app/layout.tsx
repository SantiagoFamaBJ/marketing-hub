import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://mkthub.dentalmedrano.com'),
  title: 'Marketing Hub — Dental Medrano',
  description: 'Plataforma interna del equipo de marketing',
  openGraph: { title: 'Marketing Hub — Dental Medrano', description: 'Plataforma interna del equipo de marketing', siteName: 'Dental Medrano', type: 'website', locale: 'es_AR', images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Dental Medrano' }] },
  twitter: { card: 'summary_large_image', images: ['/og-image.png'] },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon-192.png', sizes: '192x192' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
