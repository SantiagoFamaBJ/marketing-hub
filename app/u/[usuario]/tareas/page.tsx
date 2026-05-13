'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Usuario = {
  id: string
  nombre: string
  slug: string
  avatar_color: string
  avatar_emoji: string
  rol: string
}

type Etiqueta = {
  id: string
  nombre: string
  color: string
}

type Tarea = {
  id: string
  titulo: string
  descripcion: string | null
  estado: 'por_hacer' | 'en_progreso' | 'hecho'
  prioridad: 'baja' | 'media' | 'alta'
  deadline: string | null
  creado_por: string
  horas_dedicadas: number | null
  campana_id: string | null
  asignados: Usuario[]
  etiquetas: Etiqueta[]
}

type Campana = {
  id: string
  nombre: string
  color: string
}

const COLUMNAS = [
  { key: 'por_hacer', label: 'Por hacer', color: '#6b7280', bg: '#f9fafb' },
  { key: 'en_progreso', label: 'En progreso', color: '#f59e0b', bg: '#fffbeb' },
  { key: 'hecho', label: 'Hecho', color: '#10b981', bg: '#f0fdf4' },
]

const PRIORIDAD_COLOR: Record<string, string> = {
  alta: '#ef4444',
  media: '#f59e0b',
  baja: '#10b981',
}

