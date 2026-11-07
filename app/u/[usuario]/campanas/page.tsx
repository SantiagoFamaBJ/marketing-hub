'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSesion } from '@/lib/useSesion'
import { Tarea, Usuario, Etiqueta, cargarTareas, cargarUsuarios, estaCerrada, estadoInfo, prioridadInfo, fechaCorta, vencida } from '@/lib/tareas'
import TareaDetalle from '@/components/TareaDetalle'
import TareaForm from '@/components/TareaForm'

type Campana = {
  id: string; nombre: string; descripcion: string | null; color: string; fecha_inicio: string | null; fecha_fin: string | null; estado: string
  creado_por: string | null; objetivo: string | null; responsable_id: string | null; resultados: string | null
}
type Archivo = { id: string; nombre_archivo: string; url: string; tipo: string | null; creado_en: string }

const ESTADOS = [
  { key: 'planificada', label: 'Planificada', color: '#8b5cf6' },
  { key: 'activa', label: 'Activa', color: '#10b981' },
  { key: 'pausada', label: 'Pausada', color: '#f59e0b' },
  { key: 'completada', label: 'Completada', color: '#3b82f6' },
  { key: 'archivada', label: 'Archivada', color: '#6b7280' },
]
const COLORES = ['#f15922', '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#F97316']
const inp: React.CSSProperties = { width: '100%', padding: '0.6rem 0.8rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', color: 'var(--text)', backgroundColor: 'var(--input-bg)' }
const btn = (bg: string, color = '#fff'): React.CSSProperties => ({ padding: '0.5rem 1rem', border: 'none', borderRadius: 8, backgroundColor: bg, color, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' })
const Campo = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: '0.9rem' }}><label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>{children}</div>
)
const pesos = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

