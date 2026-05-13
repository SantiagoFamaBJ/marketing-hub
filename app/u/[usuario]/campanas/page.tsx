'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Usuario = { id: string; nombre: string; slug: string; avatar_color: string; avatar_emoji: string; rol: string }
type Campana = {
  id: string; nombre: string; descripcion: string | null; color: string
  fecha_inicio: string | null; fecha_fin: string | null; estado: string; creado_por: string
}

const ESTADOS = [
  { key: 'activa', label: 'Activa', color: '#10b981', bg: '#f0fdf4' },
  { key: 'pausada', label: 'Pausada', color: '#f59e0b', bg: '#fffbeb' },
  { key: 'completada', label: 'Completada', color: '#3b82f6', bg: '#eff6ff' },
  { key: 'archivada', label: 'Archivada', color: '#6b7280', bg: '#f9fafb' },
]

const COLORES = ['#f15922', '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#F97316']

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.625rem 0.875rem',
  border: '1.5px solid #e8e8e8', borderRadius: '8px',
  fontSize: '0.875rem', outline: 'none', color: '#1a1a1a', backgroundColor: '#fff',
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '0.375rem' }}>{label}</label>
      {children}
    </div>
  )
}

export default function CampanasPage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [campanas, setCampanas] = useState<Campana[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Campana | null>(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nombre: '', descripcion: '', color: '#f15922',
    fecha_inicio: '', fecha_fin: '', estado: 'activa',
  })

  useEffect(() => {
    const stored = sessionStorage.getItem('mkt_usuario')
    if (stored) { setUsuario(JSON.parse(stored)); fetchCampanas() }
  }, [])

  async function fetchCampanas() {
    const { data } = await supabase.from('mkt_campanas').select('*').order('creado_en', { ascending: false })
    setCampanas(data || [])
  }

  function abrirNueva() {
    setEditando(null)
    setForm({ nombre: '', descripcion: '', color: '#f15922', fecha_inicio: '', fecha_fin: '', estado: 'activa' })
    setModalOpen(true)
  }

  function abrirEditar(c: Campana) {
    setEditando(c)
    setForm({ nombre: c.nombre, descripcion: c.descripcion || '', color: c.color, fecha_inicio: c.fecha_inicio || '', fecha_fin: c.fecha_fin || '', estado: c.estado })
    setModalOpen(true)
  }

  async function guardar() {
    if (!form.nombre.trim() || !usuario) return
    setLoading(true)
    const payload = {
      nombre: form.nombre, descripcion: form.descripcion || null, color: form.color,
      fecha_inicio: form.fecha_inicio || null, fecha_fin: form.fecha_fin || null, estado: form.estado,
    }
    if (editando) {
      await supabase.from('mkt_campanas').update(payload).eq('id', editando.id)
    } else {
      await supabase.from('mkt_campanas').insert({ ...payload, creado_por: usuario.id })
    }
    await fetchCampanas()
    setModalOpen(false)
    setLoading(false)
  }

  async function eliminar(c: Campana) {
    if (!confirm(`¿Eliminás la campaña "${c.nombre}"?`)) return
    await supabase.from('mkt_campanas').delete().eq('id', c.id)
    fetchCampanas()
  }

  const puedeEditar = usuario?.rol === 'admin'

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1a1a1a' }}>📣 Campañas</h1>
          <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '0.25rem' }}>Organizá tareas y recursos por campaña</p>
        </div>
        {puedeEditar && (
          <button onClick={abrirNueva} style={{
            backgroundColor: '#f15922', color: '#fff', border: 'none',
            borderRadius: '10px', padding: '0.625rem 1.25rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
          }}>+ Nueva campaña</button>
        )}
      </div>

      {/* Grid de campañas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {campanas.map(c => {
          const estado = ESTADOS.find(e => e.key === c.estado)
          return (
            <div key={c.id} style={{
              backgroundColor: '#fff', border: '1.5px solid #e8e8e8',
              borderRadius: '14px', overflow: 'hidden',
              transition: 'box-shadow 0.15s ease',
            }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              {/* Barra de color */}
              <div style={{ height: 6, backgroundColor: c.color }} />
              <div style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1a1a1a' }}>{c.nombre}</h3>
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 600, padding: '2px 8px', borderRadius: '99px',
                    backgroundColor: estado?.bg, color: estado?.color,
                  }}>{estado?.label}</span>
                </div>
                {c.descripcion && (
                  <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.75rem', lineHeight: 1.4 }}>{c.descripcion}</p>
                )}
                {(c.fecha_inicio || c.fecha_fin) && (
                  <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.75rem' }}>
                    📅 {c.fecha_inicio ? new Date(c.fecha_inicio + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '?'}
                    {' → '}
                    {c.fecha_fin ? new Date(c.fecha_fin + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '?'}
                  </p>
                )}
                {puedeEditar && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => abrirEditar(c)} style={{
                      flex: 1, padding: '0.375rem', border: '1.5px solid #e8e8e8',
                      borderRadius: '7px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.775rem', color: '#555',
                    }}>Editar</button>
                    <button onClick={() => eliminar(c)} style={{
                      padding: '0.375rem 0.75rem', border: '1.5px solid #fecaca',
                      borderRadius: '7px', backgroundColor: '#fef2f2', cursor: 'pointer', fontSize: '0.775rem', color: '#ef4444',
                    }}>Eliminar</button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {campanas.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', color: '#888' }}>
            <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📣</p>
            <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>No hay campañas todavía</p>
            <p style={{ fontSize: '0.875rem' }}>Creá una para organizar tus tareas y recursos.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem',
        }} onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: '16px', padding: '2rem',
            width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem', color: '#1a1a1a' }}>
              {editando ? 'Editar campaña' : 'Nueva campaña'}
            </h2>
            <Campo label="Nombre *">
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Congreso AAPODE Mayo" style={inputStyle} />
            </Campo>
            <Campo label="Descripción">
              <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </Campo>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Campo label="Fecha inicio">
                <input type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} style={inputStyle} />
              </Campo>
              <Campo label="Fecha fin">
                <input type="date" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} style={inputStyle} />
              </Campo>
            </div>
            <Campo label="Estado">
              <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} style={inputStyle}>
                {ESTADOS.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
              </select>
            </Campo>
            <Campo label="Color">
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {COLORES.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{
                    width: 28, height: 28, borderRadius: '50%', backgroundColor: c, border: 'none',
                    outline: form.color === c ? '3px solid #1a1a1a' : 'none', cursor: 'pointer',
                  }} />
                ))}
              </div>
            </Campo>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setModalOpen(false)} style={{
                flex: 1, padding: '0.625rem', border: '1.5px solid #e8e8e8',
                borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.875rem', color: '#555',
              }}>Cancelar</button>
              <button onClick={guardar} disabled={loading} style={{
                flex: 2, padding: '0.625rem', border: 'none',
                borderRadius: '8px', backgroundColor: '#f15922', color: '#fff',
                cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
              }}>{loading ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear campaña'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