export default function TareasPage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [todosUsuarios, setTodosUsuarios] = useState<Usuario[]>([])
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([])
  const [campanas, setCampanas] = useState<Campana[]>([])
  const [vista, setVista] = useState<'kanban' | 'lista'>('kanban')
  const [modalOpen, setModalOpen] = useState(false)
  const [tareaSeleccionada, setTareaSeleccionada] = useState<Tarea | null>(null)
  const [loading, setLoading] = useState(true)
  const [horasModal, setHorasModal] = useState(false)
  const [horasValor, setHorasValor] = useState('')
  const [tareaCompletando, setTareaCompletando] = useState<Tarea | null>(null)

  // Form nueva tarea
  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    prioridad: 'media',
    deadline: '',
    campana_id: '',
    asignados: [] as string[],
    etiquetas: [] as string[],
  })

  // Nueva etiqueta
  const [nuevaEtiquetaModal, setNuevaEtiquetaModal] = useState(false)
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState({ nombre: '', color: '#f15922' })

  useEffect(() => {
    const stored = sessionStorage.getItem('mkt_usuario')
    if (stored) {
      const u = JSON.parse(stored)
      setUsuario(u)
      fetchAll(u)
    }
  }, [])

  async function fetchAll(u: Usuario) {
    await Promise.all([
      fetchTareas(u),
      fetchEtiquetas(),
      fetchCampanas(),
      fetchUsuarios(),
    ])
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

  async function fetchTareas(u: Usuario) {
    const { data: tareasData } = await supabase
      .from('mkt_tareas')
      .select('*')
      .order('creado_en', { ascending: false })

    if (!tareasData) return

    // Para admin: ve todas. Para otros: solo las que creó o le asignaron
    let tareasIds: string[] = []
    if (u.rol === 'admin') {
      tareasIds = tareasData.map(t => t.id)
    } else {
      const { data: asignadas } = await supabase
        .from('mkt_tarea_asignados')
        .select('tarea_id')
        .eq('usuario_id', u.id)
      const idsAsignadas = (asignadas || []).map((a: any) => a.tarea_id)
      const idsPropias = tareasData.filter(t => t.creado_por === u.id).map(t => t.id)
      tareasIds = [...new Set([...idsAsignadas, ...idsPropias])]
    }

    const tareasFiltradas = tareasData.filter(t => tareasIds.includes(t.id))

    // Cargar asignados y etiquetas para cada tarea
    const tareasCompletas: Tarea[] = await Promise.all(
      tareasFiltradas.map(async t => {
        const { data: asignadosData } = await supabase
          .from('mkt_tarea_asignados')
          .select('usuario_id')
          .eq('tarea_id', t.id)

        const { data: etiquetasData } = await supabase
          .from('mkt_tarea_etiquetas')
          .select('etiqueta_id')
          .eq('tarea_id', t.id)

        const asignadosIds = (asignadosData || []).map((a: any) => a.usuario_id)
        const etiquetasIds = (etiquetasData || []).map((e: any) => e.etiqueta_id)

        const { data: asignadosUsuarios } = await supabase
          .from('mkt_usuarios')
          .select('*')
          .in('id', asignadosIds.length > 0 ? asignadosIds : ['none'])

        const { data: etiquetasObjetos } = await supabase
          .from('mkt_etiquetas')
          .select('*')
          .in('id', etiquetasIds.length > 0 ? etiquetasIds : ['none'])

        return {
          ...t,
          asignados: asignadosUsuarios || [],
          etiquetas: etiquetasObjetos || [],
        }
      })
    )

    setTareas(tareasCompletas)
  }

  async function crearTarea() {
    if (!form.titulo.trim() || !usuario) return

    const { data: nueva } = await supabase.from('mkt_tareas').insert({
      titulo: form.titulo,
      descripcion: form.descripcion || null,
      prioridad: form.prioridad,
      deadline: form.deadline || null,
      campana_id: form.campana_id || null,
      creado_por: usuario.id,
      estado: 'por_hacer',
    }).select().single()

    if (!nueva) return

    // Asignados
    if (form.asignados.length > 0) {
      await supabase.from('mkt_tarea_asignados').insert(
        form.asignados.map(uid => ({ tarea_id: nueva.id, usuario_id: uid }))
      )
    }

    // Etiquetas
    if (form.etiquetas.length > 0) {
      await supabase.from('mkt_tarea_etiquetas').insert(
        form.etiquetas.map(eid => ({ tarea_id: nueva.id, etiqueta_id: eid }))
      )
    }

    // Notificaciones a asignados
    for (const uid of form.asignados) {
      if (uid !== usuario.id) {
        await supabase.from('mkt_notificaciones').insert({
          usuario_id: uid,
          tipo: 'tarea_asignada',
          titulo: 'Te asignaron una tarea',
          mensaje: form.titulo,
          referencia_id: nueva.id,
          referencia_tipo: 'tarea',
        })
      }
    }

    setModalOpen(false)
    resetForm()
    fetchTareas(usuario)
  }

  async function cambiarEstado(tarea: Tarea, nuevoEstado: string) {
    if (nuevoEstado === 'hecho') {
      setTareaCompletando(tarea)
      setHorasModal(true)
      return
    }
    await supabase.from('mkt_tareas').update({ estado: nuevoEstado }).eq('id', tarea.id)
    fetchTareas(usuario!)
  }

  async function confirmarHoras() {
    if (!tareaCompletando || !usuario) return
    await supabase.from('mkt_tareas').update({
      estado: 'hecho',
      horas_dedicadas: horasValor ? parseFloat(horasValor) : null,
    }).eq('id', tareaCompletando.id)
    setHorasModal(false)
    setHorasValor('')
    setTareaCompletando(null)
    fetchTareas(usuario)
  }

  async function eliminarTarea(tarea: Tarea) {
    if (!confirm('¿Eliminás esta tarea?')) return
    await supabase.from('mkt_tareas').delete().eq('id', tarea.id)
    fetchTareas(usuario!)
  }

  async function crearEtiqueta() {
    if (!nuevaEtiqueta.nombre.trim() || !usuario) return
    await supabase.from('mkt_etiquetas').insert({
      nombre: nuevaEtiqueta.nombre,
      color: nuevaEtiqueta.color,
      creado_por: usuario.id,
      es_predeterminada: false,
    })
    setNuevaEtiqueta({ nombre: '', color: '#f15922' })
    setNuevaEtiquetaModal(false)
    fetchEtiquetas()
  }

  function resetForm() {
    setForm({ titulo: '', descripcion: '', prioridad: 'media', deadline: '', campana_id: '', asignados: [], etiquetas: [] })
  }

  function toggleAsignado(uid: string) {
    setForm(f => ({
      ...f,
      asignados: f.asignados.includes(uid)
        ? f.asignados.filter(id => id !== uid)
        : [...f.asignados, uid]
    }))
  }

  function toggleEtiqueta(eid: string) {
    setForm(f => ({
      ...f,
      etiquetas: f.etiquetas.includes(eid)
        ? f.etiquetas.filter(id => id !== eid)
        : [...f.etiquetas, eid]
    }))
  }

  const puedeEditar = (tarea: Tarea) =>
    usuario?.rol === 'admin' ||
    tarea.creado_por === usuario?.id ||
    tarea.asignados.some(a => a.id === usuario?.id)

  if (!usuario) return null

  return (
    <div style={{ height: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1a1a1a' }}>✅ Tareas</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {/* Toggle vista */}
          <div style={{ display: 'flex', border: '1.5px solid #e8e8e8', borderRadius: '8px', overflow: 'hidden' }}>
            {(['kanban', 'lista'] as const).map(v => (
              <button key={v} onClick={() => setVista(v)} style={{
                padding: '0.375rem 0.875rem',
                border: 'none',
                backgroundColor: vista === v ? '#f15922' : '#fff',
                color: vista === v ? '#fff' : '#666',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: vista === v ? 600 : 400,
              }}>
                {v === 'kanban' ? '⬛ Kanban' : '☰ Lista'}
              </button>
            ))}
          </div>
          <button onClick={() => { resetForm(); setModalOpen(true) }} style={{
            backgroundColor: '#f15922', color: '#fff', border: 'none',
            borderRadius: '8px', padding: '0.5rem 1rem', fontWeight: 600,
            fontSize: '0.875rem', cursor: 'pointer',
          }}>
            + Nueva tarea
          </button>
        </div>
      </div>

      {/* VISTA KANBAN */}
      {vista === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', alignItems: 'start' }}>
          {COLUMNAS.map(col => {
            const tareaCol = tareas.filter(t => t.estado === col.key)
            return (
              <div key={col.key} style={{
                backgroundColor: col.bg,
                borderRadius: '12px',
                padding: '1rem',
                border: '1.5px solid #e8e8e8',
                minHeight: 200,
              }}>
                {/* Header columna */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: col.color }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {col.label}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#888', backgroundColor: '#fff', padding: '2px 8px', borderRadius: '99px', border: '1px solid #e8e8e8' }}>
                    {tareaCol.length}
                  </span>
                </div>

                {/* Tarjetas */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {tareaCol.map(tarea => (
                    <TareaCard
                      key={tarea.id}
                      tarea={tarea}
                      columnas={COLUMNAS}
                      puedeEditar={puedeEditar(tarea)}
                      onCambiarEstado={cambiarEstado}
                      onEliminar={eliminarTarea}
                      onSeleccionar={setTareaSeleccionada}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* VISTA LISTA */}
      {vista === 'lista' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {tareas.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
              No hay tareas todavía.
            </div>
          )}
          {tareas.map(tarea => (
            <div key={tarea.id} style={{
              backgroundColor: '#fff',
              border: '1.5px solid #e8e8e8',
              borderRadius: '10px',
              padding: '0.875rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: PRIORIDAD_COLOR[tarea.prioridad], flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1a1a1a' }}>{tarea.titulo}</p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                  {tarea.etiquetas.map(e => (
                    <span key={e.id} style={{ fontSize: '0.65rem', backgroundColor: e.color + '22', color: e.color, padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                      {e.nombre}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {tarea.asignados.slice(0, 3).map(a => (
                  <div key={a.id} title={a.nombre} style={{
                    width: 26, height: 26, borderRadius: '50%',
                    backgroundColor: a.avatar_color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem',
                  }}>
                    {a.avatar_emoji}
                  </div>
                ))}
              </div>
              {tarea.deadline && (
                <span style={{ fontSize: '0.75rem', color: '#888', whiteSpace: 'nowrap' }}>
                  📅 {new Date(tarea.deadline + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                </span>
              )}
              <span style={{
                fontSize: '0.7rem', fontWeight: 600, padding: '3px 10px', borderRadius: '99px',
                backgroundColor: tarea.estado === 'hecho' ? '#f0fdf4' : tarea.estado === 'en_progreso' ? '#fffbeb' : '#f9fafb',
                color: tarea.estado === 'hecho' ? '#10b981' : tarea.estado === 'en_progreso' ? '#f59e0b' : '#6b7280',
              }}>
                {COLUMNAS.find(c => c.key === tarea.estado)?.label}
              </span>
              {puedeEditar(tarea) && (
                <button onClick={() => eliminarTarea(tarea)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: '1rem'
                }}>✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* MODAL NUEVA TAREA */}
      {modalOpen && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem',
        }} onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: '16px', padding: '2rem',
            width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem', color: '#1a1a1a' }}>
              Nueva tarea
            </h2>

            {/* Título */}
            <Campo label="Título *">
              <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="¿Qué hay que hacer?"
                style={inputStyle} />
            </Campo>

            {/* Descripción */}
            <Campo label="Descripción">
              <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Detalles opcionales..."
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }} />
            </Campo>

            {/* Prioridad y Deadline */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Campo label="Prioridad">
                <select value={form.prioridad} onChange={e => setForm(f => ({ ...f, prioridad: e.target.value }))}
                  style={inputStyle}>
                  <option value="baja">🟢 Baja</option>
                  <option value="media">🟡 Media</option>
                  <option value="alta">🔴 Alta</option>
                </select>
              </Campo>
              <Campo label="Deadline">
                <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                  style={inputStyle} />
              </Campo>
            </div>

            {/* Campaña */}
            {campanas.length > 0 && (
              <Campo label="Campaña (opcional)">
                <select value={form.campana_id} onChange={e => setForm(f => ({ ...f, campana_id: e.target.value }))}
                  style={inputStyle}>
                  <option value="">Sin campaña</option>
                  {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </Campo>
            )}

            {/* Asignados */}
            <Campo label="Asignar a">
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {todosUsuarios.map(u => (
                  <button key={u.id} onClick={() => toggleAsignado(u.id)} style={{
                    display: 'flex', alignItems: 'center', gap: '0.375rem',
                    padding: '0.375rem 0.75rem', borderRadius: '99px',
                    border: form.asignados.includes(u.id) ? '2px solid #f15922' : '1.5px solid #e8e8e8',
                    backgroundColor: form.asignados.includes(u.id) ? '#f9ddd3' : '#fff',
                    cursor: 'pointer', fontSize: '0.8rem', color: '#1a1a1a',
                  }}>
                    <span>{u.avatar_emoji}</span> {u.nombre}
                  </button>
                ))}
              </div>
            </Campo>

            {/* Etiquetas */}
            <Campo label="Etiquetas">
              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                {etiquetas.map(e => (
                  <button key={e.id} onClick={() => toggleEtiqueta(e.id)} style={{
                    padding: '0.25rem 0.625rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                    border: form.etiquetas.includes(e.id) ? `2px solid ${e.color}` : '1.5px solid #e8e8e8',
                    backgroundColor: form.etiquetas.includes(e.id) ? e.color + '22' : '#fff',
                    color: form.etiquetas.includes(e.id) ? e.color : '#666',
                    cursor: 'pointer',
                  }}>
                    {e.nombre}
                  </button>
                ))}
                <button onClick={() => setNuevaEtiquetaModal(true)} style={{
                  padding: '0.25rem 0.625rem', borderRadius: '4px', fontSize: '0.75rem',
                  border: '1.5px dashed #e8e8e8', backgroundColor: '#fff', color: '#888', cursor: 'pointer',
                }}>
                  + Nueva
                </button>
              </div>
            </Campo>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button onClick={() => setModalOpen(false)} style={{
                flex: 1, padding: '0.625rem', border: '1.5px solid #e8e8e8',
                borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.875rem', color: '#555',
              }}>Cancelar</button>
              <button onClick={crearTarea} style={{
                flex: 2, padding: '0.625rem', border: 'none',
                borderRadius: '8px', backgroundColor: '#f15922', color: '#fff',
                cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
              }}>Crear tarea</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL HORAS AL COMPLETAR */}
      {horasModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
        }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: '16px', padding: '2rem',
            width: '100%', maxWidth: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}>
            <p style={{ fontSize: '1.5rem', textAlign: 'center', marginBottom: '0.5rem' }}>🎉</p>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, textAlign: 'center', marginBottom: '0.25rem' }}>
              ¡Tarea completada!
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#888', textAlign: 'center', marginBottom: '1.5rem' }}>
              ¿Cuántas horas le dedicaste? (opcional)
            </p>
            <input
              type="number"
              min="0"
              step="0.5"
              value={horasValor}
              onChange={e => setHorasValor(e.target.value)}
              placeholder="Ej: 2.5"
              style={{ ...inputStyle, textAlign: 'center', marginBottom: '1rem' }}
            />
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => { setHorasModal(false); setHorasValor(''); setTareaCompletando(null) }} style={{
                flex: 1, padding: '0.625rem', border: '1.5px solid #e8e8e8',
                borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.875rem', color: '#555',
              }}>Omitir</button>
              <button onClick={confirmarHoras} style={{
                flex: 2, padding: '0.625rem', border: 'none',
                borderRadius: '8px', backgroundColor: '#10b981', color: '#fff',
                cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
              }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA ETIQUETA */}
      {nuevaEtiquetaModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200,
        }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: '16px', padding: '1.5rem',
            width: '100%', maxWidth: 320, boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Nueva etiqueta</h3>
            <Campo label="Nombre">
              <input value={nuevaEtiqueta.nombre} onChange={e => setNuevaEtiqueta(n => ({ ...n, nombre: e.target.value }))}
                placeholder="Ej: SEO" style={inputStyle} />
            </Campo>
            <Campo label="Color">
              <input type="color" value={nuevaEtiqueta.color} onChange={e => setNuevaEtiqueta(n => ({ ...n, color: e.target.value }))}
                style={{ width: '100%', height: 40, borderRadius: '8px', border: '1.5px solid #e8e8e8', cursor: 'pointer' }} />
            </Campo>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button onClick={() => setNuevaEtiquetaModal(false)} style={{
                flex: 1, padding: '0.5rem', border: '1.5px solid #e8e8e8',
                borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.875rem',
              }}>Cancelar</button>
              <button onClick={crearEtiqueta} style={{
                flex: 2, padding: '0.5rem', border: 'none',
                borderRadius: '8px', backgroundColor: '#f15922', color: '#fff',
                cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
              }}>Crear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Componente TareaCard
function TareaCard({ tarea, columnas, puedeEditar, onCambiarEstado, onEliminar, onSeleccionar }: {
  tarea: Tarea
  columnas: typeof COLUMNAS
  puedeEditar: boolean
  onCambiarEstado: (t: Tarea, estado: string) => void
  onEliminar: (t: Tarea) => void
  onSeleccionar: (t: Tarea) => void
}) {
  const hoy = new Date().toISOString().split('T')[0]
  const en3dias = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const vencida = tarea.deadline && tarea.deadline < hoy && tarea.estado !== 'hecho'
  const proximaVencer = tarea.deadline && tarea.deadline <= en3dias && tarea.deadline >= hoy

  return (
    <div style={{
      backgroundColor: '#fff',
      border: `1.5px solid ${vencida ? '#fecaca' : '#e8e8e8'}`,
      borderRadius: '10px',
      padding: '0.875rem',
      cursor: 'pointer',
      transition: 'box-shadow 0.15s ease',
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      {/* Prioridad + título */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <div style={{
          width: 3, borderRadius: '99px', flexShrink: 0,
          backgroundColor: PRIORIDAD_COLOR[tarea.prioridad],
          minHeight: 16,
        }} />
        <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1a1a1a', lineHeight: 1.3 }}>
          {tarea.titulo}
        </p>
      </div>

      {/* Etiquetas */}
      {tarea.etiquetas.length > 0 && (
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          {tarea.etiquetas.map(e => (
            <span key={e.id} style={{
              fontSize: '0.6rem', fontWeight: 600,
              backgroundColor: e.color + '22', color: e.color,
              padding: '2px 6px', borderRadius: '4px',
            }}>{e.nombre}</span>
          ))}
        </div>
      )}

      {/* Deadline */}
      {tarea.deadline && (
        <p style={{ fontSize: '0.7rem', color: vencida ? '#ef4444' : proximaVencer ? '#f59e0b' : '#888', marginBottom: '0.5rem' }}>
          📅 {new Date(tarea.deadline + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
          {vencida && ' · Vencida'}
          {proximaVencer && !vencida && ' · Próxima'}
        </p>
      )}

      {/* Asignados */}
      {tarea.asignados.length > 0 && (
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
          {tarea.asignados.slice(0, 4).map(a => (
            <div key={a.id} title={a.nombre} style={{
              width: 22, height: 22, borderRadius: '50%',
              backgroundColor: a.avatar_color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.65rem',
            }}>{a.avatar_emoji}</div>
          ))}
        </div>
      )}

      {/* Acciones */}
      {puedeEditar && (
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          {columnas.filter(c => c.key !== tarea.estado).map(c => (
            <button key={c.key} onClick={() => onCambiarEstado(tarea, c.key)} style={{
              fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px',
              border: '1px solid #e8e8e8', backgroundColor: '#f9fafb',
              color: '#555', cursor: 'pointer',
            }}>
              → {c.label}
            </button>
          ))}
          <button onClick={() => onEliminar(tarea)} style={{
            fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px',
            border: '1px solid #fecaca', backgroundColor: '#fef2f2',
            color: '#ef4444', cursor: 'pointer', marginLeft: 'auto',
          }}>✕</button>
        </div>
      )}
    </div>
  )
}

// Helpers
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '0.375rem' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.625rem 0.875rem',
  border: '1.5px solid #e8e8e8',
  borderRadius: '8px',
  fontSize: '0.875rem',
  outline: 'none',
  color: '#1a1a1a',
  backgroundColor: '#fff',
}