export default function CampanasPage() {
  const { usuario, permisos } = useSesion()
  const [campanas, setCampanas] = useState<Campana[]>([])
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([])
  const [filtro, setFiltro] = useState<'vigentes' | 'todas'>('vigentes')
  const [editando, setEditando] = useState<Campana | 'nueva' | null>(null)
  const [form, setForm] = useState({ nombre: '', descripcion: '', objetivo: '', color: '#f15922', fecha_inicio: '', fecha_fin: '', estado: 'activa', responsable_id: '' })
  const [abierta, setAbierta] = useState<Campana | null>(null)
  const [tab, setTab] = useState<'resumen' | 'tareas' | 'archivos'>('resumen')
  const [archivos, setArchivos] = useState<Archivo[]>([])
  const [subiendo, setSubiendo] = useState(false)
  const [resultados, setResultados] = useState('')
  const [detalleId, setDetalleId] = useState<string | null>(null)
  const [nuevaTarea, setNuevaTarea] = useState(false)

  useEffect(() => { if (usuario && permisos) cargar() }, [usuario?.id, permisos])

  async function cargar() {
    if (!usuario || !permisos) return
    const [c, t, u, e] = await Promise.all([
      supabase.from('mkt_campanas').select('*').order('creado_en', { ascending: false }),
      cargarTareas({ usuarioId: usuario.id, soloMias: !permisos.ver_todas_tareas }),
      cargarUsuarios(), supabase.from('mkt_etiquetas').select('*').order('nombre'),
    ])
    setCampanas(c.data || []); setTareas(t); setUsuarios(u); setEtiquetas(e.data || [])
    if (abierta) setAbierta((c.data || []).find((x: Campana) => x.id === abierta.id) || null)
  }

  async function cargarArchivos(id: string) {
    const { data } = await supabase.from('mkt_archivos').select('*').eq('entidad', 'campana').eq('entidad_id', id).order('creado_en', { ascending: false })
    setArchivos(data || [])
  }

  function abrir(c: Campana) { setAbierta(c); setTab('resumen'); setResultados(c.resultados || ''); cargarArchivos(c.id) }

  function abrirForm(c: Campana | 'nueva') {
    setEditando(c)
    if (c === 'nueva') setForm({ nombre: '', descripcion: '', objetivo: '', color: '#f15922', fecha_inicio: '', fecha_fin: '', estado: 'activa', responsable_id: usuario?.id || '' })
    else setForm({ nombre: c.nombre, descripcion: c.descripcion || '', objetivo: c.objetivo || '', color: c.color, fecha_inicio: c.fecha_inicio || '', fecha_fin: c.fecha_fin || '', estado: c.estado, responsable_id: c.responsable_id || '' })
  }

  async function guardar() {
    if (!form.nombre.trim() || !usuario) return
    const payload: any = {
      nombre: form.nombre.trim(), descripcion: form.descripcion || null, objetivo: form.objetivo || null, color: form.color,
      fecha_inicio: form.fecha_inicio || null, fecha_fin: form.fecha_fin || null, estado: form.estado, responsable_id: form.responsable_id || null,
    }
    if (editando && editando !== 'nueva') await supabase.from('mkt_campanas').update(payload).eq('id', editando.id)
    else await supabase.from('mkt_campanas').insert({ ...payload, creado_por: usuario.id })
    setEditando(null); cargar()
  }

  async function eliminar(c: Campana) {
    if (!confirm(`¿Eliminás "${c.nombre}"? Las tareas quedan, sin campaña.`)) return
    await supabase.from('mkt_campanas').delete().eq('id', c.id)
    setAbierta(null); cargar()
  }

  async function guardarResultados() {
    if (!abierta) return
    await supabase.from('mkt_campanas').update({ resultados: resultados || null }).eq('id', abierta.id)
    cargar()
  }

  async function subir(file: File) {
    if (!abierta || !usuario) return
    setSubiendo(true)
    const path = `campanas/${abierta.id}/${Date.now()}.${file.name.split('.').pop()}`
    const { data } = await supabase.storage.from('mkt-adjuntos').upload(path, file)
    if (data) {
      const { data: u } = supabase.storage.from('mkt-adjuntos').getPublicUrl(path)
      await supabase.from('mkt_archivos').insert({ entidad: 'campana', entidad_id: abierta.id, nombre_archivo: file.name, url: u.publicUrl, tipo: file.type, subido_por: usuario.id })
      cargarArchivos(abierta.id)
    }
    setSubiendo(false)
  }

  if (!usuario || !permisos) return null
  if (!permisos.gestionar_campanas) return <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>No tenés acceso a Campañas con tu rol.</p>

  const lista = campanas.filter(c => filtro === 'todas' || ['planificada', 'activa', 'pausada'].includes(c.estado))
  const tareasDe = (id: string) => tareas.filter(t => t.campana_id === id)
  const detalle = tareas.find(t => t.id === detalleId) || null
  const campanasSimple = campanas.filter(c => c.estado !== 'archivada').map(c => ({ id: c.id, nombre: c.nombre }))

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.25rem, 4vw, 1.6rem)', fontWeight: 700, color: 'var(--text)' }}>📣 Campañas</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Las tareas de cada campaña son las mismas de Tareas</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={filtro} onChange={e => setFiltro(e.target.value as any)} style={{ ...inp, width: 'auto' }}>
            <option value="vigentes">Vigentes</option><option value="todas">Todas</option>
          </select>
          <button onClick={() => abrirForm('nueva')} style={btn('#f15922')}>+ Nueva campaña</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {lista.map(c => {
          const est = ESTADOS.find(e => e.key === c.estado)
          const ts = tareasDe(c.id), hechas = ts.filter(t => estaCerrada(t.estado)).length
          const venc = ts.filter(vencida).length
          const resp = usuarios.find(u => u.id === c.responsable_id)
          return (
            <div key={c.id} onClick={() => abrir(c)} style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer' }}>
              <div style={{ height: 6, backgroundColor: c.color }} />
              <div style={{ padding: '1rem 1.1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>{c.nombre}</h3>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 99, backgroundColor: (est?.color || '#999') + '22', color: est?.color, height: 'fit-content', whiteSpace: 'nowrap' }}>{est?.label}</span>
                </div>
                {c.objetivo && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.4 }}>🎯 {c.objetivo}</p>}
                {(c.fecha_inicio || c.fecha_fin) && <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 8 }}>📅 {c.fecha_inicio ? fechaCorta(c.fecha_inicio) : '?'} → {c.fecha_fin ? fechaCorta(c.fecha_fin) : '?'}</p>}
                <div style={{ height: 6, borderRadius: 99, backgroundColor: 'var(--border)', overflow: 'hidden', marginBottom: 4 }}>
                  <div style={{ width: ts.length ? `${(hechas / ts.length) * 100}%` : '0%', height: '100%', backgroundColor: '#10b981' }} />
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{ts.length ? `${hechas}/${ts.length} tareas` : 'Sin tareas'}{venc > 0 && <span style={{ color: '#ef4444' }}> · {venc} vencida{venc > 1 ? 's' : ''}</span>}{resp ? ` · ${resp.avatar_emoji} ${resp.nombre.split(' ')[0]}` : ''}</p>
              </div>
            </div>
          )
        })}
        {lista.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}><p style={{ fontSize: '2rem' }}>📣</p><p style={{ fontWeight: 600 }}>No hay campañas {filtro === 'vigentes' ? 'vigentes' : ''}</p></div>}
      </div>

      {/* Detalle de campaña */}
      {abierta && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 900, padding: '0.75rem' }} onClick={e => { if (e.target === e.currentTarget) setAbierta(null) }}>
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth: 640, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: 6, backgroundColor: abierta.color, borderRadius: '16px 16px 0 0' }} />
            <div style={{ padding: '1rem 1.25rem 0.5rem', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)' }}>{abierta.nombre}</h2>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{ESTADOS.find(e => e.key === abierta.estado)?.label}{abierta.fecha_inicio || abierta.fecha_fin ? ` · ${abierta.fecha_inicio ? fechaCorta(abierta.fecha_inicio) : '?'} → ${abierta.fecha_fin ? fechaCorta(abierta.fecha_fin) : '?'}` : ''}</p>
              </div>
              <button onClick={() => setAbierta(null)} aria-label="Cerrar" style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--text-muted)', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 0.75rem' }}>
              {([['resumen', '📋 Resumen'], ['tareas', `✅ Tareas (${tareasDe(abierta.id).length})`], ['archivos', `📎 Materiales (${archivos.length})`]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} style={{ padding: '0.55rem 0.8rem', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.8rem', fontWeight: tab === k ? 700 : 400, color: tab === k ? '#f15922' : 'var(--text-muted)', borderBottom: tab === k ? '2px solid #f15922' : '2px solid transparent', marginBottom: -1 }}>{l}</button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
              {tab === 'resumen' && (
                <>
                  {abierta.objetivo && <Campo label="Objetivo"><p style={{ fontSize: '0.875rem', color: 'var(--text)' }}>{abierta.objetivo}</p></Campo>}
                  {abierta.descripcion && <Campo label="Descripción"><p style={{ fontSize: '0.875rem', color: 'var(--text)' }}>{abierta.descripcion}</p></Campo>}
                  <Campo label="Responsable"><p style={{ fontSize: '0.875rem', color: 'var(--text)' }}>{usuarios.find(u => u.id === abierta.responsable_id)?.nombre || 'Sin asignar'}</p></Campo>
                  <Campo label="Resultados finales">
                    <textarea value={resultados} onChange={e => setResultados(e.target.value)} onBlur={guardarResultados} rows={4} placeholder="Qué se logró: alcance, ventas, aprendizajes…" style={{ ...inp, resize: 'vertical' }} />
                  </Campo>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { abrirForm(abierta) }} style={btn('var(--bg)', 'var(--text)')}>✏️ Editar</button>
                    <button onClick={() => eliminar(abierta)} style={{ ...btn('#fef2f2', '#ef4444'), marginLeft: 'auto' }}>🗑️</button>
                  </div>
                </>
              )}
              {tab === 'tareas' && (
                <>
                  <button onClick={() => setNuevaTarea(true)} style={{ ...btn('#f15922'), marginBottom: 10 }}>+ Nueva tarea en esta campaña</button>
                  {tareasDe(abierta.id).length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: 12 }}>Todavía no hay tareas vinculadas.</p>}
                  {tareasDe(abierta.id).sort((a, b) => a.deadline.localeCompare(b.deadline)).map(t => {
                    const e = estadoInfo(t.estado), p = prioridadInfo(t.prioridad)
                    return (
                      <div key={t.id} onClick={() => setDetalleId(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.55rem 0.7rem', border: '1.5px solid var(--border)', borderLeft: `3px solid ${p.color}`, borderRadius: 8, marginBottom: 6, cursor: 'pointer', flexWrap: 'wrap' }}>
                        <span style={{ flex: '1 1 140px', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text)' }}>{t.titulo}</span>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, backgroundColor: e.bg, color: e.color, padding: '2px 8px', borderRadius: 99 }}>{e.label}</span>
                        <span style={{ fontSize: '0.72rem', color: vencida(t) ? '#ef4444' : 'var(--text-muted)' }}>{t.responsable?.nombre.split(' ')[0]} · {fechaCorta(t.deadline)}</span>
                      </div>
                    )
                  })}
                </>
              )}
              {tab === 'archivos' && (
                <>
                  {archivos.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: 12 }}>Sin materiales todavía.</p>}
                  {archivos.map(a => (
                    <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', gap: 10, padding: '0.6rem 0.8rem', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6, textDecoration: 'none', alignItems: 'center' }}>
                      <span>{a.tipo?.startsWith('image') ? '🖼️' : a.tipo?.includes('pdf') ? '📄' : '📎'}</span>
                      <span style={{ flex: 1, fontSize: '0.84rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nombre_archivo}</span>
                      <span style={{ color: '#f15922', fontWeight: 700 }}>↗</span>
                    </a>
                  ))}
                  <label style={{ display: 'block', padding: '0.7rem', border: '2px dashed var(--border)', borderRadius: 10, textAlign: 'center', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 8 }}>
                    {subiendo ? 'Subiendo...' : '+ Subir material'}
                    <input type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) subir(f) }} />
                  </label>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Formulario */}
      {editando && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '0.75rem' }} onClick={e => { if (e.target === e.currentTarget) setEditando(null) }}>
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 16, padding: '1.25rem', width: '100%', maxWidth: 500, maxHeight: '92vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 14, color: 'var(--text)' }}>{editando === 'nueva' ? 'Nueva campaña' : 'Editar campaña'}</h2>
            <Campo label="Nombre *"><input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Congreso FOUBA" style={inp} /></Campo>
            <Campo label="Objetivo"><input value={form.objetivo} onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))} placeholder="¿Qué queremos lograr?" style={inp} /></Campo>
            <Campo label="Descripción"><textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} /></Campo>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0 12px' }}>
              <Campo label="Inicio"><input type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} style={inp} /></Campo>
              <Campo label="Fin"><input type="date" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} style={inp} /></Campo>
              <Campo label="Estado"><select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} style={inp}>{ESTADOS.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}</select></Campo>
              <Campo label="Responsable"><select value={form.responsable_id} onChange={e => setForm(f => ({ ...f, responsable_id: e.target.value }))} style={inp}><option value="">Sin asignar</option>{usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select></Campo>
            </div>
            <Campo label="Color">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {COLORES.map(c => <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} aria-label={c} style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: c, border: 'none', outline: form.color === c ? '3px solid var(--text)' : 'none', cursor: 'pointer' }} />)}
              </div>
            </Campo>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setEditando(null)} style={{ ...btn('var(--bg-card)', 'var(--text)'), flex: 1, border: '1.5px solid var(--border)' }}>Cancelar</button>
              <button onClick={guardar} disabled={!form.nombre.trim()} style={{ ...btn('#f15922'), flex: 2, opacity: form.nombre.trim() ? 1 : 0.6 }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {detalle && <TareaDetalle tarea={detalle} usuario={usuario} usuarios={usuarios} permisos={permisos} campanaNombre={abierta?.nombre} onClose={() => setDetalleId(null)} onChanged={cargar} onEditar={() => setDetalleId(null)} />}
      {nuevaTarea && abierta && <TareaForm tarea={null} campanaInicial={abierta.id} usuario={usuario} usuarios={usuarios} etiquetas={etiquetas} campanas={campanasSimple} permisos={permisos} onClose={() => setNuevaTarea(false)} onSaved={() => { setNuevaTarea(false); cargar() }} onNuevaEtiqueta={() => {}} />}
    </div>
  )
}
