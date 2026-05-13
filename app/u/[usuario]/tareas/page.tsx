'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Usuario = { id: string; nombre: string; slug: string; avatar_color: string; avatar_emoji: string; rol: string }
type Etiqueta = { id: string; nombre: string; color: string }
type Tarea = {
  id: string; titulo: string; descripcion: string | null
  estado: 'por_hacer' | 'en_progreso' | 'hecho'
  prioridad: 'baja' | 'media' | 'alta'
  deadline: string; creado_por: string
  horas_dedicadas: number | null; campana_id: string | null
  asignados: Usuario[]; etiquetas: Etiqueta[]
}
type Campana = { id: string; nombre: string; color: string }

const COLUMNAS = [
  { key: 'por_hacer', label: 'Por hacer', color: '#6b7280', bg: '#f9fafb' },
  { key: 'en_progreso', label: 'En progreso', color: '#f59e0b', bg: '#fffbeb' },
  { key: 'hecho', label: 'Hecho', color: '#10b981', bg: '#f0fdf4' },
]
const PRIORIDAD_COLOR: Record<string, string> = { alta: '#ef4444', media: '#f59e0b', baja: '#10b981' }

async function registrarHistorial(usuarioId: string, tareaId: string | null, tareaTitulo: string, accion: string, detalle?: string) {
  await supabase.from('mkt_historial').insert({
    usuario_id: usuarioId, tarea_id: tareaId, tarea_titulo: tareaTitulo, accion, detalle: detalle || null,
  })
}

