'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Usuario = { id: string; nombre: string; slug: string; avatar_color: string; avatar_emoji: string; rol: string; activo: boolean }
type Plantilla = { id: string; nombre: string; categoria: string; contenido: string; variables: any[]; activa: boolean }
type Etiqueta = { id: string; nombre: string; color: string; es_predeterminada: boolean }
type Manual = { id: string; titulo: string; descripcion: string | null; categoria: string; tipo: string; url: string | null; nombre_archivo: string | null; activo: boolean }
type Tarea = { id: string; titulo: string; estado: string; prioridad: string; deadline: string; creado_por: string; asignados: Usuario[] }

const EMOJIS = ['😊','🧡','⭐','🌟','💪','🎯','🚀','🌸','🦋','🎨','📱','💡','🔥','✨','🌈','👑','🎤','📸']
const COLORES_AVATAR = ['#f15922','#3B82F6','#8B5CF6','#10B981','#F59E0B','#EC4899','#06B6D4','#84CC16','#F97316','#6366F1']
const CATEGORIAS_MANUAL = ['Identidad visual','Procesos','Herramientas','General']
const CATEGORIAS_PLANTILLA = ['Cursos','Congresos','Productos','Institucional','General']
const PRIORIDAD_COLOR: Record<string,string> = { alta:'#ef4444', media:'#f59e0b', baja:'#10b981' }
const ESTADO_LABEL: Record<string,string> = { por_hacer:'Por hacer', en_progreso:'En progreso', hecho:'Hecho' }

const slugify = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')

const inputStyle: React.CSSProperties = { width:'100%', padding:'0.625rem 0.875rem', border:'1.5px solid #e8e8e8', borderRadius:'8px', fontSize:'0.875rem', outline:'none', color:'#1a1a1a', backgroundColor:'#fff' }

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '0.375rem' }}>{label}</label>
      {children}
    </div>
  )
}

