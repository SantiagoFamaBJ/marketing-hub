import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Marketing Hub — Dental Medrano',
  description: 'Plataforma interna del equipo de marketing',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
