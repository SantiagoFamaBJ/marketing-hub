'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Tarea, Usuario, Permisos, estaCerrada, estadoInfo, prioridadInfo, vencida, fechaCorta, hoyISO, isoLocal, sumarDias,
  reasignarTarea, reprogramarTarea,
} from '@/lib/tareas'

const LIMITE_CARGA = 8
const LIMITE_DIA = 4

type Props = { tareas: Tarea[]; usuarios: Usuario[]; usuario: Usuario; permisos: Permisos; onOpen: (id: string) => void; onChanged: () => void }

const selMini: React.CSSProperties = { width: '100%', fontSize: '0.72rem', padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)' }

// ───────── A) Por persona: carga de trabajo y reasignación ─────────
export function VistaPersona({ tareas, usuarios, usuario, permisos, onOpen, onChanged }: Props) {
  const puedeReasignar = !!permisos.asignar_a_otros
  const hoy = hoyISO()
  const abiertas = tareas.filter(t => !estaCerrada(t.estado))
  const sinResp = abiertas.filter(t => !t.responsable_id)

  async function reasignar(t: Tarea, id: string) {
    const u = usuarios.find(x => x.id === id); if (!u) return
    await reasignarTarea(t, id, usuario, u.nombre); onChanged()
  }

  const columnas = [...usuarios.map(u => ({ u, items: abiertas.filter(t => t.responsable_id === u.id) })), ...(sinResp.length ? [{ u: null as Usuario | null, items: sinResp }] : [])]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, alignItems: 'start' }}>
      {columnas.map(({ u, items }) => {
        const venc = items.filter(t => t.deadline < hoy).length
        const rev = items.filter(t => t.estado === 'para_revision').length
        const colab = u ? abiertas.filter(t => t.responsable_id !== u.id && t.asignados.some(a => a.id === u.id)).length : 0
        const total = items.length + colab
        return (
          <div key={u?.id || 'sin'} style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ width: 34, height: 34, borderRadius: '50%', backgroundColor: u?.avatar_color || '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.05rem' }}>{u?.avatar_emoji || '❔'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>{u?.nombre || 'Sin responsable'}</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{items.length} a cargo{colab > 0 ? ` · ${colab} colaborando` : ''}{venc > 0 && <span style={{ color: '#ef4444' }}> · {venc} vencida{venc > 1 ? 's' : ''}</span>}{rev > 0 ? ` · ${rev} en revisión` : ''}</p>
              </div>
            </div>
            <div style={{ height: 6, borderRadius: 99, backgroundColor: 'var(--border)', overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ width: `${Math.min(100, (total / LIMITE_CARGA) * 100)}%`, height: '100%', backgroundColor: total > LIMITE_CARGA ? '#ef4444' : total > LIMITE_CARGA * 0.7 ? '#f59e0b' : '#10b981' }} />
            </div>
            {total > LIMITE_CARGA && <p style={{ fontSize: '0.7rem', color: '#ef4444', marginBottom: 6 }}>⚠️ Posible sobrecarga: considerá reasignar.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {items.sort((a, b) => a.deadline.localeCompare(b.deadline)).map(t => {
                const p = prioridadInfo(t.prioridad), e = estadoInfo(t.estado)
                return (
                  <div key={t.id} style={{ border: `1px solid ${vencida(t) ? '#fecaca' : 'var(--border)'}`, borderLeft: `3px solid ${p.color}`, borderRadius: 8, padding: '0.5rem 0.6rem' }}>
                    <p onClick={() => onOpen(t.id)} style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', cursor: 'pointer', marginBottom: 3 }}>{t.titulo}</p>
                    <p style={{ fontSize: '0.68rem', color: vencida(t) ? '#ef4444' : 'var(--text-muted)', marginBottom: puedeReasignar ? 5 : 0 }}>📅 {fechaCorta(t.deadline)} · <span style={{ color: e.color, fontWeight: 600 }}>{e.label}</span></p>
                    {puedeReasignar && (
                      <select value={t.responsable_id || ''} onChange={ev => reasignar(t, ev.target.value)} style={selMini}>
                        {!t.responsable_id && <option value="">Sin responsable</option>}
                        {usuarios.map(x => <option key={x.id} value={x.id}>Responsable: {x.nombre}</option>)}
                      </select>
                    )}
                  </div>
                )
              })}
              {items.length === 0 && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem' }}>Sin tareas a cargo 🎉</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ───────── B) Bandeja de aprobaciones ─────────
type Adj = { id: string; tarea_id: string; nombre_archivo: string; url: string; tipo: string | null; version: number }

export function VistaAprobaciones({ tareas, permisos, onOpen }: Props) {
  const [adjuntos, setAdjuntos] = useState<Adj[]>([])
  const pendientes = tareas.filter(t => t.estado === 'para_revision').sort((a, b) => (a.enviada_revision_en || '').localeCompare(b.enviada_revision_en || ''))
  const correcciones = tareas.filter(t => t.estado === 'correcciones')
  const aprobadas = tareas.filter(t => t.aprobada_en && t.aprobada_en.slice(0, 10) >= sumarDias(-7)).sort((a, b) => (b.aprobada_en || '').localeCompare(a.aprobada_en || ''))
  const ids = useMemo(() => [...pendientes, ...correcciones].map(t => t.id), [tareas])

  useEffect(() => {
    if (ids.length === 0) { setAdjuntos([]); return }
    supabase.from('mkt_tarea_adjuntos').select('id, tarea_id, nombre_archivo, url, tipo, version').in('tarea_id', ids).then(({ data }) => setAdjuntos(data || []))
  }, [ids.join(',')])

  const dias = (t: Tarea) => t.enviada_revision_en ? Math.max(0, Math.floor((Date.now() - new Date(t.enviada_revision_en).getTime()) / 86400000)) : 0

  const Fila = ({ t, accion }: { t: Tarea; accion: string }) => {
    const adj = adjuntos.filter(a => a.tarea_id === t.id)
    const vmax = adj.reduce((m, a) => Math.max(m, a.version || 1), 1)
    const ult = adj.filter(a => (a.version || 1) === vmax)
    const prev = adj.length - ult.length
    return (
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border)', borderLeft: '4px solid #8b5cf6', borderRadius: 10, padding: '0.75rem 0.9rem', marginBottom: 8 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>{t.titulo}</p>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {t.responsable?.nombre || 'Sin responsable'} · vence {fechaCorta(t.deadline)}
              {t.estado === 'para_revision' && <> · esperando hace {dias(t) === 0 ? 'menos de 1 día' : `${dias(t)} día${dias(t) > 1 ? 's' : ''}`}{dias(t) >= 2 && <span style={{ color: '#ef4444' }}> ⚠️</span>}</>}
            </p>
          </div>
          <button onClick={() => onOpen(t.id)} style={{ padding: '0.4rem 0.9rem', border: 'none', borderRadius: 8, backgroundColor: '#8b5cf6', color: '#fff', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer' }}>{accion}</button>
        </div>
        {ult.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {ult.map(a => <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: '#f15922', border: '1px solid var(--border)', borderRadius: 99, padding: '2px 10px', textDecoration: 'none', fontWeight: 600 }}>{a.tipo === 'link' ? '🔗' : '📎'} {a.nombre_archivo.slice(0, 32)}</a>)}
            {vmax > 1 && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', alignSelf: 'center' }}>v{vmax}{prev > 0 ? ` · ${prev} de versiones anteriores en la tarea` : ''}</span>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>🔁 {permisos.aprobar_tareas ? 'Para aprobar' : 'En revisión'} ({pendientes.length})</h3>
      {pendientes.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', border: '1.5px dashed var(--border)', borderRadius: 10, padding: '1rem', textAlign: 'center' }}>No hay entregas esperando revisión 🎉</p>}
      {pendientes.map(t => <Fila key={t.id} t={t} accion={permisos.aprobar_tareas ? 'Revisar' : 'Ver'} />)}
      {correcciones.length > 0 && <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text)', margin: '18px 0 8px' }}>✏️ Con correcciones pedidas ({correcciones.length})</h3>}
      {correcciones.map(t => <Fila key={t.id} t={t} accion="Abrir" />)}
      {aprobadas.length > 0 && (
        <>
          <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text)', margin: '18px 0 8px' }}>✅ Aprobadas esta semana ({aprobadas.length})</h3>
          {aprobadas.map(t => (
            <div key={t.id} onClick={() => onOpen(t.id)} style={{ cursor: 'pointer', padding: '0.5rem 0.9rem', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6, fontSize: '0.82rem', color: 'var(--text)', backgroundColor: 'var(--bg-card)' }}>
              {t.titulo} <span style={{ color: 'var(--text-muted)' }}>· {t.responsable?.nombre.split(' ')[0]} · {fechaCorta((t.aprobada_en || '').slice(0, 10))}</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ───────── C) Planificación semanal ─────────
export function VistaSemana({ tareas, usuarios, usuario, permisos, onOpen, onChanged }: Props) {
  const [offset, setOffset] = useState(0)
  const hoy = hoyISO()
  const lunes = useMemo(() => {
    const d = new Date(); d.setHours(12, 0, 0, 0)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7)
    return d
  }, [offset])
  const dias = Array.from({ length: 7 }, (_, i) => { const d = new Date(lunes); d.setDate(lunes.getDate() + i); return isoLocal(d) })
  const inicio = dias[0], fin = dias[6]
  const abiertas = tareas.filter(t => !estaCerrada(t.estado))
  const atrasadas = abiertas.filter(t => t.deadline < inicio && t.deadline < hoy).sort((a, b) => a.deadline.localeCompare(b.deadline))
  const puedeMover = (t: Tarea) => t.asignados.some(a => a.id === usuario.id) || t.creado_por === usuario.id || !!permisos.aprobar_tareas

  const cargaPersona = usuarios.map(u => ({ u, n: abiertas.filter(t => t.deadline >= inicio && t.deadline <= fin && t.responsable_id === u.id).length })).filter(x => x.n > 0)

  async function mover(t: Tarea, dias: number) {
    await reprogramarTarea(t, sumarDias(dias, new Date(t.deadline + 'T12:00:00')), usuario); onChanged()
  }
  async function aHoy(t: Tarea) { await reprogramarTarea(t, hoy, usuario); onChanged() }

  const etiquetaSemana = `${fechaCorta(inicio)} – ${fechaCorta(fin)}`
  const nav: React.CSSProperties = { border: '1.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', borderRadius: 8, height: 32, padding: '0 12px', cursor: 'pointer' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <button onClick={() => setOffset(offset - 1)} style={nav}>‹</button>
        <strong style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{offset === 0 ? 'Esta semana' : offset === 1 ? 'Semana próxima' : offset === -1 ? 'Semana pasada' : 'Semana'} · {etiquetaSemana}</strong>
        <button onClick={() => setOffset(offset + 1)} style={nav}>›</button>
        {offset !== 0 && <button onClick={() => setOffset(0)} style={{ ...nav, fontSize: '0.78rem' }}>Hoy</button>}
      </div>

      {cargaPersona.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {cargaPersona.map(({ u, n }) => (
            <span key={u.id} style={{ fontSize: '0.72rem', border: `1px solid ${n > 6 ? '#ef444466' : 'var(--border)'}`, color: n > 6 ? '#ef4444' : 'var(--text-muted)', borderRadius: 99, padding: '3px 10px' }}>{u.avatar_emoji} {u.nombre.split(' ')[0]}: {n}{n > 6 ? ' ⚠️' : ''}</span>
          ))}
        </div>
      )}

      {atrasadas.length > 0 && offset >= 0 && (
        <div style={{ border: '1.5px solid #fecaca', borderRadius: 10, padding: '0.7rem 0.8rem', marginBottom: 12, backgroundColor: 'rgba(239,68,68,0.06)' }}>
          <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>⏮️ Pendientes de semanas anteriores ({atrasadas.length})</p>
          {atrasadas.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', flexWrap: 'wrap' }}>
              <span onClick={() => onOpen(t.id)} style={{ flex: '1 1 160px', fontSize: '0.8rem', color: 'var(--text)', cursor: 'pointer' }}>{t.titulo} <span style={{ color: 'var(--text-muted)' }}>· {t.responsable?.nombre.split(' ')[0]} · {fechaCorta(t.deadline)}</span></span>
              {puedeMover(t) && <button onClick={() => aHoy(t)} style={{ fontSize: '0.7rem', padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', cursor: 'pointer' }}>Pasar a hoy</button>}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8, alignItems: 'start' }}>
        {dias.map(d => {
          const del = tareas.filter(t => t.deadline === d).sort((a, b) => prioridadInfo(a.prioridad).rank - prioridadInfo(b.prioridad).rank)
          const abiertasDia = del.filter(t => !estaCerrada(t.estado)).length
          const sobre = abiertasDia > LIMITE_DIA
          const esHoy = d === hoy
          return (
            <div key={d} style={{ border: `1.5px solid ${esHoy ? '#f15922' : 'var(--border)'}`, borderRadius: 10, padding: '0.5rem', backgroundColor: 'var(--bg-card)', minHeight: 90 }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: esHoy ? '#f15922' : 'var(--text)', textTransform: 'capitalize', marginBottom: 6 }}>
                {new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })}
                {sobre && <span style={{ color: '#f59e0b', fontWeight: 600 }}> · carga alta</span>}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {del.map(t => {
                  const p = prioridadInfo(t.prioridad), cerrada = estaCerrada(t.estado)
                  const recurrente = !!(t.recurrencia || t.recurrencia_origen_id)
                  return (
                    <div key={t.id} style={{ border: '1px solid var(--border)', borderLeft: `3px solid ${cerrada ? '#10b981' : p.color}`, borderRadius: 7, padding: '4px 6px', opacity: cerrada ? 0.55 : 1 }}>
                      <p onClick={() => onOpen(t.id)} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)', cursor: 'pointer', textDecoration: cerrada ? 'line-through' : 'none' }}>{t.titulo}</p>
                      <p style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>{recurrente ? '🔁 Recurrente' : '⚡ Extra'} · {t.responsable?.nombre.split(' ')[0] || '—'}</p>
                      {!cerrada && puedeMover(t) && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                          <button onClick={() => mover(t, -1)} aria-label="Un día antes" style={miniBtn}>◀</button>
                          <button onClick={() => mover(t, 1)} aria-label="Un día después" style={miniBtn}>▶</button>
                        </div>
                      )}
                    </div>
                  )
                })}
                {del.length === 0 && <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>—</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
const miniBtn: React.CSSProperties = { fontSize: '0.62rem', padding: '1px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer' }