export default function TareasPage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [todosUsuarios, setTodosUsuarios] = useState<Usuario[]>([])
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([])
  const [campanas, setCampanas] = useState<Campana[]>([])
  const [vista, setVista] = useState<'kanban' | 'lista'>('kanban')
  const [modalOpen, setModalOpen] = useState(false)
  const [tareaDetalle, setTareaDetalle] = useState<Tarea | null>(null)
  const [editandoTarea, setEditandoTarea] = useState<Tarea | null>(null)
  const [loading, setLoading] = useState(true)
  const [horasModal, setHorasModal] = useState(false)
  const [horasValor, setHorasValor] = useState('')
  const [tareaCompletando, setTareaCompletando] = useState<Tarea | null>(null)
  const [filtroEtiqueta, setFiltroEtiqueta] = useState('')
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [form, setForm] = useState({ titulo: '', descripcion: '', prioridad: 'media', deadline: '', campana_id: '', asignados: [] as string[], etiquetas: [] as string[] })
  const [nuevaEtiquetaModal, setNuevaEtiquetaModal] = useState(false)
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState({ nombre: '', color: '#f15922' })

  useEffect(() => {
    const stored = sessionStorage.getItem('mkt_usuario')
    if (stored) { const u = JSON.parse(stored); setUsuario(u); fetchAll() }
  }, [])

  async function fetchAll() {
    await Promise.all([fetchTareas(), fetchEtiquetas(), fetchCampanas(), fetchUsuarios()])
    setLoading(false)
  }

  async function fetchUsuarios() {
    const { data } = await supabase.from('mkt_usuarios').select('*').eq('activo', true)
    setTodosUsuarios(data || [])
  }

  async function fetchEtiquetas() {
    const { data } = await supabase.from('mkt_etiquetas').select('*').order('nombre')
    setEtiquetas(data || [])
  }

  async function fetchCampanas() {
    const { data } = await supabase.from('mkt_campanas').select('id, nombre, color').eq('estado', 'activa')
    setCampanas(data || [])
  }

  async function fetchTareas() {
    const { data: tareasData } = await supabase.from('mkt_tareas').select('*').order('deadline', { ascending: true })
    if (!tareasData) return
    const tareasCompletas: Tarea[] = await Promise.all(
      tareasData.map(async t => {
        const { data: asignadosData } = await supabase.from('mkt_tarea_asignados').select('usuario_id').eq('tarea_id', t.id)
        const { data: etiquetasData } = await supabase.from('mkt_tarea_etiquetas').select('etiqueta_id').eq('tarea_id', t.id)
        const asignadosIds = (asignadosData || []).map((a: any) => a.usuario_id)
        const etiquetasIds = (etiquetasData || []).map((e: any) => e.etiqueta_id)
        const { data: asignadosUsuarios } = await supabase.from('mkt_usuarios').select('*').in('id', asignadosIds.length > 0 ? asignadosIds : ['none'])
        const { data: etiquetasObjetos } = await supabase.from('mkt_etiquetas').select('*').in('id', etiquetasIds.length > 0 ? etiquetasIds : ['none'])
        return { ...t, asignados: asignadosUsuarios || [], etiquetas: etiquetasObjetos || [] }
      })
    )
    setTareas(tareasCompletas)
  }

  async function crearTarea() {
    if (!form.titulo.trim() || !form.deadline || !usuario) return
    const { data: nueva } = await supabase.from('mkt_tareas').insert({
      titulo: form.titulo, descripcion: form.descripcion || null,
      prioridad: form.prioridad, deadline: form.deadline,
      campana_id: form.campana_id || null, creado_por: usuario.id, estado: 'por_hacer',
    }).select().single()
    if (!nueva) return
    if (form.asignados.length > 0) await supabase.from('mkt_tarea_asignados').insert(form.asignados.map(uid => ({ tarea_id: nueva.id, usuario_id: uid })))
    if (form.etiquetas.length > 0) await supabase.from('mkt_tarea_etiquetas').insert(form.etiquetas.map(eid => ({ tarea_id: nueva.id, etiqueta_id: eid })))
    for (const uid of form.asignados) {
      if (uid !== usuario.id) await supabase.from('mkt_notificaciones').insert({ usuario_id: uid, tipo: 'tarea_asignada', titulo: 'Te asignaron una tarea', mensaje: form.titulo, referencia_id: nueva.id, referencia_tipo: 'tarea' })
    }
    await registrarHistorial(usuario.id, nueva.id, form.titulo, 'tarea_creada')
    setModalOpen(false); resetForm(); fetchTareas()
  }

  async function editarTarea() {
    if (!editandoTarea || !form.titulo.trim() || !form.deadline || !usuario) return
    await supabase.from('mkt_tareas').update({ titulo: form.titulo, descripcion: form.descripcion || null, prioridad: form.prioridad, deadline: form.deadline, campana_id: form.campana_id || null }).eq('id', editandoTarea.id)
    await supabase.from('mkt_tarea_asignados').delete().eq('tarea_id', editandoTarea.id)
    if (form.asignados.length > 0) await supabase.from('mkt_tarea_asignados').insert(form.asignados.map(uid => ({ tarea_id: editandoTarea.id, usuario_id: uid })))
    await supabase.from('mkt_tarea_etiquetas').delete().eq('tarea_id', editandoTarea.id)
    if (form.etiquetas.length > 0) await supabase.from('mkt_tarea_etiquetas').insert(form.etiquetas.map(eid => ({ tarea_id: editandoTarea.id, etiqueta_id: eid })))
    await registrarHistorial(usuario.id, editandoTarea.id, form.titulo, 'tarea_editada')
    setEditandoTarea(null); setModalOpen(false); resetForm(); fetchTareas()
  }

  async function cambiarEstado(tarea: Tarea, nuevoEstado: string) {
    if (nuevoEstado === 'hecho') { setTareaCompletando(tarea); setHorasModal(true); return }
    await supabase.from('mkt_tareas').update({ estado: nuevoEstado }).eq('id', tarea.id)
    await registrarHistorial(usuario!.id, tarea.id, tarea.titulo, 'tarea_movida', `${COLUMNAS.find(c => c.key === tarea.estado)?.label} → ${COLUMNAS.find(c => c.key === nuevoEstado)?.label}`)
    fetchTareas()
  }

  async function confirmarHoras() {
    if (!tareaCompletando || !usuario) return
    await supabase.from('mkt_tareas').update({ estado: 'hecho', horas_dedicadas: horasValor ? parseFloat(horasValor) : null }).eq('id', tareaCompletando.id)
    await registrarHistorial(usuario.id, tareaCompletando.id, tareaCompletando.titulo, 'tarea_movida', `${COLUMNAS.find(c => c.key === tareaCompletando.estado)?.label} → Hecho`)
    setHorasModal(false); setHorasValor(''); setTareaCompletando(null); fetchTareas()
  }

  async function eliminarTarea(tarea: Tarea) {
    if (!confirm('¿Eliminás esta tarea?') || !usuario) return
    await registrarHistorial(usuario.id, null, tarea.titulo, 'tarea_eliminada')
    await supabase.from('mkt_tareas').delete().eq('id', tarea.id)
    fetchTareas()
  }

  async function crearEtiqueta() {
    if (!nuevaEtiqueta.nombre.trim() || !usuario) return
    await supabase.from('mkt_etiquetas').insert({ nombre: nuevaEtiqueta.nombre, color: nuevaEtiqueta.color, creado_por: usuario.id, es_predeterminada: false })
    setNuevaEtiqueta({ nombre: '', color: '#f15922' }); setNuevaEtiquetaModal(false); fetchEtiquetas()
  }

  function abrirEditar(tarea: Tarea) {
    setEditandoTarea(tarea)
    setForm({ titulo: tarea.titulo, descripcion: tarea.descripcion || '', prioridad: tarea.prioridad, deadline: tarea.deadline, campana_id: tarea.campana_id || '', asignados: tarea.asignados.map(a => a.id), etiquetas: tarea.etiquetas.map(e => e.id) })
    setTareaDetalle(null); setModalOpen(true)
  }

  function resetForm() {
    setForm({ titulo: '', descripcion: '', prioridad: 'media', deadline: '', campana_id: '', asignados: [], etiquetas: [] })
    setEditandoTarea(null)
  }

  const puedeEditar = (tarea: Tarea) => tarea.creado_por === usuario?.id || tarea.asignados.some(a => a.id === usuario?.id)

  const tareasFiltradas = tareas.filter(t => {
    if (filtroEtiqueta && !t.etiquetas.some(e => e.id === filtroEtiqueta)) return false
    if (filtroUsuario && !t.asignados.some(a => a.id === filtroUsuario) && t.creado_por !== filtroUsuario) return false
    return true
  })

  if (!usuario) return null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1a1a1a' }}>✅ Tareas</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ display: 'flex', border: '1.5px solid #e8e8e8', borderRadius: '8px', overflow: 'hidden' }}>
            {(['kanban', 'lista'] as const).map(v => (
              <button key={v} onClick={() => setVista(v)} style={{ padding: '0.375rem 0.875rem', border: 'none', backgroundColor: vista === v ? '#f15922' : '#fff', color: vista === v ? '#fff' : '#666', cursor: 'pointer', fontSize: '0.8rem', fontWeight: vista === v ? 600 : 400 }}>
                {v === 'kanban' ? '⬛ Kanban' : '☰ Lista'}
              </button>
            ))}
          </div>
          <button onClick={() => { resetForm(); setModalOpen(true) }} style={{ backgroundColor: '#f15922', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.5rem 1rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>+ Nueva tarea</button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <select value={filtroEtiqueta} onChange={e => setFiltroEtiqueta(e.target.value)} style={{ padding: '0.375rem 0.75rem', border: '1.5px solid #e8e8e8', borderRadius: '8px', fontSize: '0.8rem', color: '#555', backgroundColor: '#fff', cursor: 'pointer' }}>
          <option value="">Todas las etiquetas</option>
          {etiquetas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
        <select value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)} style={{ padding: '0.375rem 0.75rem', border: '1.5px solid #e8e8e8', borderRadius: '8px', fontSize: '0.8rem', color: '#555', backgroundColor: '#fff', cursor: 'pointer' }}>
          <option value="">Todos los usuarios</option>
          {todosUsuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
        {(filtroEtiqueta || filtroUsuario) && (
          <button onClick={() => { setFiltroEtiqueta(''); setFiltroUsuario('') }} style={{ padding: '0.375rem 0.75rem', border: '1.5px solid #e8e8e8', borderRadius: '8px', fontSize: '0.8rem', color: '#ef4444', backgroundColor: '#fef2f2', cursor: 'pointer' }}>✕ Limpiar</button>
        )}
      </div>

      {/* KANBAN */}
      {vista === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', alignItems: 'start' }}>
          {COLUMNAS.map(col => {
            const tareaCol = tareasFiltradas.filter(t => t.estado === col.key)
            return (
              <div key={col.key} style={{ backgroundColor: col.bg, borderRadius: '12px', padding: '1rem', border: '1.5px solid #e8e8e8', minHeight: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: col.color }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col.label}</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#888', backgroundColor: '#fff', padding: '2px 8px', borderRadius: '99px', border: '1px solid #e8e8e8' }}>{tareaCol.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {tareaCol.map(tarea => (
                    <TareaCard key={tarea.id} tarea={tarea} columnas={COLUMNAS} puedeEditar={puedeEditar(tarea)}
                      onCambiarEstado={cambiarEstado} onEliminar={eliminarTarea} onEditar={abrirEditar} onVerDetalle={setTareaDetalle} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* LISTA */}
      {vista === 'lista' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {tareasFiltradas.length === 0 && <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>No hay tareas.</div>}
          {tareasFiltradas.map(tarea => (
            <div key={tarea.id} style={{ backgroundColor: '#fff', border: '1.5px solid #e8e8e8', borderRadius: '10px', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }} onClick={() => setTareaDetalle(tarea)}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: PRIORIDAD_COLOR[tarea.prioridad], flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1a1a1a' }}>{tarea.titulo}</p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                  {tarea.etiquetas.map(e => <span key={e.id} style={{ fontSize: '0.65rem', backgroundColor: e.color + '22', color: e.color, padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>{e.nombre}</span>)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                {tarea.asignados.map(a => <span key={a.id} style={{ fontSize: '0.7rem', backgroundColor: a.avatar_color + '22', color: a.avatar_color, padding: '2px 8px', borderRadius: '99px', fontWeight: 600 }}>{a.nombre.split(' ')[0]}</span>)}
              </div>
              <span style={{ fontSize: '0.75rem', color: '#888', whiteSpace: 'nowrap' }}>📅 {new Date(tarea.deadline + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
              <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '3px 10px', borderRadius: '99px', backgroundColor: tarea.estado === 'hecho' ? '#f0fdf4' : tarea.estado === 'en_progreso' ? '#fffbeb' : '#f9fafb', color: tarea.estado === 'hecho' ? '#10b981' : tarea.estado === 'en_progreso' ? '#f59e0b' : '#6b7280' }}>
                {COLUMNAS.find(c => c.key === tarea.estado)?.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DETALLE */}
      {tareaDetalle && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }} onClick={e => { if (e.target === e.currentTarget) setTareaDetalle(null) }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  {tareaDetalle.etiquetas.map(e => <span key={e.id} style={{ fontSize: '0.65rem', fontWeight: 600, backgroundColor: e.color + '22', color: e.color, padding: '2px 8px', borderRadius: '4px' }}>{e.nombre}</span>)}
                </div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '0.25rem' }}>{tareaDetalle.titulo}</h2>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#888' }}>
                  <span>📅 {new Date(tareaDetalle.deadline + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}</span>
                  <span style={{ color: PRIORIDAD_COLOR[tareaDetalle.prioridad], fontWeight: 600 }}>● {tareaDetalle.prioridad}</span>
                </div>
              </div>
              <button onClick={() => setTareaDetalle(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#888' }}>×</button>
            </div>
            {tareaDetalle.descripcion && (
              <div style={{ backgroundColor: '#f9fafb', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#888', marginBottom: '0.375rem' }}>DESCRIPCIÓN</p>
                <p style={{ fontSize: '0.875rem', color: '#333', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{tareaDetalle.descripcion}</p>
              </div>
            )}
            {tareaDetalle.asignados.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#888', marginBottom: '0.375rem' }}>ASIGNADO A</p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {tareaDetalle.asignados.map(a => (
                    <span key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', backgroundColor: a.avatar_color + '22', color: a.avatar_color, padding: '4px 10px', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 600 }}>
                      {a.avatar_emoji} {a.nombre}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
              {puedeEditar(tareaDetalle) && (
                <button onClick={() => abrirEditar(tareaDetalle)} style={{ flex: 1, padding: '0.625rem', border: '1.5px solid #e8e8e8', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.875rem', color: '#555' }}>✏️ Editar</button>
              )}
              <button onClick={() => setTareaDetalle(null)} style={{ flex: 1, padding: '0.625rem', border: 'none', borderRadius: '8px', backgroundColor: '#f15922', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR/EDITAR */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }} onClick={e => { if (e.target === e.currentTarget) { setModalOpen(false); resetForm() } }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem', color: '#1a1a1a' }}>{editandoTarea ? 'Editar tarea' : 'Nueva tarea'}</h2>
            <Campo label="Título *"><input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="¿Qué hay que hacer?" style={inputStyle} /></Campo>
            <Campo label="Descripción"><textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Detalles, contexto, links..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></Campo>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Campo label="Prioridad">
                <select value={form.prioridad} onChange={e => setForm(f => ({ ...f, prioridad: e.target.value }))} style={inputStyle}>
                  <option value="baja">🟢 Baja</option>
                  <option value="media">🟡 Media</option>
                  <option value="alta">🔴 Alta</option>
                </select>
              </Campo>
              <Campo label="Deadline *"><input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} style={inputStyle} /></Campo>
            </div>
            {campanas.length > 0 && (
              <Campo label="Campaña (opcional)">
                <select value={form.campana_id} onChange={e => setForm(f => ({ ...f, campana_id: e.target.value }))} style={inputStyle}>
                  <option value="">Sin campaña</option>
                  {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </Campo>
            )}
            <Campo label="Asignar a">
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {todosUsuarios.map(u => (
                  <button key={u.id} onClick={() => setForm(f => ({ ...f, asignados: f.asignados.includes(u.id) ? f.asignados.filter(id => id !== u.id) : [...f.asignados, u.id] }))} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.75rem', borderRadius: '99px', border: form.asignados.includes(u.id) ? '2px solid #f15922' : '1.5px solid #e8e8e8', backgroundColor: form.asignados.includes(u.id) ? '#f9ddd3' : '#fff', cursor: 'pointer', fontSize: '0.8rem', color: '#1a1a1a' }}>
                    {u.avatar_emoji} {u.nombre}
                  </button>
                ))}
              </div>
            </Campo>
            <Campo label="Etiquetas">
              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                {etiquetas.map(e => (
                  <button key={e.id} onClick={() => setForm(f => ({ ...f, etiquetas: f.etiquetas.includes(e.id) ? f.etiquetas.filter(id => id !== e.id) : [...f.etiquetas, e.id] }))} style={{ padding: '0.25rem 0.625rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, border: form.etiquetas.includes(e.id) ? `2px solid ${e.color}` : '1.5px solid #e8e8e8', backgroundColor: form.etiquetas.includes(e.id) ? e.color + '22' : '#fff', color: form.etiquetas.includes(e.id) ? e.color : '#666', cursor: 'pointer' }}>{e.nombre}</button>
                ))}
                <button onClick={() => setNuevaEtiquetaModal(true)} style={{ padding: '0.25rem 0.625rem', borderRadius: '4px', fontSize: '0.75rem', border: '1.5px dashed #e8e8e8', backgroundColor: '#fff', color: '#888', cursor: 'pointer' }}>+ Nueva</button>
              </div>
            </Campo>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button onClick={() => { setModalOpen(false); resetForm() }} style={{ flex: 1, padding: '0.625rem', border: '1.5px solid #e8e8e8', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.875rem', color: '#555' }}>Cancelar</button>
              <button onClick={editandoTarea ? editarTarea : crearTarea} style={{ flex: 2, padding: '0.625rem', border: 'none', borderRadius: '8px', backgroundColor: '#f15922', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>{editandoTarea ? 'Guardar cambios' : 'Crear tarea'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HORAS */}
      {horasModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <p style={{ fontSize: '1.5rem', textAlign: 'center', marginBottom: '0.5rem' }}>🎉</p>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, textAlign: 'center', marginBottom: '0.25rem' }}>¡Tarea completada!</h3>
            <p style={{ fontSize: '0.85rem', color: '#888', textAlign: 'center', marginBottom: '1.5rem' }}>¿Cuántas horas le dedicaste? (opcional)</p>
            <input type="number" min="0" step="0.5" value={horasValor} onChange={e => setHorasValor(e.target.value)} placeholder="Ej: 2.5" style={{ ...inputStyle, textAlign: 'center', marginBottom: '1rem' }} />
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => { setHorasModal(false); setHorasValor(''); setTareaCompletando(null) }} style={{ flex: 1, padding: '0.625rem', border: '1.5px solid #e8e8e8', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.875rem', color: '#555' }}>Omitir</button>
              <button onClick={confirmarHoras} style={{ flex: 2, padding: '0.625rem', border: 'none', borderRadius: '8px', backgroundColor: '#10b981', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA ETIQUETA */}
      {nuevaEtiquetaModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: 320, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Nueva etiqueta</h3>
            <Campo label="Nombre"><input value={nuevaEtiqueta.nombre} onChange={e => setNuevaEtiqueta(n => ({ ...n, nombre: e.target.value }))} placeholder="Ej: SEO" style={inputStyle} /></Campo>
            <Campo label="Color"><input type="color" value={nuevaEtiqueta.color} onChange={e => setNuevaEtiqueta(n => ({ ...n, color: e.target.value }))} style={{ width: '100%', height: 40, borderRadius: '8px', border: '1.5px solid #e8e8e8', cursor: 'pointer' }} /></Campo>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button onClick={() => setNuevaEtiquetaModal(false)} style={{ flex: 1, padding: '0.5rem', border: '1.5px solid #e8e8e8', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.875rem' }}>Cancelar</button>
              <button onClick={crearEtiqueta} style={{ flex: 2, padding: '0.5rem', border: 'none', borderRadius: '8px', backgroundColor: '#f15922', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>Crear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TareaCard({ tarea, columnas, puedeEditar, onCambiarEstado, onEliminar, onEditar, onVerDetalle }: {
  tarea: Tarea; columnas: typeof COLUMNAS; puedeEditar: boolean
  onCambiarEstado: (t: Tarea, estado: string) => void
  onEliminar: (t: Tarea) => void
  onEditar: (t: Tarea) => void
  onVerDetalle: (t: Tarea) => void
}) {
  const hoy = new Date().toISOString().split('T')[0]
  const en3dias = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const vencida = tarea.deadline < hoy && tarea.estado !== 'hecho'
  const proximaVencer = tarea.deadline <= en3dias && tarea.deadline >= hoy

  return (
    <div style={{ backgroundColor: '#fff', border: `1.5px solid ${vencida ? '#fecaca' : '#e8e8e8'}`, borderRadius: '10px', padding: '0.875rem', cursor: 'pointer', transition: 'box-shadow 0.15s ease' }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
      onClick={() => onVerDetalle(tarea)}
    >
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <div style={{ width: 3, borderRadius: '99px', flexShrink: 0, backgroundColor: PRIORIDAD_COLOR[tarea.prioridad], minHeight: 16 }} />
        <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1a1a1a', lineHeight: 1.3 }}>{tarea.titulo}</p>
      </div>
      {tarea.etiquetas.length > 0 && (
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          {tarea.etiquetas.map(e => <span key={e.id} style={{ fontSize: '0.6rem', fontWeight: 600, backgroundColor: e.color + '22', color: e.color, padding: '2px 6px', borderRadius: '4px' }}>{e.nombre}</span>)}
        </div>
      )}
      <p style={{ fontSize: '0.7rem', color: vencida ? '#ef4444' : proximaVencer ? '#f59e0b' : '#888', marginBottom: '0.5rem' }}>
        📅 {new Date(tarea.deadline + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
        {vencida && ' · Vencida'}{proximaVencer && !vencida && ' · Próxima'}
      </p>
      {tarea.asignados.length > 0 && (
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          {tarea.asignados.map(a => <span key={a.id} style={{ fontSize: '0.65rem', fontWeight: 600, backgroundColor: a.avatar_color + '22', color: a.avatar_color, padding: '2px 7px', borderRadius: '99px' }}>{a.nombre.split(' ')[0]}</span>)}
        </div>
      )}
      {puedeEditar && (
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.5rem' }} onClick={e => e.stopPropagation()}>
          <button onClick={() => onEditar(tarea)} style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e8e8e8', backgroundColor: '#f9fafb', color: '#555', cursor: 'pointer' }}>✏️ Editar</button>
          {columnas.filter(c => c.key !== tarea.estado).map(c => (
            <button key={c.key} onClick={() => onCambiarEstado(tarea, c.key)} style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e8e8e8', backgroundColor: '#f9fafb', color: '#555', cursor: 'pointer' }}>→ {c.label}</button>
          ))}
          <button onClick={() => onEliminar(tarea)} style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fecaca', backgroundColor: '#fef2f2', color: '#ef4444', cursor: 'pointer', marginLeft: 'auto' }}>✕</button>
        </div>
      )}
    </div>
  )
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '0.375rem' }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.625rem 0.875rem',
  border: '1.5px solid #e8e8e8', borderRadius: '8px',
  fontSize: '0.875rem', outline: 'none', color: '#1a1a1a', backgroundColor: '#fff',
}
