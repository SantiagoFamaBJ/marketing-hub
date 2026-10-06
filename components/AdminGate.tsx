'use client'

import { useEffect, useState } from 'react'

const KEY = 'dm_admin_auth'

// Pantalla de acceso estándar de los admins DM: solo contraseña, validada en el servidor.
export default function AdminGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false)
  const [checked, setChecked] = useState(false)
  const [pass, setPass] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    try { setAuthed(localStorage.getItem(KEY) === '1') } catch {}
    setChecked(true)
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(false)
    const res = await fetch('/api/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pass }),
    }).catch(() => null)
    setLoading(false)
    if (res && res.ok) {
      try { localStorage.setItem(KEY, '1') } catch {}
      setAuthed(true)
    } else {
      setError(true)
      setPass('')
    }
  }

  if (!checked) return null
  if (authed) return <>{children}</>

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#f7f7f7', fontFamily: 'inherit' }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 340, background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,.06)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, textAlign: 'center' }}>Acceso admin</h1>
        <input
          type="password"
          value={pass}
          autoFocus
          onChange={(e) => { setPass(e.target.value); setError(false) }}
          placeholder="Contraseña"
          style={{ border: `1px solid ${error ? '#f15922' : '#e0e0e0'}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, outline: 'none' }}
        />
        {error && <p style={{ margin: 0, fontSize: 12, color: '#f15922' }}>Contraseña incorrecta.</p>}
        <button type="submit" disabled={loading} style={{ background: '#f15922', color: '#fff', border: 0, borderRadius: 999, padding: '10px 16px', fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  )
}
