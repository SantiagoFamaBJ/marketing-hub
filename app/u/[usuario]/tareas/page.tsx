'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSesion } from '@/lib/useSesion'
import {
  Tarea, Usuario, Etiqueta, ESTADOS, PRIORIDADES, CATEGORIAS, estadoInfo, prioridadInfo, estaCerrada, vencida,
  cargarTareas, cargarUsuarios, esMia, fechaCorta, hoyISO, sumarDias, isoLocal, aplicarAccion,
} from '@/lib/tareas'
import TareaDetalle from '@/components/TareaDetalle'
import TareaForm from '@/components/TareaForm'

type Campana = { id: string; nombre: string; color: string }
type Vista = 'kanban' | 'lista' | 'calendario'

const sel: React.CSSProperties = { padding: '0.4rem 0.6rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--text)', backgroundColor: 'var(--input-bg)', outline: 'none', maxWidth: '100%' }

export default function TareasPage() {
  const { usuario, permisos } = useSesion()
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([])
  const [campanas, setCampanas] = useState<Campana[]>([])
  const [cargando, setCargando] = useState(true)
  const [vista, setVista] = useState<Vista>('kanban')
  const [detalleId, setDetalleId] = useState<string | null>(null)
  const [form, setForm] = useState<{ tarea: Tarea | null } | null>(null)
  const [etiquetaModal, setEtiquetaModal] = useState(false)
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState({ nombre: '', color: '#f15922' })
  const [masFiltros, setMasFiltros] = useState(false)
  const [f, setF] = useState({ q: '', resp: '', estado: '', prioridad: '', categoria: '', campana: '', etiqueta: '', desde: '', hasta: '', soloMias: false, antiguas: false })
  const [mes, setMes] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [diaSel, setDiaSel] = useState<string>(hoyISO())

  useEffect(() => { if (usuario && permisos) refrescar() }, [usuario?.id, permisos])

  async function refrescar() {
    if (!usuario || !permisos) return
    const [t, u, e, c] = await Promise.all([
      cargarTareas({ usuarioId: usuario.id, soloMias: !permisos.ver_todas_tareas }),
      cargarUsuarios(),
      supabase.from('mkt_etiquetas').select('*').order('nombre'),
      supabase.from('mkt_campanas').select('id, nombre, color').neq('estado', 'archivada'),
    ])
    setTareas(t); setUsuarios(u); setEtiquetas(e.data || []); setCampanas(c.data || [])
    setCargando(false)
  }

  async function crearEtiqueta() {
    if (!nuevaEtiqueta.nombre.trim() || !usuario) return
    await supabase.from('mkt_etiquetas').insert({ nombre: nuevaEtiqueta.nombre.trim(), color: nuevaEtiqueta.color, creado_por: usuario.id, es_predeterminada: false })
    setNuevaEtiqueta({ nombre: '', color: '#f15922' }); setEtiquetaModal(false)
    const { data } = await supabase.from('mkt_etiquetas').select('*').order('nombre'); setEtiquetas(data || [])
  }

  const filtradas = useMemo(() => {
    const limiteAntiguas = sumarDias(-30)
    const q = f.q.trim().toLowerCase()
    return tareas.filter(t => {
      if (q && !t.titulo.toLowerCase().includes(q)) return false
      if (f.soloMias && usuario && !esMia(t, usuario.id)) return false
      if (f.resp && !t.asignados.some(a => a.id === f.resp)) return false
      if (f.estado && t.estado !== f.estado) return false
      if (f.prioridad && t.prioridad !== f.prioridad) return false
      if (f.categoria && t.categoria !== f.categoria) return false
      if (f.campana && t.campana_id !== f.campana) return false
      if (f.etiqueta && !t.etiquetas.some(e => e.id === f.etiqueta)) return false
      if (f.desde && t.deadline < f.desde) return false
      if (f.hasta && t.deadline > f.hasta) return false
      if (!f.antiguas && estaCerrada(t.estado) && !f.estado && (t.finalizada_en || t.actualizado_en || t.deadline).slice(0, 10) < limiteAntiguas) return false
      return true
    })
  }, [tareas, f, usuario])

  const hayFiltros = f.q || f.resp || f.estado || f.prioridad || f.categoria || f.campana || f.etiqueta || f.desde || f.hasta || f.soloMias
  const detalle = tareas.find(t => t.id === detalleId) || null
  const campanaNombre = (id: string | null) => campanas.find(c => c.id === id)?.nombre

  async function moverRapido(t: Tarea, estado: string) {
    if (!usuario || estado === t.estado) return
    if (['finalizada', 'para_revision', 'correcciones'].includes(estado)) { setDetalleId(t.id); return } // requiere confirmación/nota
    await aplicarAccion({ tarea: t, accion: 'mover', actor: usuario, nuevoEstado: estado })
    refrescar()
  }

  if (!usuario || !permisos) return null
  const puedeEditar = (t: Tarea) => esMia(t, usuario.id) || !!permisos.aprobar_tareas
  const aprobarPend = tareas.filter(t => t.estado === 'para_revision').length

  return (
    <div>
      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ fontSize: 'clamp(1.25rem, 4vw, 1.6rem)', fontWeight: 700, color: 'var(--text)' }}>✅ Tareas</h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', border: '1.5px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {([['kanban', '⬛ Kanban'], ['lista', '☰ Lista'], ['calendario', '📅 Calendario']] as [Vista, string][]).map(([v, l]) => (
              <button key={v} onClick={() => setVista(v)} style={{ padding: '0.4rem 0.7rem', border: 'none', backgroundColor: vista === v ? '#f15922' : 'var(--bg-card)', color: vista === v ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: vista === v ? 600 : 400 }}>{l}</button>
            ))}
          </div>
          <button onClick={() => setForm({ tarea: null })} style={{ backgroundColor: '#f15922', color: '#fff', border: 'none', borderRadius: 8, padding: '0.45rem 1rem', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>+ Nueva</button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={f.q} onChange={e => setF({ ...f, q: e.target.value })} placeholder="🔍 Buscar..." style={{ ...sel, flex: '1 1 140px', minWidth: 120 }} />
        <button onClick={() => setF({ ...f, soloMias: !f.soloMias })} disabled={!permisos.ver_todas_tareas} style={{ ...sel, cursor: 'pointer', fontWeight: f.soloMias ? 700 : 400, color: f.soloMias ? '#f15922' : 'var(--text)', borderColor: f.soloMias ? '#f15922' : 'var(--border)' }}>Mis tareas</button>
        <select value={f.resp} onChange={e => setF({ ...f, resp: e.target.value })} style={sel}>
          <option value="">Todas las personas</option>
          {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
        <select value={f.estado} onChange={e => setF({ ...f, estado: e.target.value })} style={sel}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <button onClick={() => setMasFiltros(!masFiltros)} style={{ ...sel, cursor: 'pointer' }}>⚙️ {masFiltros ? 'Menos' : 'Más'}</button>
        {hayFiltros && <button onClick={() => setF({ ...f, q: '', resp: '', estado: '', prioridad: '', categoria: '', campana: '', etiqueta: '', desde: '', hasta: '', soloMias: false })} style={{ ...sel, cursor: 'pointer', color: '#ef4444', borderColor: '#fecaca', backgroundColor: '#fef2f2' }}>✕ Limpiar</button>}
        {aprobarPend > 0 && permisos.aprobar_tareas && (
          <button onClick={() => setF({ ...f, estado: f.estado === 'para_revision' ? '' : 'para_revision' })} style={{ ...sel, cursor: 'pointer', color: '#8b5cf6', borderColor: '#8b5cf6', fontWeight: 600 }}>🔁 Para aprobar ({aprobarPend})</button>
        )}
      </div>
      {masFiltros && (
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={f.prioridad} onChange={e => setF({ ...f, prioridad: e.target.value })} style={sel}>
            <option value="">Toda prioridad</option>
            {Object.entries(PRIORIDADES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={f.categoria} onChange={e => setF({ ...f, categoria: e.target.value })} style={sel}>
            <option value="">Toda categoría</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {campanas.length > 0 && (
            <select value={f.campana} onChange={e => setF({ ...f, campana: e.target.value })} style={sel}>
              <option value="">Toda campaña</option>
              {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          )}
          <select value={f.etiqueta} onChange={e => setF({ ...f, etiqueta: e.target.value })} style={sel}>
            <option value="">Toda etiqueta</option>
            {etiquetas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Vence desde <input type="date" value={f.desde} onChange={e => setF({ ...f, desde: e.target.value })} style={sel} /></label>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>hasta <input type="date" value={f.hasta} onChange={e => setF({ ...f, hasta: e.target.value })} style={sel} /></label>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}><input type="checkbox" checked={f.antiguas} onChange={e => setF({ ...f, antiguas: e.target.checked })} /> Finalizadas de +30 días</label>
        </div>
      )}
      <div style={{ height: 8 }} />

      {cargando && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Cargando...</p>}

      {/* KANBAN */}
      {!cargando && vista === 'kanban' && (
        <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.75rem', scrollSnapType: 'x proximity', alignItems: 'flex-start' }}>
          {ESTADOS.map(col => {
            const items = filtradas.filter(t => t.estado === col.key).sort((a, b) => prioridadInfo(a.prioridad).rank - prioridadInfo(b.prioridad).rank || a.deadline.localeCompare(b.deadline))
            return (
              <div key={col.key} style={{ flex: '0 0 270px', scrollSnapAlign: 'start', backgroundColor: 'var(--bg-card)', borderRadius: 12, padding: '0.75rem', border: '1.5px solid var(--border)', minHeight: 120 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: col.color }} />
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{col.label}</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '1px 8px', borderRadius: 99 }}>{items.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.map(t => <Card key={t.id} t={t} puedeEditar={puedeEditar(t)} onOpen={() => setDetalleId(t.id)} onMover={moverRapido} />)}
                  {items.length === 0 && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.75rem 0' }}>—</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* LISTA */}
      {!cargando && vista === 'lista' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtradas.length === 0 && <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No hay tareas con estos filtros.</div>}
          {filtradas.map(t => {
            const p = prioridadInfo(t.prioridad), e = estadoInfo(t.estado)
            return (
              <div key={t.id} onClick={() => setDetalleId(t.id)} style={{ backgroundColor: 'var(--bg-card)', border: `1.5px solid ${vencida(t) ? '#fecaca' : 'var(--border)'}`, borderRadius: 10, padding: '0.7rem 0.9rem', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, backgroundColor: p.bg, color: p.color, padding: '3px 9px', borderRadius: 99 }}>{p.label}</span>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', flex: '1 1 160px', minWidth: 0 }}>{t.titulo}</p>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, backgroundColor: e.bg, color: e.color, padding: '3px 9px', borderRadius: 99 }}>{e.label}</span>
                {t.subtareas.total > 0 && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>☑️ {t.subtareas.hechas}/{t.subtareas.total}</span>}
                <div style={{ display: 'flex', gap: 4 }}>
                  {t.asignados.map(a => <span key={a.id} title={a.nombre} style={{ fontSize: '0.68rem', backgroundColor: a.avatar_color + '22', color: a.avatar_color, padding: '2px 8px', borderRadius: 99, fontWeight: a.id === t.responsable_id ? 800 : 500, border: a.id === t.responsable_id ? `1px solid ${a.avatar_color}` : '1px solid transparent' }}>{a.nombre.split(' ')[0]}</span>)}
                </div>
                <span style={{ fontSize: '0.75rem', color: vencida(t) ? '#ef4444' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>📅 {fechaCorta(t.deadline)}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* CALENDARIO */}
      {!cargando && vista === 'calendario' && <CalendarioTareas tareas={filtradas} mes={mes} setMes={setMes} diaSel={diaSel} setDiaSel={setDiaSel} onOpen={id => setDetalleId(id)} />}

      {detalle && (
        <TareaDetalle tarea={detalle} usuario={usuario} usuarios={usuarios} permisos={permisos} campanaNombre={campanaNombre(detalle.campana_id)}
          onClose={() => setDetalleId(null)} onChanged={refrescar} onEditar={t => { setDetalleId(null); setForm({ tarea: t }) }} />
      )}
      {form && (
        <TareaForm tarea={form.tarea} usuario={usuario} usuarios={usuarios} etiquetas={etiquetas} campanas={campanas} permisos={permisos}
          onClose={() => setForm(null)} onSaved={() => { setForm(null); refrescar() }} onNuevaEtiqueta={() => setEtiquetaModal(true)} />
      )}
      {etiquetaModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '1rem' }}>
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 16, padding: '1.25rem', width: '100%', maxWidth: 320 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>Nueva etiqueta</h3>
            <input value={nuevaEtiqueta.nombre} onChange={e => setNuevaEtiqueta(n => ({ ...n, nombre: e.target.value }))} placeholder="Ej: SEO" style={{ ...sel, width: '100%', padding: '0.6rem', marginBottom: 10 }} />
            <input type="color" value={nuevaEtiqueta.color} onChange={e => setNuevaEtiqueta(n => ({ ...n, color: e.target.value }))} style={{ width: '100%', height: 40, borderRadius: 8, border: '1.5px solid var(--border)', cursor: 'pointer', marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEtiquetaModal(false)} style={{ ...sel, flex: 1, cursor: 'pointer', padding: '0.5rem' }}>Cancelar</button>
              <button onClick={crearEtiqueta} style={{ flex: 2, padding: '0.5rem', border: 'none', borderRadius: 8, backgroundColor: '#f15922', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Crear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ t, puedeEditar, onOpen, onMover }: { t: Tarea; puedeEditar: boolean; onOpen: () => void; onMover: (t: Tarea, e: string) => void }) {
  const p = prioridadInfo(t.prioridad)
  const venc = vencida(t)
  const proxima = !estaCerrada(t.estado) && t.deadline >= hoyISO() && t.deadline <= sumarDias(3)
  return (
    <div onClick={onOpen} style={{ backgroundColor: 'var(--bg-card)', border: `1.5px solid ${venc ? '#fecaca' : 'var(--border)'}`, borderLeft: `4px solid ${p.color}`, borderRadius: 10, padding: '0.7rem', cursor: 'pointer' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.62rem', fontWeight: 700, backgroundColor: p.bg, color: p.color, padding: '2px 8px', borderRadius: 99 }}>{p.label}</span>
        {t.requiere_aprobacion && <span title="Requiere aprobación" style={{ fontSize: '0.7rem' }}>🔒</span>}
        {t.categoria && <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{t.categoria}</span>}
      </div>
      <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginBottom: 6, lineHeight: 1.3, wordBreak: 'break-word' }}>{t.titulo}</p>
      {t.etiquetas.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          {t.etiquetas.map(e => <span key={e.id} style={{ fontSize: '0.58rem', fontWeight: 600, backgroundColor: e.color + '22', color: e.color, padding: '1px 6px', borderRadius: 4 }}>{e.nombre}</span>)}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.7rem', color: venc ? '#ef4444' : proxima ? '#f59e0b' : 'var(--text-muted)' }}>📅 {fechaCorta(t.deadline)}{venc && ' · Vencida'}</span>
        {t.subtareas.total > 0 && <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>☑️ {t.subtareas.hechas}/{t.subtareas.total}</span>}
        <div style={{ display: 'flex' }}>
          {t.asignados.slice(0, 4).map((a, i) => (
            <span key={a.id} title={a.nombre + (a.id === t.responsable_id ? ' (responsable)' : '')} style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: a.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', marginLeft: i ? -6 : 0, border: a.id === t.responsable_id ? '2px solid #f15922' : '2px solid var(--bg-card)' }}>{a.avatar_emoji}</span>
          ))}
        </div>
      </div>
      {puedeEditar && (
        <div onClick={e => e.stopPropagation()} style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
          <select value={t.estado} onChange={e => onMover(t, e.target.value)} style={{ width: '100%', fontSize: '0.72rem', padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'var(--bg)', color: 'var(--text)' }}>
            {ESTADOS.map(s => <option key={s.key} value={s.key}>Mover a: {s.label}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}

function CalendarioTareas({ tareas, mes, setMes, diaSel, setDiaSel, onOpen }: { tareas: Tarea[]; mes: Date; setMes: (d: Date) => void; diaSel: string; setDiaSel: (s: string) => void; onOpen: (id: string) => void }) {
  const primer = new Date(mes.getFullYear(), mes.getMonth(), 1)
  const offset = (primer.getDay() + 6) % 7 // lunes primero
  const diasMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
  const celdas: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: diasMes }, (_, i) => isoLocal(new Date(mes.getFullYear(), mes.getMonth(), i + 1)))]
  while (celdas.length % 7) celdas.push(null)
  const porDia: Record<string, Tarea[]> = {}
  tareas.forEach(t => { (porDia[t.deadline] ||= []).push(t) })
  const hoy = hoyISO()
  const delDia = (porDia[diaSel] || []).sort((a, b) => prioridadInfo(a.prioridad).rank - prioridadInfo(b.prioridad).rank)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))} style={navBtn}>‹</button>
        <strong style={{ color: 'var(--text)', textTransform: 'capitalize' }}>{mes.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</strong>
        <button onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))} style={navBtn}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 3 }}>
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', padding: 4 }}>{d}</div>)}
        {celdas.map((d, i) => {
          if (!d) return <div key={i} />
          const items = porDia[d] || []
          const sel = d === diaSel
          return (
            <div key={i} onClick={() => setDiaSel(d)} style={{ minHeight: 58, border: sel ? '2px solid #f15922' : '1px solid var(--border)', borderRadius: 8, padding: 4, cursor: 'pointer', backgroundColor: d === hoy ? '#f9ddd322' : 'var(--bg-card)', overflow: 'hidden' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: d === hoy ? 800 : 500, color: d === hoy ? '#f15922' : 'var(--text)' }}>{Number(d.slice(8))}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 3 }}>
                {items.slice(0, 6).map(t => <span key={t.id} style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: estaCerrada(t.estado) ? '#10b981' : prioridadInfo(t.prioridad).color }} />)}
              </div>
              {items.length > 0 && <div className="cal-count" style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 2 }}>{items.length} tarea{items.length > 1 ? 's' : ''}</div>}
            </div>
          )
        })}
      </div>
      <h3 style={{ margin: '14px 0 8px', fontSize: '0.9rem', color: 'var(--text)' }}>{new Date(diaSel + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
      {delDia.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin vencimientos este día.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {delDia.map(t => {
          const e = estadoInfo(t.estado), p = prioridadInfo(t.prioridad)
          return (
            <div key={t.id} onClick={() => onOpen(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.6rem 0.8rem', border: '1.5px solid var(--border)', borderLeft: `4px solid ${p.color}`, borderRadius: 10, backgroundColor: 'var(--bg-card)', cursor: 'pointer', flexWrap: 'wrap' }}>
              <span style={{ flex: '1 1 140px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>{t.titulo}</span>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, backgroundColor: e.bg, color: e.color, padding: '2px 8px', borderRadius: 99 }}>{e.label}</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t.asignados.map(a => a.nombre.split(' ')[0]).join(', ')}</span>
            </div>
          )
        })}
      </div>
      <style>{`@media (max-width: 640px) { .cal-count { display: none; } }`}</style>
    </div>
  )
}
const navBtn: React.CSSProperties = { border: '1.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text)', borderRadius: 8, width: 36, height: 32, cursor: 'pointer', fontSize: '1.1rem' }
