'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useSesion } from '@/lib/useSesion'
import {
  Tarea, Usuario, cargarTareas, cargarUsuarios, estaCerrada, prioridadInfo, estadoInfo, vencida, fechaCorta, hoyISO, sumarDias,
  generarAvisosVencimiento, esMia,
} from '@/lib/tareas'
import TareaDetalle from '@/components/TareaDetalle'

const LIMITE_CARGA = 8 // tareas abiertas por persona a partir de las cuales se avisa de sobrecarga

type Evento = { id: string; titulo: string; tipo: string; fecha_inicio: string; color: string | null }
type Hist = { id: string; usuario_id: string; tarea_titulo: string; accion: string; detalle: string | null; creado_en: string }
const ACCION: Record<string, string> = {
  tarea_creada: 'creó', tarea_editada: 'editó', tarea_movida: 'movió', tarea_eliminada: 'eliminó', comentario_agregado: 'comentó en',
  revision_enviada: 'envió a revisión', tarea_aprobada: 'aprobó', correcciones_pedidas: 'pidió correcciones en', tarea_reasignada: 'reasignó',
}

export default function DashboardPage() {
  const { usuario, permisos } = useSesion()
  const router = useRouter()
  const [modo, setModo] = useState<'mi' | 'equipo'>('mi')
  const [periodo, setPeriodo] = useState(30)
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [eventos, setEventos] = useState<Evento[]>([])
  const [campanas, setCampanas] = useState<any[]>([])
  const [hist, setHist] = useState<Hist[]>([])
  const [detalleId, setDetalleId] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => { if (usuario && permisos) cargar() }, [usuario?.id, permisos])

  async function cargar() {
    if (!usuario || !permisos) return
    const hoy = hoyISO()
    const [t, u, ev, ca, h] = await Promise.all([
      cargarTareas({ usuarioId: usuario.id, soloMias: !permisos.ver_todas_tareas }),
      cargarUsuarios(),
      supabase.from('mkt_eventos').select('id, titulo, tipo, fecha_inicio, color').gte('fecha_inicio', hoy).lte('fecha_inicio', sumarDias(14)).order('fecha_inicio').limit(6),
      supabase.from('mkt_campanas').select('id, nombre, fecha_inicio, fecha_fin, estado').eq('estado', 'activa').order('fecha_fin').limit(4),
      supabase.from('mkt_historial').select('*').order('creado_en', { ascending: false }).limit(6),
    ])
    setTareas(t); setUsuarios(u); setEventos(ev.data || []); setCampanas(ca.data || []); setHist(h.data || [])
    setCargando(false)
    generarAvisosVencimiento(usuario.id, t)
  }

  const verEquipo = modo === 'equipo' && !!permisos?.ver_dashboard_equipo
  const base = useMemo(() => (verEquipo || !usuario ? tareas : tareas.filter(t => t.responsable_id === usuario.id || t.asignados.some(a => a.id === usuario.id))), [tareas, verEquipo, usuario])
  const hoy = hoyISO(), en3 = sumarDias(3)

  const k = useMemo(() => {
    const abiertas = base.filter(t => !estaCerrada(t.estado))
    const desde = sumarDias(-periodo)
    return {
      pendientes: abiertas.filter(t => t.estado === 'pendiente').length,
      proceso: abiertas.filter(t => t.estado === 'en_proceso' || t.estado === 'correcciones').length,
      vencidas: abiertas.filter(t => t.deadline < hoy).length,
      pronto: abiertas.filter(t => t.deadline >= hoy && t.deadline <= en3).length,
      revision: base.filter(t => t.estado === 'para_revision').length,
      finalizadas: base.filter(t => estaCerrada(t.estado) && (t.finalizada_en || t.actualizado_en || '').slice(0, 10) >= desde).length,
      abiertas,
    }
  }, [base, periodo, hoy, en3])

  const prioritarias = k.abiertas
    .filter(t => t.prioridad === 'urgente' || t.prioridad === 'alta' || t.deadline <= en3)
    .sort((a, b) => a.deadline.localeCompare(b.deadline) || prioridadInfo(a.prioridad).rank - prioridadInfo(b.prioridad).rank)
    .slice(0, 6)
  const pendAprob = tareas.filter(t => t.estado === 'para_revision').sort((a, b) => (a.enviada_revision_en || '').localeCompare(b.enviada_revision_en || ''))

  // Carga por persona (equipo)
  const carga = usuarios.map(u => {
    const ab = tareas.filter(t => !estaCerrada(t.estado) && t.asignados.some(a => a.id === u.id))
    return { u, abiertas: ab.length, vencidas: ab.filter(t => t.deadline < hoy).length, revision: ab.filter(t => t.estado === 'para_revision').length }
  })

  // Alertas
  const alertas: { txt: string; color: string }[] = []
  if (k.vencidas > 0) alertas.push({ txt: `${k.vencidas} tarea${k.vencidas > 1 ? 's' : ''} vencida${k.vencidas > 1 ? 's' : ''}`, color: '#ef4444' })
  const bloq = base.filter(t => t.estado === 'bloqueada').length
  if (bloq > 0) alertas.push({ txt: `${bloq} bloqueada${bloq > 1 ? 's' : ''}`, color: '#374151' })
  if (verEquipo) {
    carga.filter(c => c.abiertas > LIMITE_CARGA).forEach(c => alertas.push({ txt: `${c.u.nombre} tiene ${c.abiertas} tareas abiertas (posible sobrecarga)`, color: '#f59e0b' }))
    const sinResp = tareas.filter(t => !estaCerrada(t.estado) && !t.responsable_id).length
    if (sinResp > 0) alertas.push({ txt: `${sinResp} tarea${sinResp > 1 ? 's' : ''} sin responsable`, color: '#f59e0b' })
    const viejas = pendAprob.filter(t => t.enviada_revision_en && t.enviada_revision_en.slice(0, 10) <= sumarDias(-2)).length
    if (viejas > 0) alertas.push({ txt: `${viejas} revisión${viejas > 1 ? 'es' : ''} esperando hace más de 2 días`, color: '#8b5cf6' })
  }

  if (!usuario || !permisos) return null
  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
  const detalle = tareas.find(t => t.id === detalleId) || null

  const kpis = [
    { l: 'Pendientes', v: k.pendientes, c: '#6b7280' },
    { l: 'En proceso', v: k.proceso, c: '#f59e0b' },
    { l: 'Vencidas', v: k.vencidas, c: '#ef4444' },
    { l: 'Vencen pronto', v: k.pronto, c: '#f97316' },
    { l: permisos.aprobar_tareas ? 'Por aprobar' : 'En revisión', v: k.revision, c: '#8b5cf6' },
    { l: `Finalizadas (${periodo}d)`, v: k.finalizadas, c: '#10b981' },
  ]

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.25rem, 4vw, 1.6rem)', fontWeight: 700, color: 'var(--text)' }}>{saludo}, {usuario.nombre.split(' ')[0]} {usuario.avatar_emoji}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {permisos.ver_dashboard_equipo && (
            <div style={{ display: 'flex', border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {([['mi', 'Mi dashboard'], ['equipo', 'Equipo']] as const).map(([m, l]) => (
                <button key={m} onClick={() => setModo(m)} style={{ padding: '0.4rem 0.9rem', border: 'none', cursor: 'pointer', fontSize: '0.8rem', backgroundColor: modo === m ? '#f15922' : 'var(--bg-card)', color: modo === m ? '#fff' : 'var(--text-muted)', fontWeight: modo === m ? 600 : 400 }}>{l}</button>
              ))}
            </div>
          )}
          <select value={periodo} onChange={e => setPeriodo(Number(e.target.value))} style={{ padding: '0.4rem 0.6rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--text)', backgroundColor: 'var(--input-bg)' }}>
            <option value={7}>Últimos 7 días</option><option value={30}>Últimos 30 días</option><option value={90}>Últimos 90 días</option>
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 10, marginBottom: '1.5rem' }}>
        {kpis.map(x => (
          <div key={x.l} style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '0.85rem 1rem' }}>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>{x.l}</p>
            <p style={{ fontSize: '1.7rem', fontWeight: 700, color: x.c, lineHeight: 1 }}>{cargando ? '–' : x.v}</p>
          </div>
        ))}
      </div>

      {alertas.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {alertas.map((a, i) => <span key={i} style={{ fontSize: '0.78rem', fontWeight: 600, color: a.color, backgroundColor: a.color + '14', border: `1px solid ${a.color}44`, padding: '5px 12px', borderRadius: 99 }}>⚠️ {a.txt}</span>)}
        </div>
      )}

      <div className="dash-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: '1.25rem', alignItems: 'start' }}>
        <div>
          <Seccion titulo={verEquipo ? '🎯 Prioritarias del equipo' : '🎯 Mis prioridades'} vacio="Todo al día 🎉">
            {prioritarias.map(t => <FilaTarea key={t.id} t={t} onClick={() => setDetalleId(t.id)} mostrarResp={verEquipo} />)}
          </Seccion>

          {(pendAprob.length > 0 && (permisos.aprobar_tareas || verEquipo)) && (
            <Seccion titulo={`🔁 ${permisos.aprobar_tareas ? 'Entregas pendientes de aprobación' : 'En revisión'}`} vacio="">
              {pendAprob.map(t => <FilaTarea key={t.id} t={t} onClick={() => setDetalleId(t.id)} mostrarResp />)}
            </Seccion>
          )}

          {verEquipo && (
            <Seccion titulo="👥 Actividad del equipo" vacio="">
              {carga.map(c => (
                <div key={c.u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 0.8rem', border: '1.5px solid var(--border)', borderRadius: 10, backgroundColor: 'var(--bg-card)', marginBottom: 6 }}>
                  <span style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: c.u.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>{c.u.avatar_emoji}</span>
                  <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>{c.u.nombre}</span>
                  <div style={{ width: 90, height: 6, borderRadius: 99, backgroundColor: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, (c.abiertas / LIMITE_CARGA) * 100)}%`, height: '100%', backgroundColor: c.abiertas > LIMITE_CARGA ? '#ef4444' : c.abiertas > LIMITE_CARGA * 0.7 ? '#f59e0b' : '#10b981' }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: 78, textAlign: 'right' }}>{c.abiertas} abiertas{c.vencidas > 0 && <span style={{ color: '#ef4444' }}> · {c.vencidas} venc.</span>}</span>
                </div>
              ))}
            </Seccion>
          )}
        </div>

        <div>
          <Seccion titulo="📅 Próximos eventos y campañas" vacio="Nada en los próximos 14 días.">
            {eventos.map(e => (
              <Fila key={e.id} c={e.color || '#f15922'} t={e.titulo} s={`${fechaCorta(e.fecha_inicio)} · ${e.tipo}`} onClick={() => router.push(`/u/${usuario.slug}/calendario`)} />
            ))}
            {permisos.gestionar_campanas && campanas.map(c => (
              <Fila key={c.id} c="#f15922" t={`📣 ${c.nombre}`} s={c.fecha_fin ? `Termina ${fechaCorta(c.fecha_fin)}` : 'Activa'} onClick={() => router.push(`/u/${usuario.slug}/campanas`)} />
            ))}
          </Seccion>

          <Seccion titulo="🕐 Actividad reciente" vacio="Sin actividad todavía.">
            {hist.map(h => {
              const u = usuarios.find(x => x.id === h.usuario_id)
              return (
                <p key={h.id} style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '6px 2px', borderBottom: '1px solid var(--border)' }}>
                  <strong style={{ color: 'var(--text)' }}>{u?.nombre.split(' ')[0] || 'Alguien'}</strong> {ACCION[h.accion] || h.accion} <em>{h.tarea_titulo}</em>
                </p>
              )
            })}
          </Seccion>
        </div>
      </div>

      {detalle && (
        <TareaDetalle tarea={detalle} usuario={usuario} usuarios={usuarios} permisos={permisos}
          onClose={() => setDetalleId(null)} onChanged={cargar}
          onEditar={() => router.push(`/u/${usuario.slug}/tareas`)} />
      )}
      <style>{`@media (max-width: 820px) { .dash-grid { grid-template-columns: minmax(0, 1fr) !important; } }`}</style>
    </div>
  )
}

function Seccion({ titulo, vacio, children }: { titulo: string; vacio: string; children: React.ReactNode }) {
  const hijos = Array.isArray(children) ? children.flat().filter(Boolean) : children ? [children] : []
  if (hijos.length === 0 && !vacio) return null
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h2 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>{titulo}</h2>
      {hijos.length === 0 ? <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '1rem', textAlign: 'center', border: '1.5px dashed var(--border)', borderRadius: 10 }}>{vacio}</p> : children}
    </div>
  )
}

function Fila({ c, t, s, onClick }: { c: string; t: string; s: string; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 0.8rem', border: '1.5px solid var(--border)', borderRadius: 10, backgroundColor: 'var(--bg-card)', marginBottom: 6, cursor: 'pointer' }}>
      <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, backgroundColor: c }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t}</p>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s}</p>
      </div>
    </div>
  )
}

function FilaTarea({ t, onClick, mostrarResp }: { t: Tarea; onClick: () => void; mostrarResp?: boolean }) {
  const p = prioridadInfo(t.prioridad), e = estadoInfo(t.estado)
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.65rem 0.85rem', border: `1.5px solid ${vencida(t) ? '#fecaca' : 'var(--border)'}`, borderLeft: `4px solid ${p.color}`, borderRadius: 10, backgroundColor: 'var(--bg-card)', marginBottom: 6, cursor: 'pointer', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 150px', minWidth: 0 }}>
        <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>{t.titulo}</p>
        <p style={{ fontSize: '0.72rem', color: vencida(t) ? '#ef4444' : 'var(--text-muted)' }}>📅 {fechaCorta(t.deadline)}{vencida(t) && ' · Vencida'}{mostrarResp && t.responsable ? ` · ${t.responsable.nombre.split(' ')[0]}` : ''}</p>
      </div>
      <span style={{ fontSize: '0.65rem', fontWeight: 700, backgroundColor: e.bg, color: e.color, padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap' }}>{e.label}</span>
    </div>
  )
}
