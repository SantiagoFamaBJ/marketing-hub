'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSesion } from '@/lib/useSesion'
import { Usuario, cargarUsuarios } from '@/lib/tareas'

type Resp = { id: string; usuario_id: string; texto: string; orden: number }

// Orden de las tarjetas: Santiago, Aline, Matías, Zoe y Mauro al final (el resto, por antigüedad)
const ORDEN = ['santiago', 'aline', 'matias', 'zoe']
const rank = (slug: string) => (slug === 'mauro' ? 999 : ORDEN.indexOf(slug) === -1 ? 500 : ORDEN.indexOf(slug))

export default function ResponsabilidadesPage() {
  const { usuario } = useSesion()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [items, setItems] = useState<Resp[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    Promise.all([cargarUsuarios(), supabase.from('mkt_responsabilidades').select('*').order('orden', { ascending: true }).order('creado_en', { ascending: true })]).then(([us, r]) => {
      setUsuarios([...us].sort((a, b) => rank(a.slug) - rank(b.slug)))
      setItems((r.data as Resp[]) || [])
      setCargando(false)
    })
  }, [])

  if (!usuario) return null

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: 'clamp(1.25rem, 4vw, 1.6rem)', fontWeight: 700, color: 'var(--text)' }}>🧭 Responsabilidades</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>{cargando ? 'Cargando…' : 'Qué tiene a cargo cada persona del equipo.'}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 14, alignItems: 'start' }}>
        {usuarios.map(u => {
          const mias = items.filter(i => i.usuario_id === u.id)
          return (
            <section key={u.id} aria-label={`Responsabilidades de ${u.nombre}`} style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border)', borderTop: `4px solid ${u.avatar_color}`, borderRadius: 14, padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: u.avatar_color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>{u.avatar_emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, color: 'var(--text)' }}>{u.nombre}</p>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{mias.length} responsabilidad{mias.length === 1 ? '' : 'es'}</p>
                </div>
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {mias.map(r => (
                  <li key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span aria-hidden style={{ color: u.avatar_color, fontWeight: 700, lineHeight: 1.5 }}>•</span>
                    <span style={{ fontSize: '0.86rem', color: 'var(--text)', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{r.texto}</span>
                  </li>
                ))}
                {mias.length === 0 && <li style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Sin responsabilidades cargadas.</li>}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
