'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSesion } from '@/lib/useSesion'
import { Usuario, cargarUsuarios, fechaCorta, hoyISO } from '@/lib/tareas'

type Objetivo = { id: string; usuario_id: string; titulo: string; descripcion: string | null; progreso: number; fecha_fin: string | null }

const inp: React.CSSProperties = { width: '100%', padding: '0.6rem 0.8rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', color: 'var(--text)', backgroundColor: 'var(--input-bg)' }
const colorProgreso = (p: number) => (p >= 100 ? '#10b981' : p >= 50 ? '#f15922' : '#f59e0b')
const diasPara = (iso: string) => Math.round((new Date(iso + 'T12:00:00').getTime() - new Date(hoyISO() + 'T12:00:00').getTime()) / 86400000)

function Barra({ valor }: { valor: number }) {
  return (
    <div role="progressbar" aria-valuenow={valor} aria-valuemin={0} aria-valuemax={100} style={{ height: 8, borderRadius: 99, backgroundColor: 'var(--border)', overflow: 'hidden' }}>
      <div style={{ width: `${valor}%`, height: '100%', backgroundColor: colorProgreso(valor), transition: 'width .25s' }} />
    </div>
  )
}

export default function ObjetivosPage() {
  const { usuario, permisos } = useSesion()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [objetivos, setObjetivos] = useState<Objetivo[]>([])
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState<Objetivo | { nuevo: true; usuario_id: string } | null>(null)
  const [f, setF] = useState({ titulo: '', descripcion: '', progreso: 0, fecha_fin: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function cargar() {
    const [us, ob] = await Promise.all([cargarUsuarios(), supabase.from('mkt_objetivos').select('*').order('fecha_fin', { ascending: true, nullsFirst: false }).order('creado_en', { ascending: true })])
    setUsuarios(us); setObjetivos((ob.data as Objetivo[]) || []); setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  function abrir(o: Objetivo | { nuevo: true; usuario_id: string }) {
    setError('')
    setF('nuevo' in o ? { titulo: '', descripcion: '', progreso: 0, fecha_fin: '' } : { titulo: o.titulo, descripcion: o.descripcion || '', progreso: o.progreso, fecha_fin: o.fecha_fin || '' })
    setEditando(o)
  }

  async function guardar() {
    if (!editando || !f.titulo.trim() || guardando) return
    setGuardando(true); setError('')
    const payload = { titulo: f.titulo.trim(), descripcion: f.descripcion.trim() || null, progreso: f.progreso, fecha_fin: f.fecha_fin || null, actualizado_en: new Date().toISOString() }
    const { error: e } = 'nuevo' in editando
      ? await supabase.from('mkt_objetivos').insert({ ...payload, usuario_id: editando.usuario_id, creado_por: usuario?.id })
      : await supabase.from('mkt_objetivos').update(payload).eq('id', editando.id)
    setGuardando(false)
    if (e) { setError('No se pudo guardar. Probá de nuevo.'); return }
    setEditando(null); cargar()
  }

  async function borrar() {
    if (!editando || 'nuevo' in editando) return
    if (!confirm('¿Borrar este objetivo?')) return
    await supabase.from('mkt_objetivos').delete().eq('id', editando.id)
    setEditando(null); cargar()
  }

  async function ajustar(o: Objetivo, delta: number) {
    const progreso = Math.max(0, Math.min(100, o.progreso + delta))
    if (progreso === o.progreso) return
    setObjetivos(prev => prev.map(x => (x.id === o.id ? { ...x, progreso } : x)))
    await supabase.from('mkt_objetivos').update({ progreso, actualizado_en: new Date().toISOString() }).eq('id', o.id)
  }

  if (!usuario) return null
  // Cada persona edita solo sus objetivos; el coordinador, todos (lo exige también la base de datos)
  const puedeEditar = (uid: string) => !!permisos?.es_coord || usuario.id === uid

  const total = objetivos.length
  const logrados = objetivos.filter(o => o.progreso >= 100).length
  const btnMini: React.CSSProperties = { minWidth: 36, minHeight: 36, border: '1.5px solid var(--border)', borderRadius: 8, background: 'var(--bg-card)', color: 'var(--text)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: 'clamp(1.25rem, 4vw, 1.6rem)', fontWeight: 700, color: 'var(--text)' }}>🎯 Objetivos</h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>
          {cargando ? 'Cargando…' : total === 0 ? 'Todavía no hay objetivos cargados.' : `${total} objetivo${total === 1 ? '' : 's'} · ${logrados} cumplido${logrados === 1 ? '' : 's'}`}{permisos?.es_coord ? '' : ' · Cada uno carga y edita los suyos.'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 14, alignItems: 'start' }}>
        {usuarios.map(u => {
          const mios = objetivos.filter(o => o.usuario_id === u.id)
          const prom = mios.length ? Math.round(mios.reduce((s, o) => s + o.progreso, 0) / mios.length) : 0
          return (
            <section key={u.id} aria-label={`Objetivos de ${u.nombre}`} style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: u.avatar_color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>{u.avatar_emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, color: 'var(--text)' }}>{u.nombre}</p>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{mios.length ? `${mios.length} objetivo${mios.length === 1 ? '' : 's'} · promedio ${prom}%` : 'Sin objetivos'}</p>
                </div>
                {puedeEditar(u.id) && <button onClick={() => abrir({ nuevo: true, usuario_id: u.id })} style={{ ...btnMini, padding: '0 12px', color: '#f15922', borderColor: '#f15922' }}>+ Objetivo</button>}
              </div>

              {mios.length > 0 && <div style={{ marginBottom: 12 }}><Barra valor={prom} /></div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {mios.map(o => {
                  const d = o.fecha_fin ? diasPara(o.fecha_fin) : null
                  const hecho = o.progreso >= 100
                  const vence = d === null ? 'Sin fecha de finalización' : hecho ? `Cierre: ${fechaCorta(o.fecha_fin)}` : d < 0 ? `Vencido hace ${-d} día${d === -1 ? '' : 's'}` : d === 0 ? 'Vence hoy' : `Finaliza ${fechaCorta(o.fecha_fin)} · en ${d} día${d === 1 ? '' : 's'}`
                  return (
                    <div key={o.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text)', textDecoration: hecho ? 'line-through' : 'none', opacity: hecho ? 0.7 : 1, overflowWrap: 'anywhere' }}>{hecho && '✅ '}{o.titulo}</p>
                          {o.descripcion && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2, overflowWrap: 'anywhere' }}>{o.descripcion}</p>}
                        </div>
                        {puedeEditar(o.usuario_id) && <button onClick={() => abrir(o)} aria-label={`Editar ${o.titulo}`} style={btnMini}>✏️</button>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <div style={{ flex: 1 }}><Barra valor={o.progreso} /></div>
                        <strong style={{ fontSize: '0.8rem', color: colorProgreso(o.progreso), minWidth: 38, textAlign: 'right' }}>{o.progreso}%</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.72rem', color: d !== null && d < 0 && !hecho ? '#ef4444' : 'var(--text-muted)' }}>📅 {vence}</span>
                        {puedeEditar(o.usuario_id) && <span style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => ajustar(o, -10)} aria-label="Bajar 10%" style={btnMini}>−10</button>
                          <button onClick={() => ajustar(o, 10)} aria-label="Subir 10%" style={btnMini}>+10</button>
                        </span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      {editando && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '0.75rem' }} onClick={e => { if (e.target === e.currentTarget) setEditando(null) }}>
          <div className="modal-sheet" style={{ backgroundColor: 'var(--bg-card)', borderRadius: 16, padding: '1.25rem', width: '100%', maxWidth: 480, maxHeight: '94vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text)' }}>
              {'nuevo' in editando ? `Nuevo objetivo · ${usuarios.find(u => u.id === editando.usuario_id)?.nombre}` : 'Editar objetivo'}
            </h2>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Objetivo *</label>
            <input value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })} placeholder="Ej: Lanzar la grilla de cursos 2027" style={{ ...inp, marginBottom: 12 }} />
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Detalle (opcional)</label>
            <textarea value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} rows={3} style={{ ...inp, marginBottom: 12, resize: 'vertical', fontFamily: 'inherit' }} />
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Progreso: {f.progreso}%</label>
            <input type="range" min={0} max={100} step={5} value={f.progreso} onChange={e => setF({ ...f, progreso: +e.target.value })} style={{ width: '100%', accentColor: '#f15922', marginBottom: 12 }} />
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Fecha de finalización</label>
            <input type="date" value={f.fecha_fin} onChange={e => setF({ ...f, fecha_fin: e.target.value })} style={{ ...inp, marginBottom: 6 }} />
            {f.fecha_fin && <button type="button" onClick={() => setF({ ...f, fecha_fin: '' })} style={{ background: 'none', border: 'none', padding: 0, color: '#f15922', fontSize: '0.75rem', cursor: 'pointer', marginBottom: 8 }}>Quitar fecha</button>}
            {error && <p role="alert" style={{ color: '#ef4444', fontSize: '0.8rem', margin: '8px 0' }}>{error}</p>}
            <div className="modal-actions" style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              {!('nuevo' in editando) && <button onClick={borrar} style={{ padding: '0.65rem 0.9rem', border: '1.5px solid #fecaca', borderRadius: 8, background: 'var(--bg-card)', color: '#ef4444', cursor: 'pointer', fontSize: '0.875rem' }}>Borrar</button>}
              <button onClick={() => setEditando(null)} style={{ flex: 1, padding: '0.65rem', border: '1.5px solid var(--border)', borderRadius: 8, backgroundColor: 'var(--bg-card)', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text)' }}>Cancelar</button>
              <button onClick={guardar} disabled={!f.titulo.trim() || guardando} style={{ flex: 2, padding: '0.65rem', border: 'none', borderRadius: 8, backgroundColor: '#f15922', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, opacity: !f.titulo.trim() || guardando ? 0.6 : 1 }}>{guardando ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
