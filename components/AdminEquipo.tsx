'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { cargarUsuarios, Usuario } from '@/lib/tareas'
import { MODULOS } from '@/lib/modulos'

type Resp = { id: string; usuario_id: string; texto: string; orden: number }
const card: React.CSSProperties = { backgroundColor: '#fff', border: '1.5px solid #e8e8e8', borderRadius: 12, padding: '1rem' }
const inp: React.CSSProperties = { flex: 1, minWidth: 0, padding: '0.55rem 0.75rem', border: '1.5px solid #e8e8e8', borderRadius: 8, fontSize: '0.85rem', color: '#1a1a1a', backgroundColor: '#fff', fontFamily: 'inherit' }
const ORDEN = ['santiago', 'aline', 'matias', 'zoe']
const rank = (slug: string) => (slug === 'mauro' ? 999 : ORDEN.indexOf(slug) === -1 ? 500 : ORDEN.indexOf(slug))

/** Responsabilidades de cada persona: solo se modifican desde acá. */
export function AdminResponsabilidades() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [items, setItems] = useState<Resp[]>([])
  const [nuevo, setNuevo] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  async function cargar() {
    const [us, r] = await Promise.all([cargarUsuarios(), supabase.from('mkt_responsabilidades').select('*').order('orden').order('creado_en')])
    setUsuarios([...us].sort((a, b) => rank(a.slug) - rank(b.slug))); setItems((r.data as Resp[]) || [])
  }
  useEffect(() => { cargar() }, [])

  async function agregar(uid: string) {
    const texto = (nuevo[uid] || '').trim(); if (!texto) return
    const orden = Math.max(0, ...items.filter(i => i.usuario_id === uid).map(i => i.orden)) + 1
    const { error: e } = await supabase.from('mkt_responsabilidades').insert({ usuario_id: uid, texto, orden })
    if (e) { setError('No se pudo agregar. ¿Estás con la cuenta de coordinación?'); return }
    setError(''); setNuevo({ ...nuevo, [uid]: '' }); cargar()
  }
  async function guardar(r: Resp, texto: string) {
    const t = texto.trim(); if (!t || t === r.texto) return
    const { error: e } = await supabase.from('mkt_responsabilidades').update({ texto: t }).eq('id', r.id)
    if (e) { setError('No se pudo guardar el cambio.'); return }
    setError(''); setItems(prev => prev.map(x => (x.id === r.id ? { ...x, texto: t } : x)))
  }
  async function mover(r: Resp, dir: -1 | 1) {
    const lista = items.filter(i => i.usuario_id === r.usuario_id).sort((a, b) => a.orden - b.orden)
    const i = lista.findIndex(x => x.id === r.id), j = i + dir
    if (j < 0 || j >= lista.length) return
    const a = lista[i], b = lista[j]
    await Promise.all([supabase.from('mkt_responsabilidades').update({ orden: b.orden }).eq('id', a.id), supabase.from('mkt_responsabilidades').update({ orden: a.orden }).eq('id', b.id)])
    cargar()
  }
  async function borrar(r: Resp) {
    if (!confirm('¿Quitar esta responsabilidad?')) return
    await supabase.from('mkt_responsabilidades').delete().eq('id', r.id)
    setItems(prev => prev.filter(x => x.id !== r.id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: '0.82rem', color: '#888' }}>Lo que cargues acá lo ve todo el equipo en la sección Responsabilidades. Nadie más puede editarlo.</p>
      {error && <p role="alert" style={{ color: '#ef4444', fontSize: '0.82rem' }}>{error}</p>}
      {usuarios.map(u => {
        const mias = items.filter(i => i.usuario_id === u.id).sort((a, b) => a.orden - b.orden)
        return (
          <section key={u.id} style={{ ...card, borderTop: `4px solid ${u.avatar_color}` }}>
            <p style={{ fontWeight: 700, color: '#1a1a1a', marginBottom: 10 }}>{u.avatar_emoji} {u.nombre} <span style={{ fontWeight: 400, color: '#888', fontSize: '0.75rem' }}>· {mias.length}</span></p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {mias.map((r, i) => (
                <div key={r.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <textarea defaultValue={r.texto} rows={2} aria-label="Responsabilidad" onBlur={e => guardar(r, e.target.value)} style={{ ...inp, resize: 'vertical' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button onClick={() => mover(r, -1)} disabled={i === 0} aria-label="Subir" style={{ minWidth: 34, minHeight: 28, border: '1.5px solid #e8e8e8', borderRadius: 6, background: '#fff', cursor: 'pointer', opacity: i === 0 ? 0.4 : 1 }}>↑</button>
                    <button onClick={() => mover(r, 1)} disabled={i === mias.length - 1} aria-label="Bajar" style={{ minWidth: 34, minHeight: 28, border: '1.5px solid #e8e8e8', borderRadius: 6, background: '#fff', cursor: 'pointer', opacity: i === mias.length - 1 ? 0.4 : 1 }}>↓</button>
                  </div>
                  <button onClick={() => borrar(r)} aria-label="Quitar" style={{ minWidth: 38, minHeight: 38, border: '1.5px solid #fecaca', borderRadius: 8, background: '#fff', color: '#ef4444', cursor: 'pointer' }}>✕</button>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input value={nuevo[u.id] || ''} onChange={e => setNuevo({ ...nuevo, [u.id]: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') agregar(u.id) }} placeholder="Agregar responsabilidad y Enter" style={inp} />
              <button onClick={() => agregar(u.id)} style={{ minWidth: 44, border: 'none', borderRadius: 8, backgroundColor: '#f15922', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>+</button>
            </div>
          </section>
        )
      })}
    </div>
  )
}

/** Prender y apagar secciones del menú para todo el equipo. */
export function AdminSecciones() {
  const [estado, setEstado] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')
  useEffect(() => {
    supabase.from('mkt_modulos').select('clave, activo').then(({ data }) => {
      const r: Record<string, boolean> = {}; (data || []).forEach((x: any) => { r[x.clave] = x.activo }); setEstado(r)
    })
  }, [])
  async function cambiar(clave: string, activo: boolean) {
    setEstado(prev => ({ ...prev, [clave]: activo }))
    const { error: e } = await supabase.from('mkt_modulos').upsert({ clave, activo, actualizado_en: new Date().toISOString() })
    if (e) { setError('No se pudo guardar el cambio.'); setEstado(prev => ({ ...prev, [clave]: !activo })) } else setError('')
  }
  return (
    <div>
      <p style={{ fontSize: '0.82rem', color: '#888', marginBottom: 12 }}>Las secciones apagadas desaparecen del menú para todo el equipo. Los datos no se borran.</p>
      {error && <p role="alert" style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: 8 }}>{error}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {MODULOS.map(m => {
          const on = estado[m.clave] !== false
          return (
            <label key={m.clave} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '0.75rem 1rem' }}>
              <span style={{ fontSize: '1.2rem' }}>{m.emoji}</span>
              <span style={{ flex: 1, fontWeight: 600, color: '#1a1a1a', fontSize: '0.9rem' }}>{m.label}</span>
              <span style={{ fontSize: '0.75rem', color: on ? '#10b981' : '#888', fontWeight: 600 }}>{on ? 'Activa' : 'Apagada'}</span>
              <input type="checkbox" role="switch" checked={on} onChange={e => cambiar(m.clave, e.target.checked)} style={{ width: 22, height: 22, accentColor: '#f15922' }} />
            </label>
          )
        })}
      </div>
    </div>
  )
}
