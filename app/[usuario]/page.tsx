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

type Tarea = {
  id: string
  titulo: string
  estado: string
  prioridad: string
  deadline: string | null
}

export default function DashboardPage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [tareasHoy, setTareasHoy] = useState<Tarea[]>([])
  const [tareasProximas, setTareasProximas] = useState<Tarea[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = sessionStorage.getItem('mkt_usuario')
    if (stored) {
      const u = JSON.parse(stored)
      setUsuario(u)
      fetchData(u.id)
    }
  }, [])

  async function fetchData(userId: string) {
    const hoy = new Date().toISOString().split('T')[0]
    const en3dias = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Tareas del usuario (asignadas o creadas por él)
    const { data: asignadas } = await supabase
      .from('mkt_tarea_asignados')
      .select('tarea_id')
      .eq('usuario_id', userId)

    const tareaIds = (asignadas || []).map((a: any) => a.tarea_id)

    if (tareaIds.length > 0) {
      const { data: tareas } = await supabase
        .from('mkt_tareas')
        .select('*')
        .in('id', tareaIds)
        .neq('estado', 'hecho')

      const todas = tareas || []
      setTareasHoy(todas.filter(t => t.deadline === hoy))
      setTareasProximas(todas.filter(t => t.deadline > hoy && t.deadline <= en3dias))
    }

    setLoading(false)
  }

  const prioridadColor: Record<string, string> = {
    alta: '#ef4444',
    media: '#f59e0b',
    baja: '#10b981',
  }

  if (!usuario) return null

  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '0.25rem' }}>
          {saludo}, {usuario.nombre.split(' ')[0]} {usuario.avatar_emoji}
        </h1>
        <p style={{ color: '#888', fontSize: '0.9rem' }}>
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats rápidas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Vencen hoy', value: tareasHoy.length, color: '#ef4444', bg: '#fef2f2', emoji: '🔴' },
          { label: 'Próximos 3 días', value: tareasProximas.length, color: '#f59e0b', bg: '#fffbeb', emoji: '🟡' },
          { label: 'En progreso', value: 0, color: '#3b82f6', bg: '#eff6ff', emoji: '🔵' },
        ].map(stat => (
          <div key={stat.label} style={{
            backgroundColor: '#ffffff',
            border: '1.5px solid #e8e8e8',
            borderRadius: '12px',
            padding: '1.25rem',
          }}>
            <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.5rem' }}>{stat.emoji} {stat.label}</p>
            <p style={{ fontSize: '2rem', fontWeight: 700, color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tareas que vencen hoy */}
      {tareasHoy.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#1a1a1a', marginBottom: '0.75rem' }}>
            🔴 Vencen hoy
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {tareasHoy.map(tarea => (
              <div key={tarea.id} style={{
                backgroundColor: '#fff',
                border: '1.5px solid #fecaca',
                borderRadius: '10px',
                padding: '0.875rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: prioridadColor[tarea.prioridad], flexShrink: 0 }} />
                <p style={{ fontSize: '0.875rem', color: '#1a1a1a', flex: 1 }}>{tarea.titulo}</p>
                <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 600 }}>HOY</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Próximos vencimientos */}
      {tareasProximas.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#1a1a1a', marginBottom: '0.75rem' }}>
            🟡 Próximos 3 días
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {tareasProximas.map(tarea => (
              <div key={tarea.id} style={{
                backgroundColor: '#fff',
                border: '1.5px solid #fde68a',
                borderRadius: '10px',
                padding: '0.875rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: prioridadColor[tarea.prioridad], flexShrink: 0 }} />
                <p style={{ fontSize: '0.875rem', color: '#1a1a1a', flex: 1 }}>{tarea.titulo}</p>
                <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600 }}>
                  {new Date(tarea.deadline + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estado vacío */}
      {!loading && tareasHoy.length === 0 && tareasProximas.length === 0 && (
        <div style={{
          backgroundColor: '#fff',
          border: '1.5px solid #e8e8e8',
          borderRadius: '12px',
          padding: '3rem',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🎉</p>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: '#1a1a1a', marginBottom: '0.25rem' }}>Todo al día</p>
          <p style={{ fontSize: '0.875rem', color: '#888' }}>No tenés tareas urgentes por ahora.</p>
        </div>
      )}
    </div>
  )
}
