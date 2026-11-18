'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSesion } from '@/lib/useSesion'
import { Usuario, cargarUsuarios } from '@/lib/tareas'

type Resp = { id: string; usuario_id: string; texto: string; orden: number }

export default function ResponsabilidadesPage() {
  const { usuario } = useSesion()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [items, setItems] = useState<Resp[]>([])
  const [cargando, setCargando] = useState(true)
  const [editandoU, setEditandoU] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState('')
  const [error, setError] = useState('')

  async function cargar() {
    const [us, r] = await Promise.all([cargarUsuarios(), supabase.from('mkt_responsabilidades').select('*').order('orden', { ascending: true }).order('creado_en', { ascending: true })])
    setUsuarios(us); setItems((r.data as Resp[]) || []); setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  async function agregar(uid: string) {
    const texto = nuevo.trim(); if (!texto) return
    const orden = Math.max(0, ...items.filter(i => i.usuario_id === uid).map(i => i.orden)) + 1
    const { error: e } = await supabase.from('mkt_responsabilidades').insert({ usuario_id: uid, texto, orden })
    if (e) { setError('No se pudo agregar.'); return }
    setError(''); setNuevo(''); cargar()
  }
  async function guardarTexto(r: Resp, texto: string) {
    const t = texto.trim()
    if (!t || t === r.texto) { setItems(prev => prev.map(x => (x.id === r.id ? { ...x, texto: r.texto } : x))); return }
    await supabase.from('mkt_responsabilidades').update({ texto: t }).eq('id', r.id)
    setItems(prev => prev.map(x => (x.id === r.id ? { ...x, texto: t } : x)))
  }
  async function borrar(r: Resp) {
    if (!confirm('¿Quitar esta responsabilidad?')) return
    await supabase.from('mkt_responsabilidades').delete().eq('id', r.id)
    setItems(prev => prev.filter(x => x.id !== r.id))
  }

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
          const edita = editandoU === u.id
          return (
            <section key={u.id} aria-label={`Responsabilidades de ${u.nombre}`} style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border)', borderTop: `4px solid ${u.avatar_color}`, borderRadius: 14, padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: u.avatar_color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>{u.avatar_emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, color: 'var(--text)' }}>{u.nombre}</p>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{mias.length} responsabilidad{mias.length === 1 ? '' : 'es'}</p>
                </div>
                <button onClick={() => { setEditandoU(edita ? null : u.id); setNuevo(''); setError('') }} style={{ minHeight: 36, padding: '0 12px', border: '1.5px solid var(--border)', borderRadius: 8, background: edita ? '#f15922' : 'var(--bg-card)', color: edita ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>{edita ? 'Listo' : 'Editar'}</button>
              </div>

              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {mias.map(r => (
                  <li key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    {edita ? (
                      <>
                        <textarea defaultValue={r.texto} rows={2} onBlur={e => guardarTexto(r, e.target.value)} aria-label="Responsabilidad" style={{ flex: 1, minWidth: 0, padding: '0.5rem 0.7rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.85rem', color: 'var(--text)', backgroundColor: 'var(--input-bg)', resize: 'vertical', fontFamily: 'inherit' }} />
                        <button onClick={() => borrar(r)} aria-label="Quitar" style={{ minWidth: 38, minHeight: 38, border: '1.5px solid #fecaca', borderRadius: 8, background: 'var(--bg-card)', color: '#ef4444', cursor: 'pointer' }}>✕</button>
                      </>
                    ) : (
                      <>
                        <span aria-hidden style={{ color: u.avatar_color, fontWeight: 700, lineHeight: 1.5 }}>•</span>
                        <span style={{ fontSize: '0.86rem', color: 'var(--text)', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{r.texto}</span>
                      </>
                    )}
                  </li>
                ))}
                {mias.length === 0 && <li style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Sin responsabilidades cargadas.</li>}
              </ul>

              {edita && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <input value={nuevo} onChange={e => setNuevo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') agregar(u.id) }} placeholder="Agregar responsabilidad y Enter" style={{ flex: 1, minWidth: 0, padding: '0.55rem 0.75rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.85rem', color: 'var(--text)', backgroundColor: 'var(--input-bg)' }} />
                  <button onClick={() => agregar(u.id)} style={{ minWidth: 44, border: 'none', borderRadius: 8, backgroundColor: '#f15922', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>+</button>
                </div>
              )}
              {edita && error && <p role="alert" style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: 6 }}>{error}</p>}
            </section>
          )
        })}
      </div>
    </div>
  )
}
