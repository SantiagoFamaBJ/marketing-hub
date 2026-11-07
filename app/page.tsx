'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const inp: React.CSSProperties = { width: '100%', padding: '0.7rem 0.9rem', border: '1.5px solid #e8e8e8', borderRadius: 10, fontSize: '0.95rem', outline: 'none', color: '#1a1a1a', backgroundColor: '#fff' }

export default function HomePage() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [revisando, setRevisando] = useState(true)
  const router = useRouter()

  // Si ya hay sesión en esta pestaña, entrar directo
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        const u = await perfil()
        if (u) { router.replace(`/u/${u.slug}`); return }
      }
      setRevisando(false)
    })()
  }, [])

  async function perfil() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase.from('mkt_usuarios').select('*').eq('auth_user_id', user.id).eq('activo', true).maybeSingle()
    if (!data) { await supabase.auth.signOut(); sessionStorage.removeItem('mkt_usuario'); return null }
    sessionStorage.setItem('mkt_usuario', JSON.stringify(data))
    return data
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pass })
    if (err) { setError('Email o contraseña incorrectos.'); setLoading(false); return }
    const u = await perfil()
    if (!u) { setError('Tu usuario no tiene acceso al Marketing Hub.'); setLoading(false); return }
    router.push(`/u/${u.slug}`)
  }

  if (revisando) return <div style={{ minHeight: '100vh', backgroundColor: '#fafafa' }} />

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ width: 40, height: 40, borderRadius: '10px', backgroundColor: '#f15922', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🦷</div>
          <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.02em' }}>Dental Medrano</span>
        </div>
        <p style={{ fontSize: '0.95rem', color: '#666' }}>Marketing Hub</p>
      </div>

      <form onSubmit={entrar} style={{ width: '100%', maxWidth: 340, backgroundColor: '#fff', border: '1.5px solid #e8e8e8', borderRadius: 16, padding: '1.5rem' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>Email</label>
        <input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} style={{ ...inp, marginBottom: 14 }} />
        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: 6 }}>Contraseña</label>
        <input type="password" autoComplete="current-password" required value={pass} onChange={e => setPass(e.target.value)} style={{ ...inp, marginBottom: 14 }} />
        {error && <p role="alert" style={{ fontSize: '0.82rem', color: '#ef4444', marginBottom: 12 }}>{error}</p>}
        <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.75rem', border: 'none', borderRadius: 10, backgroundColor: '#f15922', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>{loading ? 'Entrando…' : 'Entrar'}</button>
      </form>

      <p style={{ marginTop: '2rem', fontSize: '0.75rem', color: '#c0c0c0' }}>Marketing Hub · Dental Medrano © {new Date().getFullYear()}</p>
    </div>
  )
}
