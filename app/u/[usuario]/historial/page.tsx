'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type HistorialItem = {
  id: string; usuario_id: string; tarea_id: string | null
  tarea_titulo: string; accion: string; detalle: string | null
  creado_en: string; usuario?: any
}

const ACCION_INFO: Record<string, { label: string; emoji: string; color: string }> = {
  tarea_creada: { label: 'Creó una tarea', emoji: '✅', color: '#10b981' },
  tarea_editada: { label: 'Editó una tarea', emoji: '✏️', color: '#3b82f6' },
  tarea_movida: { label: 'Movió una tarea', emoji: '↕️', color: '#f59e0b' },
  tarea_eliminada: { label: 'Eliminó una tarea', emoji: '🗑️', color: '#ef4444' },
  comentario_agregado: { label: 'Comentó en una tarea', emoji: '💬', color: '#8b5cf6' },
}

export default function HistorialPage() {
  const [usuario, setUsuario] = useState<any>(null)
  const [historial, setHistorial] = useState<HistorialItem[]>([])
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [filtroAccion, setFiltroAccion] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = sessionStorage.getItem('mkt_usuario')
    if (stored) { setUsuario(JSON.parse(stored)); fetchUsuarios(); fetchHistorial() }
  }, [])

  async function fetchUsuarios() {
    const { data } = await supabase.from('mkt_usuarios').select('*').eq('activo', true)
    setUsuarios(data || [])
  }

  async function fetchHistorial() {
    const { data } = await supabase.from('mkt_historial').select('*').order('creado_en', { ascending: false }).limit(200)
    if (!data) { setLoading(false); return }
    const { data: us } = await supabase.from('mkt_usuarios').select('id, nombre, avatar_emoji, avatar_color')
    const map = Object.fromEntries((us || []).map(u => [u.id, u]))
    setHistorial(data.map(item => ({ ...item, usuario: map[item.usuario_id] })))
    setLoading(false)
  }

  const historialFiltrado = historial.filter(item => {
    if (filtroUsuario && item.usuario_id !== filtroUsuario) return false
    if (filtroAccion && item.accion !== filtroAccion) return false
    return true
  })

  function agruparPorFecha(items: HistorialItem[]) {
    const grupos: Record<string, HistorialItem[]> = {}
    items.forEach(item => {
      const fecha = new Date(item.creado_en).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
      if (!grupos[fecha]) grupos[fecha] = []
      grupos[fecha].push(item)
    })
    return grupos
  }

  const grupos = agruparPorFecha(historialFiltrado)

  if (!usuario) return null

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: 'clamp(1.25rem, 4vw, 1.6rem)', fontWeight: 700, color: '#1a1a1a' }}>🕐 Historial</h1>
        <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '0.25rem' }}>Todo lo que hizo el equipo con las tareas</p>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <select value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)} style={{ padding: '0.375rem 0.75rem', border: '1.5px solid #e8e8e8', borderRadius: '8px', fontSize: '0.8rem', color: '#555', backgroundColor: '#fff', cursor: 'pointer' }}>
          <option value="">Todos los usuarios</option>
          {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
        <select value={filtroAccion} onChange={e => setFiltroAccion(e.target.value)} style={{ padding: '0.375rem 0.75rem', border: '1.5px solid #e8e8e8', borderRadius: '8px', fontSize: '0.8rem', color: '#555', backgroundColor: '#fff', cursor: 'pointer' }}>
          <option value="">Todas las acciones</option>
          {Object.entries(ACCION_INFO).map(([key, val]) => <option key={key} value={key}>{val.emoji} {val.label}</option>)}
        </select>
        {(filtroUsuario || filtroAccion) && (
          <button onClick={() => { setFiltroUsuario(''); setFiltroAccion('') }} style={{ padding: '0.375rem 0.75rem', border: '1.5px solid #fecaca', borderRadius: '8px', fontSize: '0.8rem', color: '#ef4444', backgroundColor: '#fef2f2', cursor: 'pointer' }}>✕ Limpiar</button>
        )}
      </div>

      {loading ? (
        <p style={{ color: '#888', fontSize: '0.9rem' }}>Cargando...</p>
      ) : historialFiltrado.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#888' }}>
          <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🕐</p>
          <p style={{ fontWeight: 600 }}>No hay actividad todavía</p>
        </div>
      ) : (
        Object.entries(grupos).map(([fecha, items]) => (
          <div key={fecha} style={{ marginBottom: '2rem' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a0a0a0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid #f0f0f0' }}>
              {fecha}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {items.map(item => {
                const info = ACCION_INFO[item.accion] || { label: item.accion, emoji: '•', color: '#888' }
                return (
                  <div key={item.id} style={{ backgroundColor: '#fff', border: '1.5px solid #e8e8e8', borderRadius: '10px', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                    {item.usuario && (
                      <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, backgroundColor: item.usuario.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>{item.usuario.avatar_emoji}</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1a1a1a' }}>{item.usuario?.nombre || 'Usuario'}</span>
                        <span style={{ fontSize: '0.8rem', color: '#666' }}>{info.label}</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, backgroundColor: info.color + '18', color: info.color, padding: '1px 8px', borderRadius: '99px' }}>{info.emoji} {item.tarea_titulo}</span>
                      </div>
                      {item.detalle && <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>{item.detalle}</p>}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#a0a0a0', flexShrink: 0 }}>{new Date(item.creado_en).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
