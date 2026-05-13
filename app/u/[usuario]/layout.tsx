'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

type Usuario = {
  id: string; nombre: string; slug: string
  avatar_color: string; avatar_emoji: string; rol: string
}

const navItems = [
  { href: '', label: 'Dashboard', emoji: '🏠' },
  { href: '/tareas', label: 'Tareas', emoji: '✅' },
  { href: '/campanas', label: 'Campañas', emoji: '📣' },
  { href: '/copys', label: 'Copys', emoji: '✍️' },
  { href: '/calendario', label: 'Calendario', emoji: '📅' },
  { href: '/manuales', label: 'Manuales', emoji: '📚' },
  { href: '/historial', label: 'Historial', emoji: '🕐' },
  { href: '/notas', label: 'Mis notas', emoji: '📝' },
]

const reporteItems = [
  { href: '/reportes', label: 'Reportes', emoji: '📊' },
]

export default function UsuarioLayout({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const stored = sessionStorage.getItem('mkt_usuario')
    if (!stored) { router.push('/'); return }
    setUsuario(JSON.parse(stored))
  }, [])

  useEffect(() => { setSidebarOpen(false) }, [pathname])

  if (!usuario) return null

  const base = `/u/${usuario.slug}`
  const isActive = (href: string) => pathname === (href === '' ? base : `${base}${href}`)

  function NavLink({ href, label, emoji }: { href: string; label: string; emoji: string }) {
    const full = href === '' ? base : `${base}${href}`
    const active = isActive(href)
    return (
      <Link href={full} style={{
        display: 'flex', alignItems: 'center', gap: '0.625rem',
        padding: '0.625rem 0.75rem', borderRadius: '10px', marginBottom: '2px',
        textDecoration: 'none',
        backgroundColor: active ? '#f9ddd3' : 'transparent',
        color: active ? '#f15922' : '#444',
        fontWeight: active ? 600 : 400, fontSize: '0.9rem',
        transition: 'all 0.15s ease',
      }}>
        <span style={{ fontSize: '1.1rem', width: 24, textAlign: 'center' }}>{emoji}</span>
        {label}
      </Link>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#fafafa' }}>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 150,
        }} />
      )}

      {/* Sidebar desktop */}
      <aside className="sidebar-desktop" style={{
        width: 240, backgroundColor: '#ffffff', borderRight: '1px solid #e8e8e8',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 100,
      }}>
        <div style={{ padding: '1.25rem 1.25rem 1rem', borderBottom: '1px solid #f4f4f4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 32, height: 32, borderRadius: '8px', backgroundColor: '#f15922', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>🦷</div>
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.2 }}>Marketing Hub</p>
              <p style={{ fontSize: '0.65rem', color: '#a0a0a0' }}>Dental Medrano</p>
            </div>
          </div>
        </div>
        <nav style={{ padding: '0.75rem', flex: 1, overflowY: 'auto' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, color: '#a0a0a0', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 0.5rem', marginBottom: '0.375rem' }}>General</p>
          {navItems.map(item => <NavLink key={item.href} {...item} />)}
          {usuario.rol === 'mkt_reporte' && (
            <>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, color: '#a0a0a0', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 0.5rem', marginBottom: '0.375rem', marginTop: '1rem' }}>Gestión</p>
              {reporteItems.map(item => <NavLink key={item.href} {...item} />)}
            </>
          )}
        </nav>
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #f4f4f4', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: usuario.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>{usuario.avatar_emoji}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{usuario.nombre}</p>
            <p style={{ fontSize: '0.7rem', color: '#a0a0a0' }}>{usuario.rol === 'mkt_reporte' ? 'MKT + Reporte' : 'Marketing'}</p>
          </div>
          <button onClick={() => { sessionStorage.removeItem('mkt_usuario'); router.push('/') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '4px', borderRadius: '6px', color: '#a0a0a0' }}>↩</button>
        </div>
      </aside>

      {/* Sidebar mobile */}
      <aside className="sidebar-mobile" style={{
        width: 280, backgroundColor: '#ffffff',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: sidebarOpen ? 0 : -300, height: '100vh', zIndex: 200,
        transition: 'left 0.25s ease',
        boxShadow: sidebarOpen ? '4px 0 24px rgba(0,0,0,0.15)' : 'none',
      }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid #f4f4f4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 32, height: 32, borderRadius: '8px', backgroundColor: '#f15922', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>🦷</div>
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.2 }}>Marketing Hub</p>
              <p style={{ fontSize: '0.65rem', color: '#a0a0a0' }}>Dental Medrano</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#888' }}>×</button>
        </div>
        <nav style={{ padding: '0.75rem', flex: 1, overflowY: 'auto' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, color: '#a0a0a0', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 0.5rem', marginBottom: '0.375rem' }}>General</p>
          {navItems.map(item => <NavLink key={item.href} {...item} />)}
          {usuario.rol === 'mkt_reporte' && (
            <>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, color: '#a0a0a0', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 0.5rem', marginBottom: '0.375rem', marginTop: '1rem' }}>Gestión</p>
              {reporteItems.map(item => <NavLink key={item.href} {...item} />)}
            </>
          )}
        </nav>
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #f4f4f4', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: usuario.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>{usuario.avatar_emoji}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{usuario.nombre}</p>
            <p style={{ fontSize: '0.7rem', color: '#a0a0a0' }}>{usuario.rol === 'mkt_reporte' ? 'MKT + Reporte' : 'Marketing'}</p>
          </div>
          <button onClick={() => { sessionStorage.removeItem('mkt_usuario'); router.push('/') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '4px', borderRadius: '6px', color: '#a0a0a0' }}>↩</button>
        </div>
      </aside>

      {/* Topbar mobile */}
      <header className="topbar-mobile" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 98,
        backgroundColor: '#fff', borderBottom: '1px solid #e8e8e8',
        padding: '0 1rem', alignItems: 'center', justifyContent: 'space-between',
        height: 56, display: 'none',
      }}>
        <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#444', padding: '4px' }}>☰</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <div style={{ width: 26, height: 26, borderRadius: '6px', backgroundColor: '#f15922', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>🦷</div>
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1a1a1a' }}>Marketing Hub</span>
        </div>
        <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: usuario.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>{usuario.avatar_emoji}</div>
      </header>

      {/* Main */}
      <main className="main-content" style={{ marginLeft: 240, flex: 1, minHeight: '100vh', padding: '2rem' }}>
        {children}
      </main>

      <style>{`
        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .topbar-mobile { display: flex !important; }
          .main-content { margin-left: 0 !important; padding: 1rem !important; padding-top: 68px !important; }
        }
        @media (min-width: 769px) {
          .sidebar-mobile { display: none !important; }
        }
      `}</style>
    </div>
  )
}
