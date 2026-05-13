'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Usuario = { id: string; nombre: string; slug: string; avatar_color: string; avatar_emoji: string; rol: string }
type Notificacion = { id: string; tipo: string; titulo: string; mensaje: string | null; leida: boolean; creado_en: string }
type ResultadoBusqueda = { id: string; tipo: 'tarea' | 'evento' | 'copy'; titulo: string; subtitulo?: string }

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
const reporteItems = [{ href: '/reportes', label: 'Reportes', emoji: '📊' }]

export default function UsuarioLayout({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [tareasVencidas, setTareasVencidas] = useState(0)
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([])
  const [buscando, setBuscando] = useState(false)
  const [busquedaOpen, setBusquedaOpen] = useState(false)
  const busquedaRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const stored = sessionStorage.getItem('mkt_usuario')
    if (!stored) { router.push('/'); return }
    const u = JSON.parse(stored)
    setUsuario(u)
    fetchNotificaciones(u.id)
    fetchTareasVencidas(u.id)
    const dark = localStorage.getItem('darkMode') === 'true'
    setDarkMode(dark)
  }, [])

  useEffect(() => { setSidebarOpen(false); setNotifOpen(false) }, [pathname])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('darkMode', String(darkMode))
  }, [darkMode])

  useEffect(() => {
    if (!busqueda.trim()) { setResultados([]); return }
    const timer = setTimeout(() => buscar(busqueda), 300)
    return () => clearTimeout(timer)
  }, [busqueda])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (busquedaRef.current && !busquedaRef.current.contains(e.target as Node)) setBusquedaOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function fetchNotificaciones(userId: string) {
    const { data } = await supabase.from('mkt_notificaciones').select('*').eq('usuario_id', userId).eq('leida', false).order('creado_en', { ascending: false }).limit(10)
    setNotificaciones(data || [])
  }

  async function fetchTareasVencidas(userId: string) {
    const hoy = new Date().toISOString().split('T')[0]
    const { data: asignadas } = await supabase.from('mkt_tarea_asignados').select('tarea_id').eq('usuario_id', userId)
    const ids = (asignadas || []).map((a: any) => a.tarea_id)
    if (ids.length === 0) { setTareasVencidas(0); return }
    const { data } = await supabase.from('mkt_tareas').select('id').in('id', ids).lt('deadline', hoy).neq('estado', 'hecho')
    setTareasVencidas((data || []).length)
  }

  async function marcarLeida(id: string) {
    await supabase.from('mkt_notificaciones').update({ leida: true }).eq('id', id)
    setNotificaciones(prev => prev.filter(n => n.id !== id))
  }

  async function marcarTodasLeidas() {
    if (!usuario) return
    await supabase.from('mkt_notificaciones').update({ leida: true }).eq('usuario_id', usuario.id).eq('leida', false)
    setNotificaciones([])
  }

  async function buscar(q: string) {
    setBuscando(true)
    const res: ResultadoBusqueda[] = []
    const [{ data: tareas }, { data: eventos }, { data: copys }] = await Promise.all([
      supabase.from('mkt_tareas').select('id, titulo, estado').ilike('titulo', `%${q}%`).limit(5),
      supabase.from('mkt_eventos').select('id, titulo, tipo').ilike('titulo', `%${q}%`).limit(3),
      supabase.from('mkt_copys_generados').select('id, nombre').ilike('nombre', `%${q}%`).limit(3),
    ])
    tareas?.forEach(t => res.push({ id: t.id, tipo: 'tarea', titulo: t.titulo, subtitulo: t.estado }))
    eventos?.forEach(e => res.push({ id: e.id, tipo: 'evento', titulo: e.titulo, subtitulo: e.tipo }))
    copys?.forEach(c => res.push({ id: c.id, tipo: 'copy', titulo: c.nombre }))
    setResultados(res)
    setBuscando(false)
  }

  if (!usuario) return null

  const base = `/u/${usuario.slug}`
  const isActive = (href: string) => pathname === (href === '' ? base : `${base}${href}`)

  const c = {
    bg: darkMode ? '#111827' : '#fafafa',
    sidebar: darkMode ? '#1f2937' : '#ffffff',
    border: darkMode ? '#374151' : '#e8e8e8',
    text: darkMode ? '#f3f4f6' : '#1a1a1a',
    textMuted: darkMode ? '#9ca3af' : '#a0a0a0',
    hover: darkMode ? '#374151' : '#f4f4f4',
    activeBg: darkMode ? '#431407' : '#f9ddd3',
    activeText: '#f15922',
    input: darkMode ? '#374151' : '#f4f4f4',
  }

  function NavLink({ href, label, emoji, badge }: { href: string; label: string; emoji: string; badge?: number }) {
    const full = href === '' ? base : `${base}${href}`
    const active = isActive(href)
    return (
      <Link href={full} style={{
        display: 'flex', alignItems: 'center', gap: '0.625rem',
        padding: '0.5rem 0.75rem', borderRadius: '10px', marginBottom: '2px',
        textDecoration: 'none',
        backgroundColor: active ? c.activeBg : 'transparent',
        color: active ? c.activeText : c.text,
        fontWeight: active ? 600 : 400, fontSize: '0.875rem',
        transition: 'all 0.15s ease',
      }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = c.hover }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent' }}
      >
        <span style={{ fontSize: '1rem', width: 22, textAlign: 'center' }}>{emoji}</span>
        <span style={{ flex: 1 }}>{label}</span>
        {badge && badge > 0 && (
          <span style={{ fontSize: '0.65rem', fontWeight: 700, backgroundColor: '#ef4444', color: '#fff', borderRadius: '99px', padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>{badge}</span>
        )}
      </Link>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: c.bg }}>

      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 150 }} />}

      {/* Sidebar desktop */}
      <aside className="sidebar-desktop" style={{ width: 240, backgroundColor: c.sidebar, borderRight: `1px solid ${c.border}`, display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 100 }}>
        <div style={{ padding: '1.25rem 1.25rem 0.875rem', borderBottom: `1px solid ${c.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 32, height: 32, borderRadius: '8px', backgroundColor: '#f15922', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>🦷</div>
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: c.text, lineHeight: 1.2 }}>Marketing Hub</p>
              <p style={{ fontSize: '0.65rem', color: c.textMuted }}>Dental Medrano</p>
            </div>
          </div>
        </div>
        <nav style={{ padding: '0.625rem 0.75rem', flex: 1, overflowY: 'auto' }}>
          <p style={{ fontSize: '0.62rem', fontWeight: 700, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 0.5rem', marginBottom: '0.25rem', marginTop: '0.25rem' }}>General</p>
          {navItems.map(item => <NavLink key={item.href} {...item} badge={item.href === '/tareas' && tareasVencidas > 0 ? tareasVencidas : undefined} />)}
          {usuario.rol === 'mkt_reporte' && (
            <>
              <p style={{ fontSize: '0.62rem', fontWeight: 700, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 0.5rem', marginBottom: '0.25rem', marginTop: '0.875rem' }}>Gestión</p>
              {reporteItems.map(item => <NavLink key={item.href} {...item} />)}
            </>
          )}
        </nav>
        <div style={{ padding: '0.75rem 1rem', borderTop: `1px solid ${c.border}` }}>
          <button onClick={() => setDarkMode(!darkMode)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0.5rem', borderRadius: '8px', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: c.textMuted, fontSize: '0.8rem', marginBottom: '0.625rem' }}>
            <span>{darkMode ? '☀️' : '🌙'}</span>
            <span>{darkMode ? 'Modo claro' : 'Modo oscuro'}</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: usuario.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>{usuario.avatar_emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{usuario.nombre}</p>
              <p style={{ fontSize: '0.68rem', color: c.textMuted }}>{usuario.rol === 'mkt_reporte' ? 'MKT + Reporte' : 'Marketing'}</p>
            </div>
            <button onClick={() => { sessionStorage.removeItem('mkt_usuario'); router.push('/') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '4px', borderRadius: '6px', color: c.textMuted }}>↩</button>
          </div>
        </div>
      </aside>

      {/* Sidebar mobile */}
      <aside className="sidebar-mobile" style={{ width: 280, backgroundColor: c.sidebar, display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: sidebarOpen ? 0 : -300, height: '100vh', zIndex: 200, transition: 'left 0.25s ease', boxShadow: sidebarOpen ? '4px 0 24px rgba(0,0,0,0.2)' : 'none' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 30, height: 30, borderRadius: '8px', backgroundColor: '#f15922', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>🦷</div>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: c.text }}>Marketing Hub</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: c.textMuted }}>×</button>
        </div>
        <nav style={{ padding: '0.625rem 0.75rem', flex: 1, overflowY: 'auto' }}>
          {navItems.map(item => <NavLink key={item.href} {...item} badge={item.href === '/tareas' && tareasVencidas > 0 ? tareasVencidas : undefined} />)}
          {usuario.rol === 'mkt_reporte' && reporteItems.map(item => <NavLink key={item.href} {...item} />)}
        </nav>
        <div style={{ padding: '0.75rem 1rem', borderTop: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: usuario.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>{usuario.avatar_emoji}</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: c.text }}>{usuario.nombre}</p>
          </div>
          <button onClick={() => setDarkMode(!darkMode)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: c.textMuted }}>{darkMode ? '☀️' : '🌙'}</button>
          <button onClick={() => { sessionStorage.removeItem('mkt_usuario'); router.push('/') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: c.textMuted }}>↩</button>
        </div>
      </aside>

      {/* Topbar mobile */}
      <header className="topbar-mobile" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 98, backgroundColor: c.sidebar, borderBottom: `1px solid ${c.border}`, padding: '0 1rem', alignItems: 'center', justifyContent: 'space-between', height: 56, display: 'none' }}>
        <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: c.text }}>☰</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <div style={{ width: 26, height: 26, borderRadius: '6px', backgroundColor: '#f15922', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>🦷</div>
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: c.text }}>Marketing Hub</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={() => setNotifOpen(!notifOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', position: 'relative', padding: '4px' }}>
            🔔
            {notificaciones.length > 0 && <span style={{ position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ef4444' }} />}
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="main-content" style={{ marginLeft: 240, flex: 1, minHeight: '100vh', backgroundColor: c.bg, display: 'flex', flexDirection: 'column' }}>
        {/* Topbar desktop */}
        <div className="topbar-desktop" style={{ position: 'sticky', top: 0, backgroundColor: c.sidebar, borderBottom: `1px solid ${c.border}`, padding: '0.75rem 2rem', display: 'flex', alignItems: 'center', gap: '1rem', zIndex: 90 }}>
          {/* Búsqueda */}
          <div ref={busquedaRef} style={{ flex: 1, maxWidth: 420, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: c.input, border: `1.5px solid ${c.border}`, borderRadius: '10px', padding: '0.5rem 0.875rem' }}>
              <span style={{ color: c.textMuted, fontSize: '0.9rem' }}>🔍</span>
              <input value={busqueda} onChange={e => { setBusqueda(e.target.value); setBusquedaOpen(true) }} onFocus={() => setBusquedaOpen(true)}
                placeholder="Buscar tareas, eventos, copys..."
                style={{ border: 'none', outline: 'none', flex: 1, fontSize: '0.875rem', backgroundColor: 'transparent', color: c.text }} />
              {busqueda && <button onClick={() => { setBusqueda(''); setResultados([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, fontSize: '1rem' }}>×</button>}
            </div>
            {busquedaOpen && busqueda.length > 0 && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, backgroundColor: c.sidebar, border: `1.5px solid ${c.border}`, borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 200, overflow: 'hidden' }}>
                {buscando ? (
                  <p style={{ padding: '1rem', fontSize: '0.85rem', color: c.textMuted, textAlign: 'center' }}>Buscando...</p>
                ) : resultados.length === 0 ? (
                  <p style={{ padding: '1rem', fontSize: '0.85rem', color: c.textMuted, textAlign: 'center' }}>Sin resultados para "{busqueda}"</p>
                ) : resultados.map(r => (
                  <div key={r.id} onClick={() => { setBusquedaOpen(false); setBusqueda(''); router.push(r.tipo === 'tarea' ? `${base}/tareas` : r.tipo === 'evento' ? `${base}/calendario` : `${base}/copys`) }}
                    style={{ padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', gap: '0.625rem' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = c.hover}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <span>{r.tipo === 'tarea' ? '✅' : r.tipo === 'evento' ? '📅' : '✍️'}</span>
                    <div>
                      <p style={{ fontSize: '0.85rem', fontWeight: 600, color: c.text }}>{r.titulo}</p>
                      {r.subtitulo && <p style={{ fontSize: '0.72rem', color: c.textMuted }}>{r.subtitulo}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notificaciones */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setNotifOpen(!notifOpen)} style={{ background: 'none', border: `1.5px solid ${c.border}`, borderRadius: '10px', padding: '0.5rem 0.75rem', cursor: 'pointer', color: c.text, display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.9rem' }}>
              🔔
              {notificaciones.length > 0 && <span style={{ fontSize: '0.65rem', fontWeight: 700, backgroundColor: '#ef4444', color: '#fff', borderRadius: '99px', padding: '1px 5px' }}>{notificaciones.length}</span>}
            </button>
            {notifOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 300, backgroundColor: c.sidebar, border: `1.5px solid ${c.border}`, borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 200, overflow: 'hidden' }}>
                <div style={{ padding: '0.875rem 1rem', borderBottom: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontWeight: 700, fontSize: '0.875rem', color: c.text }}>Notificaciones</p>
                  {notificaciones.length > 0 && <button onClick={marcarTodasLeidas} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', color: '#f15922', fontWeight: 600 }}>Marcar todas leídas</button>}
                </div>
                {notificaciones.length === 0 ? (
                  <p style={{ padding: '1.5rem', fontSize: '0.85rem', color: c.textMuted, textAlign: 'center' }}>Sin notificaciones nuevas 🎉</p>
                ) : (
                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    {notificaciones.map(n => (
                      <div key={n.id} style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${c.border}`, display: 'flex', gap: '0.625rem', backgroundColor: darkMode ? '#1f1510' : '#fff9f7' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: '0.825rem', fontWeight: 600, color: c.text, marginBottom: '2px' }}>{n.titulo}</p>
                          {n.mensaje && <p style={{ fontSize: '0.775rem', color: c.textMuted }}>{n.mensaje}</p>}
                          <p style={{ fontSize: '0.68rem', color: c.textMuted, marginTop: '3px' }}>{new Date(n.creado_en).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <button onClick={() => marcarLeida(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, fontSize: '0.875rem', flexShrink: 0, alignSelf: 'flex-start' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '2rem', flex: 1 }} className="page-content">
          {children}
        </div>
      </main>

      <style>{`
        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .topbar-mobile { display: flex !important; }
          .topbar-desktop { display: none !important; }
          .main-content { margin-left: 0 !important; }
          .page-content { padding: 1rem !important; padding-top: 68px !important; }
        }
        @media (min-width: 769px) {
          .sidebar-mobile { display: none !important; }
        }
      `}</style>
    </div>
  )
}