type Tab = 'usuarios' | 'plantillas' | 'etiquetas' | 'manuales' | 'tareas'

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('usuarios')
  const router = useRouter()

  // Usuarios
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [modalUsuario, setModalUsuario] = useState(false)
  const [editandoUsuario, setEditandoUsuario] = useState<Usuario | null>(null)
  const [formUsuario, setFormUsuario] = useState({ nombre:'', slug:'', avatar_color:'#f15922', avatar_emoji:'😊', rol:'mkt' })

  // Plantillas
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [modalPlantilla, setModalPlantilla] = useState(false)
  const [editandoPlantilla, setEditandoPlantilla] = useState<Plantilla | null>(null)
  const [formPlantilla, setFormPlantilla] = useState({ nombre:'', categoria:'General', contenido:'', variablesRaw:'' })

  // Etiquetas
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([])
  const [modalEtiqueta, setModalEtiqueta] = useState(false)
  const [editandoEtiqueta, setEditandoEtiqueta] = useState<Etiqueta | null>(null)
  const [formEtiqueta, setFormEtiqueta] = useState({ nombre:'', color:'#f15922' })

  // Manuales
  const [manuales, setManuales] = useState<Manual[]>([])
  const [modalManual, setModalManual] = useState(false)
  const [editandoManual, setEditandoManual] = useState<Manual | null>(null)
  const [formManual, setFormManual] = useState({ titulo:'', descripcion:'', categoria:'General', tipo:'link', url:'', nombre_archivo:'' })
  const [archivoManual, setArchivoManual] = useState<File | null>(null)
  const [subiendo, setSubiendo] = useState(false)

  // Tareas
  const [tareas, setTareas] = useState<Tarea[]>([])

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchUsuarios(); fetchPlantillas(); fetchEtiquetas(); fetchManuales(); fetchTareas()
  }, [])

  // FETCH
  async function fetchUsuarios() {
    const { data } = await supabase.from('mkt_usuarios').select('*').neq('slug','admin').order('creado_en', { ascending: true })
    setUsuarios(data || [])
  }
  async function fetchPlantillas() {
    const { data } = await supabase.from('mkt_plantillas').select('*').order('nombre')
    setPlantillas(data || [])
  }
  async function fetchEtiquetas() {
    const { data } = await supabase.from('mkt_etiquetas').select('*').order('nombre')
    setEtiquetas(data || [])
  }
  async function fetchManuales() {
    const { data } = await supabase.from('mkt_manuales').select('*').eq('activo', true).order('orden')
    setManuales(data || [])
  }
  async function fetchTareas() {
    const { data: td } = await supabase.from('mkt_tareas').select('*').order('deadline', { ascending: true })
    if (!td) return
    const completas = await Promise.all(td.map(async t => {
      const { data: ad } = await supabase.from('mkt_tarea_asignados').select('usuario_id').eq('tarea_id', t.id)
      const aIds = (ad || []).map((a: any) => a.usuario_id)
      const { data: au } = await supabase.from('mkt_usuarios').select('*').in('id', aIds.length > 0 ? aIds : ['00000000-0000-0000-0000-000000000000'])
      return { ...t, asignados: au || [] }
    }))
    setTareas(completas)
  }

  // USUARIOS
  async function guardarUsuario() {
    if (!formUsuario.nombre.trim()) return
    setLoading(true)
    const slug = formUsuario.slug || slugify(formUsuario.nombre)
    if (editandoUsuario) {
      await supabase.from('mkt_usuarios').update({ nombre: formUsuario.nombre, slug, avatar_color: formUsuario.avatar_color, avatar_emoji: formUsuario.avatar_emoji, rol: formUsuario.rol }).eq('id', editandoUsuario.id)
    } else {
      await supabase.from('mkt_usuarios').insert({ nombre: formUsuario.nombre, slug, avatar_color: formUsuario.avatar_color, avatar_emoji: formUsuario.avatar_emoji, rol: formUsuario.rol, activo: true })
    }
    await fetchUsuarios(); setModalUsuario(false); setLoading(false)
  }
  async function toggleActivoUsuario(u: Usuario) {
    await supabase.from('mkt_usuarios').update({ activo: !u.activo }).eq('id', u.id); fetchUsuarios()
  }
  async function eliminarUsuario(u: Usuario) {
    if (!confirm(`¿Eliminás a ${u.nombre}?`)) return
    await supabase.from('mkt_usuarios').delete().eq('id', u.id); fetchUsuarios()
  }

  // PLANTILLAS
  function parsearVariables(raw: string) {
    return raw.split('\n').filter(Boolean).map(line => { const [key,...rest] = line.split(':'); return { key: key.trim(), label: rest.join(':').trim() || key.trim() } })
  }
  async function guardarPlantilla() {
    if (!formPlantilla.nombre.trim()) return
    setLoading(true)
    const variables = parsearVariables(formPlantilla.variablesRaw)
    const payload = { nombre: formPlantilla.nombre, categoria: formPlantilla.categoria, contenido: formPlantilla.contenido, variables }
    if (editandoPlantilla) {
      await supabase.from('mkt_plantillas').update(payload).eq('id', editandoPlantilla.id)
    } else {
      await supabase.from('mkt_plantillas').insert({ ...payload, activa: true })
    }
    await fetchPlantillas(); setModalPlantilla(false); setLoading(false)
  }
  async function eliminarPlantilla(p: Plantilla) {
    if (!confirm(`¿Eliminás "${p.nombre}"?`)) return
    await supabase.from('mkt_plantillas').update({ activa: false }).eq('id', p.id); fetchPlantillas()
  }

  // ETIQUETAS
  async function guardarEtiqueta() {
    if (!formEtiqueta.nombre.trim()) return
    setLoading(true)
    if (editandoEtiqueta) {
      await supabase.from('mkt_etiquetas').update({ nombre: formEtiqueta.nombre, color: formEtiqueta.color }).eq('id', editandoEtiqueta.id)
    } else {
      await supabase.from('mkt_etiquetas').insert({ nombre: formEtiqueta.nombre, color: formEtiqueta.color, es_predeterminada: false })
    }
    await fetchEtiquetas(); setModalEtiqueta(false); setLoading(false)
  }
  async function eliminarEtiqueta(e: Etiqueta) {
    if (!confirm(`¿Eliminás la etiqueta "${e.nombre}"?`)) return
    await supabase.from('mkt_etiquetas').delete().eq('id', e.id); fetchEtiquetas()
  }

  // MANUALES
  async function guardarManual() {
    if (!formManual.titulo.trim()) return
    setLoading(true)
    let urlFinal = formManual.url
    let nombreArchivo = formManual.nombre_archivo
    if (archivoManual && formManual.tipo === 'archivo') {
      setSubiendo(true)
      const ext = archivoManual.name.split('.').pop()
      const path = `${Date.now()}.${ext}`
      const { data: uploadData } = await supabase.storage.from('mkt-manuales').upload(path, archivoManual)
      if (uploadData) { const { data: urlData } = supabase.storage.from('mkt-manuales').getPublicUrl(path); urlFinal = urlData.publicUrl; nombreArchivo = archivoManual.name }
      setSubiendo(false)
    }
    const payload = { titulo: formManual.titulo, descripcion: formManual.descripcion || null, categoria: formManual.categoria, tipo: formManual.tipo, url: urlFinal || null, nombre_archivo: nombreArchivo || null }
    if (editandoManual) {
      await supabase.from('mkt_manuales').update(payload).eq('id', editandoManual.id)
    } else {
      await supabase.from('mkt_manuales').insert({ ...payload, activo: true, orden: manuales.length })
    }
    await fetchManuales(); setModalManual(false); setLoading(false)
  }
  async function eliminarManual(m: Manual) {
    if (!confirm(`¿Eliminás "${m.titulo}"?`)) return
    await supabase.from('mkt_manuales').update({ activo: false }).eq('id', m.id); fetchManuales()
  }

  // TAREAS
  async function eliminarTarea(t: Tarea) {
    if (!confirm(`¿Eliminás la tarea "${t.titulo}"?`)) return
    await supabase.from('mkt_tareas').delete().eq('id', t.id); fetchTareas()
  }
  async function cambiarEstadoTarea(t: Tarea, estado: string) {
    await supabase.from('mkt_tareas').update({ estado }).eq('id', t.id); fetchTareas()
  }

  const TABS: { key: Tab; label: string; emoji: string }[] = [
    { key: 'usuarios', label: 'Usuarios', emoji: '👥' },
    { key: 'plantillas', label: 'Copys', emoji: '✍️' },
    { key: 'etiquetas', label: 'Etiquetas', emoji: '🏷️' },
    { key: 'manuales', label: 'Manuales', emoji: '📚' },
    { key: 'tareas', label: 'Tareas', emoji: '✅' },
  ]

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fafafa', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <button onClick={() => router.push('/')} style={{ background: 'none', border: '1.5px solid #e8e8e8', borderRadius: '8px', padding: '0.375rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem', color: '#555' }}>← Volver</button>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1a1a' }}>⚙️ Administración</h1>
            <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '2px' }}>Marketing Hub — Dental Medrano</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', backgroundColor: '#fff', border: '1.5px solid #e8e8e8', borderRadius: '12px', padding: '0.375rem', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, minWidth: 80, padding: '0.5rem 0.75rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: tab === t.key ? 700 : 400, backgroundColor: tab === t.key ? '#f15922' : 'transparent', color: tab === t.key ? '#fff' : '#555', transition: 'all 0.15s' }}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        {/* ===== USUARIOS ===== */}
        {tab === 'usuarios' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
              <button onClick={() => { setEditandoUsuario(null); setFormUsuario({ nombre:'', slug:'', avatar_color:'#f15922', avatar_emoji:'😊', rol:'mkt' }); setModalUsuario(true) }} style={{ backgroundColor: '#f15922', color: '#fff', border: 'none', borderRadius: '10px', padding: '0.625rem 1.25rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>+ Nuevo usuario</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {usuarios.length === 0 && <p style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>No hay usuarios todavía.</p>}
              {usuarios.map(u => (
                <div key={u.id} style={{ backgroundColor: '#fff', border: '1.5px solid #e8e8e8', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', opacity: u.activo ? 1 : 0.5, flexWrap: 'wrap' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: u.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>{u.avatar_emoji}</div>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <p style={{ fontWeight: 600, color: '#1a1a1a', fontSize: '0.9rem' }}>{u.nombre}</p>
                      <span style={{ fontSize: '0.65rem', fontWeight: 600, color: u.rol === 'mkt_reporte' ? '#f15922' : '#3b82f6', backgroundColor: u.rol === 'mkt_reporte' ? '#f9ddd3' : '#eff6ff', padding: '2px 8px', borderRadius: '99px', textTransform: 'uppercase' }}>
                        {u.rol === 'mkt_reporte' ? 'MKT + Reporte' : 'MKT'}
                      </span>
                      {!u.activo && <span style={{ fontSize: '0.65rem', color: '#888', backgroundColor: '#f4f4f4', padding: '2px 8px', borderRadius: '99px' }}>inactivo</span>}
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#a0a0a0', marginTop: '2px' }}>/{u.slug}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button onClick={() => { setEditandoUsuario(u); setFormUsuario({ nombre: u.nombre, slug: u.slug, avatar_color: u.avatar_color, avatar_emoji: u.avatar_emoji, rol: u.rol }); setModalUsuario(true) }} style={{ background: '#f4f4f4', border: 'none', borderRadius: '8px', padding: '0.375rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', color: '#444' }}>Editar</button>
                    <button onClick={() => toggleActivoUsuario(u)} style={{ background: u.activo ? '#fffbeb' : '#f0fdf4', border: 'none', borderRadius: '8px', padding: '0.375rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', color: u.activo ? '#f59e0b' : '#10b981' }}>{u.activo ? 'Desactivar' : 'Activar'}</button>
                    <button onClick={() => eliminarUsuario(u)} style={{ background: '#fef2f2', border: 'none', borderRadius: '8px', padding: '0.375rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', color: '#ef4444' }}>Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ===== PLANTILLAS ===== */}
        {tab === 'plantillas' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
              <button onClick={() => { setEditandoPlantilla(null); setFormPlantilla({ nombre:'', categoria:'General', contenido:'', variablesRaw:'' }); setModalPlantilla(true) }} style={{ backgroundColor: '#f15922', color: '#fff', border: 'none', borderRadius: '10px', padding: '0.625rem 1.25rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>+ Nueva plantilla</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {plantillas.filter(p => p.activa).map(p => (
                <div key={p.id} style={{ backgroundColor: '#fff', border: '1.5px solid #e8e8e8', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <p style={{ fontWeight: 600, color: '#1a1a1a', fontSize: '0.9rem' }}>{p.nombre}</p>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '2px' }}>
                      <span style={{ fontSize: '0.7rem', color: '#888', backgroundColor: '#f4f4f4', padding: '2px 8px', borderRadius: '99px' }}>{p.categoria}</span>
                      <span style={{ fontSize: '0.7rem', color: '#888' }}>{p.variables.length} variables</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => { setEditandoPlantilla(p); setFormPlantilla({ nombre: p.nombre, categoria: p.categoria, contenido: p.contenido, variablesRaw: p.variables.map((v: any) => `${v.key}:${v.label}`).join('\n') }); setModalPlantilla(true) }} style={{ background: '#f4f4f4', border: 'none', borderRadius: '8px', padding: '0.375rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', color: '#444' }}>Editar</button>
                    <button onClick={() => eliminarPlantilla(p)} style={{ background: '#fef2f2', border: 'none', borderRadius: '8px', padding: '0.375rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', color: '#ef4444' }}>Eliminar</button>
                  </div>
                </div>
              ))}
              {plantillas.filter(p => p.activa).length === 0 && <p style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>No hay plantillas todavía.</p>}
            </div>
          </>
        )}

        {/* ===== ETIQUETAS ===== */}
        {tab === 'etiquetas' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
              <button onClick={() => { setEditandoEtiqueta(null); setFormEtiqueta({ nombre:'', color:'#f15922' }); setModalEtiqueta(true) }} style={{ backgroundColor: '#f15922', color: '#fff', border: 'none', borderRadius: '10px', padding: '0.625rem 1.25rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>+ Nueva etiqueta</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {etiquetas.map(e => (
                <div key={e.id} style={{ backgroundColor: '#fff', border: '1.5px solid #e8e8e8', borderRadius: '10px', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: e.color, flexShrink: 0 }} />
                  <p style={{ flex: 1, fontWeight: 600, color: '#1a1a1a', fontSize: '0.875rem' }}>{e.nombre}</p>
                  {e.es_predeterminada && <span style={{ fontSize: '0.65rem', color: '#888', backgroundColor: '#f4f4f4', padding: '2px 8px', borderRadius: '99px' }}>predeterminada</span>}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => { setEditandoEtiqueta(e); setFormEtiqueta({ nombre: e.nombre, color: e.color }); setModalEtiqueta(true) }} style={{ background: '#f4f4f4', border: 'none', borderRadius: '8px', padding: '0.375rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', color: '#444' }}>Editar</button>
                    <button onClick={() => eliminarEtiqueta(e)} style={{ background: '#fef2f2', border: 'none', borderRadius: '8px', padding: '0.375rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', color: '#ef4444' }}>Eliminar</button>
                  </div>
                </div>
              ))}
              {etiquetas.length === 0 && <p style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>No hay etiquetas.</p>}
            </div>
          </>
        )}

        {/* ===== MANUALES ===== */}
        {tab === 'manuales' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
              <button onClick={() => { setEditandoManual(null); setFormManual({ titulo:'', descripcion:'', categoria:'General', tipo:'link', url:'', nombre_archivo:'' }); setArchivoManual(null); setModalManual(true) }} style={{ backgroundColor: '#f15922', color: '#fff', border: 'none', borderRadius: '10px', padding: '0.625rem 1.25rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>+ Agregar recurso</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {manuales.map(m => (
                <div key={m.id} style={{ backgroundColor: '#fff', border: '1.5px solid #e8e8e8', borderRadius: '10px', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1.25rem' }}>{m.tipo === 'link' ? '🔗' : m.tipo === 'archivo' ? '📎' : '📄'}</span>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <p style={{ fontWeight: 600, color: '#1a1a1a', fontSize: '0.875rem' }}>{m.titulo}</p>
                    <span style={{ fontSize: '0.7rem', color: '#888', backgroundColor: '#f4f4f4', padding: '2px 8px', borderRadius: '99px' }}>{m.categoria}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => { setEditandoManual(m); setFormManual({ titulo: m.titulo, descripcion: m.descripcion || '', categoria: m.categoria, tipo: m.tipo, url: m.url || '', nombre_archivo: m.nombre_archivo || '' }); setModalManual(true) }} style={{ background: '#f4f4f4', border: 'none', borderRadius: '8px', padding: '0.375rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', color: '#444' }}>Editar</button>
                    <button onClick={() => eliminarManual(m)} style={{ background: '#fef2f2', border: 'none', borderRadius: '8px', padding: '0.375rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', color: '#ef4444' }}>Eliminar</button>
                  </div>
                </div>
              ))}
              {manuales.length === 0 && <p style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>No hay recursos todavía.</p>}
            </div>
          </>
        )}

        {/* ===== TAREAS ===== */}
        {tab === 'tareas' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {tareas.length === 0 && <p style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>No hay tareas.</p>}
            {tareas.map(t => (
              <div key={t.id} style={{ backgroundColor: '#fff', border: '1.5px solid #e8e8e8', borderRadius: '10px', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: PRIORIDAD_COLOR[t.prioridad], flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 120 }}>
                  <p style={{ fontWeight: 600, color: '#1a1a1a', fontSize: '0.875rem' }}>{t.titulo}</p>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '2px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.7rem', color: '#888' }}>📅 {new Date(t.deadline + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
                    <span style={{ fontSize: '0.7rem', color: '#888', backgroundColor: '#f4f4f4', padding: '2px 6px', borderRadius: '4px' }}>{ESTADO_LABEL[t.estado]}</span>
                    {t.asignados.map(a => <span key={a.id} style={{ fontSize: '0.7rem', backgroundColor: a.avatar_color + '22', color: a.avatar_color, padding: '2px 6px', borderRadius: '99px', fontWeight: 600 }}>{a.nombre.split(' ')[0]}</span>)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {t.estado !== 'hecho' && (
                    <select value={t.estado} onChange={e => cambiarEstadoTarea(t, e.target.value)} style={{ padding: '0.25rem 0.5rem', border: '1.5px solid #e8e8e8', borderRadius: '6px', fontSize: '0.75rem', color: '#555', backgroundColor: '#fff', cursor: 'pointer' }}>
                      <option value="por_hacer">Por hacer</option>
                      <option value="en_progreso">En progreso</option>
                      <option value="hecho">Hecho</option>
                    </select>
                  )}
                  <button onClick={() => eliminarTarea(t)} style={{ background: '#fef2f2', border: 'none', borderRadius: '8px', padding: '0.375rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', color: '#ef4444' }}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL USUARIO */}
      {modalUsuario && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setModalUsuario(false) }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem' }}>{editandoUsuario ? 'Editar usuario' : 'Nuevo usuario'}</h2>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', backgroundColor: formUsuario.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>{formUsuario.avatar_emoji}</div>
            </div>
            <Campo label="Nombre">
              <input value={formUsuario.nombre} onChange={e => setFormUsuario(f => ({ ...f, nombre: e.target.value, slug: slugify(e.target.value) }))} placeholder="Ej: Julieta García" style={inputStyle} />
            </Campo>
            <Campo label="URL del perfil">
              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #e8e8e8', borderRadius: '8px', overflow: 'hidden' }}>
                <span style={{ padding: '0.625rem 0.75rem', backgroundColor: '#f4f4f4', color: '#888', fontSize: '0.8rem', borderRight: '1px solid #e8e8e8' }}>/</span>
                <input value={formUsuario.slug} onChange={e => setFormUsuario(f => ({ ...f, slug: slugify(e.target.value) }))} style={{ flex: 1, padding: '0.625rem 0.75rem', border: 'none', fontSize: '0.875rem', outline: 'none', color: '#1a1a1a' }} />
              </div>
            </Campo>
            <Campo label="Rol">
              <select value={formUsuario.rol} onChange={e => setFormUsuario(f => ({ ...f, rol: e.target.value }))} style={inputStyle}>
                <option value="mkt">MKT — acceso general</option>
                <option value="mkt_reporte">MKT + Reporte — acceso general + reportes</option>
              </select>
            </Campo>
            <Campo label="Emoji">
              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => setFormUsuario(f => ({ ...f, avatar_emoji: e }))} style={{ width: 36, height: 36, borderRadius: '8px', fontSize: '1.1rem', border: formUsuario.avatar_emoji === e ? '2px solid #f15922' : '1.5px solid #e8e8e8', backgroundColor: formUsuario.avatar_emoji === e ? '#f9ddd3' : '#fff', cursor: 'pointer' }}>{e}</button>
                ))}
              </div>
            </Campo>
            <Campo label="Color del avatar">
              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                {COLORES_AVATAR.map(c => (
                  <button key={c} onClick={() => setFormUsuario(f => ({ ...f, avatar_color: c }))} style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: c, border: 'none', outline: formUsuario.avatar_color === c ? '3px solid #1a1a1a' : 'none', cursor: 'pointer' }} />
                ))}
              </div>
            </Campo>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setModalUsuario(false)} style={{ flex: 1, padding: '0.625rem', border: '1.5px solid #e8e8e8', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.875rem', color: '#555' }}>Cancelar</button>
              <button onClick={guardarUsuario} disabled={loading} style={{ flex: 2, padding: '0.625rem', border: 'none', borderRadius: '8px', backgroundColor: '#f15922', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>{loading ? 'Guardando...' : editandoUsuario ? 'Guardar cambios' : 'Crear usuario'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PLANTILLA */}
      {modalPlantilla && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setModalPlantilla(false) }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: 600, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem' }}>{editandoPlantilla ? 'Editar plantilla' : 'Nueva plantilla'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Campo label="Nombre *"><input value={formPlantilla.nombre} onChange={e => setFormPlantilla(f => ({ ...f, nombre: e.target.value }))} style={inputStyle} /></Campo>
              <Campo label="Categoría">
                <select value={formPlantilla.categoria} onChange={e => setFormPlantilla(f => ({ ...f, categoria: e.target.value }))} style={inputStyle}>
                  {CATEGORIAS_PLANTILLA.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Campo>
            </div>
            <Campo label="Contenido (usá {{variable}} para marcar campos)">
              <textarea value={formPlantilla.contenido} onChange={e => setFormPlantilla(f => ({ ...f, contenido: e.target.value }))} rows={10} placeholder="Pegá el texto y marcá con {{nombre_variable}}" style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem' }} />
            </Campo>
            <Campo label="Variables (una por línea: clave:Etiqueta)">
              <textarea value={formPlantilla.variablesRaw} onChange={e => setFormPlantilla(f => ({ ...f, variablesRaw: e.target.value }))} rows={5} placeholder={'dictante:Dictante/s\nfecha_curso:Fecha del curso'} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem' }} />
            </Campo>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setModalPlantilla(false)} style={{ flex: 1, padding: '0.625rem', border: '1.5px solid #e8e8e8', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.875rem', color: '#555' }}>Cancelar</button>
              <button onClick={guardarPlantilla} disabled={loading} style={{ flex: 2, padding: '0.625rem', border: 'none', borderRadius: '8px', backgroundColor: '#f15922', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>{loading ? 'Guardando...' : editandoPlantilla ? 'Guardar cambios' : 'Crear plantilla'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ETIQUETA */}
      {modalEtiqueta && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setModalEtiqueta(false) }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem' }}>{editandoEtiqueta ? 'Editar etiqueta' : 'Nueva etiqueta'}</h2>
            <Campo label="Nombre"><input value={formEtiqueta.nombre} onChange={e => setFormEtiqueta(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: SEO" style={inputStyle} /></Campo>
            <Campo label="Color"><input type="color" value={formEtiqueta.color} onChange={e => setFormEtiqueta(f => ({ ...f, color: e.target.value }))} style={{ width: '100%', height: 40, borderRadius: '8px', border: '1.5px solid #e8e8e8', cursor: 'pointer' }} /></Campo>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setModalEtiqueta(false)} style={{ flex: 1, padding: '0.625rem', border: '1.5px solid #e8e8e8', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.875rem', color: '#555' }}>Cancelar</button>
              <button onClick={guardarEtiqueta} disabled={loading} style={{ flex: 2, padding: '0.625rem', border: 'none', borderRadius: '8px', backgroundColor: '#f15922', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>{loading ? 'Guardando...' : editandoEtiqueta ? 'Guardar' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MANUAL */}
      {modalManual && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setModalManual(false) }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem' }}>{editandoManual ? 'Editar recurso' : 'Nuevo recurso'}</h2>
            <Campo label="Título *"><input value={formManual.titulo} onChange={e => setFormManual(f => ({ ...f, titulo: e.target.value }))} style={inputStyle} /></Campo>
            <Campo label="Descripción"><textarea value={formManual.descripcion} onChange={e => setFormManual(f => ({ ...f, descripcion: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></Campo>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Campo label="Categoría">
                <select value={formManual.categoria} onChange={e => setFormManual(f => ({ ...f, categoria: e.target.value }))} style={inputStyle}>
                  {CATEGORIAS_MANUAL.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Campo>
              <Campo label="Tipo">
                <select value={formManual.tipo} onChange={e => setFormManual(f => ({ ...f, tipo: e.target.value }))} style={inputStyle}>
                  <option value="link">🔗 Link externo</option>
                  <option value="archivo">📎 Archivo</option>
                  <option value="documento">📄 Documento</option>
                </select>
              </Campo>
            </div>
            {formManual.tipo !== 'archivo' ? (
              <Campo label="URL"><input value={formManual.url} onChange={e => setFormManual(f => ({ ...f, url: e.target.value }))} placeholder="https://..." style={inputStyle} /></Campo>
            ) : (
              <Campo label="Archivo"><input type="file" onChange={e => setArchivoManual(e.target.files?.[0] || null)} style={{ ...inputStyle, padding: '0.5rem' }} /></Campo>
            )}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setModalManual(false)} style={{ flex: 1, padding: '0.625rem', border: '1.5px solid #e8e8e8', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.875rem', color: '#555' }}>Cancelar</button>
              <button onClick={guardarManual} disabled={loading || subiendo} style={{ flex: 2, padding: '0.625rem', border: 'none', borderRadius: '8px', backgroundColor: '#f15922', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>{subiendo ? 'Subiendo...' : loading ? 'Guardando...' : editandoManual ? 'Guardar cambios' : 'Agregar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
