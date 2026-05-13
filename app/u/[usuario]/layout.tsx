'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

type Usuario = {
  id: string
  nombre: string
  slug: string
  avatar_color: string
  avatar_emoji: string
  rol: string
}

const navItems = [
  { href: '', label: 'Dashboard', emoji: '🏠' },
  { href: '/tareas', label: 'Tareas', emoji: '✅' },
  { href: '/campanas', label: 'Campañas', emoji: '📣' },
  { href: '/copys', label: 'Copys', emoji: '✍️' },
  { href: '/calendario', label: 'Calendario', emoji: '📅' },
  { href: '/manuales', label: 'Manuales', emoji: '📚' },
  { href: '/notas', label: 'Mis notas', emoji: '📝' },
]

const adminItems = [
  { href: '/reportes', label: 'Reportes', emoji: '📊' },
  { href: '/admin', label: 'Admin', emoji: '⚙️' },
]

export default function UsuarioLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: any
}) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const stored = sessionStorage.getItem('mkt_usuario')
    if (!stored) {
      router.push('/')
      return
    }
    const u = JSON.parse(stored)
    setUsuario(u)
  }, [])

  if (!usuario) return null

  const base = `/${usuario.slug}`

  function isActive(href: string) {
    const full = href === '' ? base : `${base}${href}`
    return pathname === full
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#fafafa' }}>

      {/* Sidebar */}
      <aside style={{
        width: 240,
        backgroundColor: '#ffffff',
        borderRight: '1px solid #e8e8e8',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        zIndex: 100,
        transition: 'transform 0.2s ease',
      }}>

        {/* Logo */}
        <div style={{
          padding: '1.5rem 1.25rem 1rem',
          borderBottom: '1px solid #f4f4f4',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              backgroundColor: '#f15922',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
            }}>
              🦷
            </div>
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.2 }}>Marketing Hub</p>
              <p style={{ fontSize: '0.65rem', color: '#a0a0a0' }}>Dental Medrano</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '0.75rem 0.75rem', flex: 1, overflowY: 'auto' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 600, color: '#a0a0a0', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 0.5rem', marginBottom: '0.25rem' }}>
            General
          </p>
          {navItems.map(item => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href === '' ? base : `${base}${item.href}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: '0.5rem 0.625rem',
                  borderRadius: '8px',
                  marginBottom: '2px',
                  textDecoration: 'none',
                  backgroundColor: active ? '#f9ddd3' : 'transparent',
                  color: active ? '#f15922' : '#444',
                  fontWeight: active ? 600 : 400,
                  fontSize: '0.875rem',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = '#f4f4f4'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }
                }}
              >
                <span style={{ fontSize: '1rem' }}>{item.emoji}</span>
                {item.label}
              </Link>
            )
          })}

          {/* Admin items */}
          {usuario.rol === 'admin' && (
            <>
              <p style={{ fontSize: '0.65rem', fontWeight: 600, color: '#a0a0a0', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 0.5rem', marginBottom: '0.25rem', marginTop: '1rem' }}>
                Administración
              </p>
              {adminItems.map(item => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={`${base}${item.href}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      padding: '0.5rem 0.625rem',
                      borderRadius: '8px',
                      marginBottom: '2px',
                      textDecoration: 'none',
                      backgroundColor: active ? '#f9ddd3' : 'transparent',
                      color: active ? '#f15922' : '#444',
                      fontWeight: active ? 600 : 400,
                      fontSize: '0.875rem',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      if (!active) e.currentTarget.style.backgroundColor = '#f4f4f4'
                    }}
                    onMouseLeave={e => {
                      if (!active) e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <span style={{ fontSize: '1rem' }}>{item.emoji}</span>
                    {item.label}
                  </Link>
                )
              })}
            </>
          )}
        </nav>

        {/* Usuario actual */}
        <div style={{
          padding: '1rem 1.25rem',
          borderTop: '1px solid #f4f4f4',
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
        }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            backgroundColor: usuario.avatar_color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            flexShrink: 0,
          }}>
            {usuario.avatar_emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {usuario.nombre}
            </p>
            <p style={{ fontSize: '0.7rem', color: '#a0a0a0' }}>{usuario.rol}</p>
          </div>
          <button
            onClick={() => {
              sessionStorage.removeItem('mkt_usuario')
              router.push('/')
            }}
            title="Cambiar usuario"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              padding: '4px',
              borderRadius: '6px',
              color: '#a0a0a0',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f4f4f4'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            ↩
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main style={{
        marginLeft: 240,
        flex: 1,
        minHeight: '100vh',
        padding: '2rem',
      }}>
        {children}
      </main>
    </div>
  )
}
