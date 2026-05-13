'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { RichContent } from '@/components/RichEditor'

type Usuario = { id: string; nombre: string; slug: string; avatar_color: string; avatar_emoji: string; rol: string }
type Tarea = { id: string; titulo: string; estado: string; prioridad: string; deadline: string; descripcion: string | null; asignados: Usuario[]; etiquetas: any[] }

const PRIORIDAD_COLOR: Record<string, string> = { alta: '#ef4444', media: '#f59e0b', baja: '#10b981' }
const PRIORIDAD_BG: Record<string, string> = { alta: '#fef2f2', media: '#fffbeb', baja: '#f0fdf4' }

export default function DashboardPage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [tareasHoy, setTareasHoy] = useState<Tarea[]>([])
  const [tareasProximas, setTareasProximas] = useState<Tarea[]>([])
  const [tareasEnProgreso, setTareasEnProgreso] = useState<Tarea[]>([])
  const [tareaDetalle, setTareaDetalle] = useState<Tarea | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const stored = sessionStorage.getItem('mkt_usuario')
    if (stored) { const u = JSON.parse(stored); setUsuario(u); fetchData(u.id) }
  }, [])

  async function fetchData(userId: string) {
    const hoy = new Date().toISOString().split('T')[0]
    const en3dias = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const { data: tareasData } = await supabase.from('mkt_tareas').select('*').order('deadline', { ascending: true })
    if (!tareasData) { setLoading(false); return }

    const tareasCompletas: Tarea[] = await Promise.all(tareasData.map(async t => {
      const { data: asignadosData } = await supabase.from('mkt_tarea_asignados').select('usuario_id').eq('tarea_id', t.id)
      const { data: etiquetasData } = await supabase.from('mkt_tarea_etiquetas').select('etiqueta_id').eq('tarea_id', t.id)
      const asignadosIds = (asignadosData || []).map((a: any) => a.usuario_id)
      const etiquetasIds = (etiquetasData || []).map((e: any) => e.etiqueta_id)
      const { data: asignadosUsuarios } = await supabase.from('mkt_usuarios').select('*').in('id', asignadosIds.length > 0 ? asignadosIds : ['none'])
      const { data: etiquetasObj } = await supabase.from('mkt_etiquetas').select('*').in('id', etiquetasIds.length > 0 ? etiquetasIds : ['none'])
      return { ...t, asignados: asignadosUsuarios || [], etiquetas: etiquetasObj || [] }
    }))

    const mias = tareasCompletas.filter(t =>
      t.asignados.some((a: any) => a.id === userId) || t.creado_por === userId
    ).filter(t => t.estado !== 'hecho')

    setTareasHoy(mias.filter(t => t.deadline === hoy))
    setTareasProximas(mias.filter(t => t.deadline > hoy && t.deadline <= en3dias))
    setTareasEnProgreso(mias.filter(t => t.estado === 'en_progreso'))
    setLoading(false)
  }

  if (!usuario) return null

  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: 'clamp(1.25rem, 4vw, 1.6rem)', fontWeight: 700, color: '#1a1a1a', marginBottom: '0.25rem' }}>
          {saludo}, {usuario.nombre.split(' ')[0]} {usuario.avatar_emoji}
        </h1>
        <p style={{ color: '#888', fontSize: '0.9rem' }}>
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '2rem' }}>
        {[
          { label: 'Vencen hoy', value: tareasHoy.length, color: '#ef4444', bg: '#fef2f2', emoji: '🔴' },
          { label: 'Próximos 3 días', value: tareasProximas.length, color: '#f59e0b', bg: '#fffbeb', emoji: '🟡' },
          { label: 'En progreso', value: tareasEnProgreso.length, color: '#3b82f6', bg: '#eff6ff', emoji: '🔵' },
        ].map(stat => (
          <div key={stat.label} style={{ backgroundColor: '#fff', border: '1.5px solid #e8e8e8', borderRadius: '12px', padding: '1rem' }}>
            <p style={{ fontSize: '0.7rem', color: '#888', marginBottom: '0.375rem' }}>{stat.emoji} {stat.label}</p>
            <p style={{ fontSize: '1.75rem', fontWeight: 700, color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tareas hoy */}
      {tareasHoy.length > 0 && (
        <TareaSeccion titulo="🔴 Vencen hoy" tareas={tareasHoy} bordeColor="#fecaca" onSeleccionar={setTareaDetalle} />
      )}

      {/* Tareas proximas */}
      {tareasProximas.length > 0 && (
        <TareaSeccion titulo="🟡 Próximos 3 días" tareas={tareasProximas} bordeColor="#fde68a" onSeleccionar={setTareaDetalle} />
      )}

      {/* En progreso */}
      {tareasEnProgreso.length > 0 && (
        <TareaSeccion titulo="🔵 En progreso" tareas={tareasEnProgreso} bordeColor="#bfdbfe" onSeleccionar={setTareaDetalle} />
      )}

      {!loading && tareasHoy.length === 0 && tareasProximas.length === 0 && tareasEnProgreso.length === 0 && (
        <div style={{ backgroundColor: '#fff', border: '1.5px solid #e8e8e8', borderRadius: '12px', padding: '3rem', textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🎉</p>
          <p style={{ fontSize: '1rem', fontWeight: 600, color: '#1a1a1a', marginBottom: '0.25rem' }}>Todo al día</p>
          <p style={{ fontSize: '0.875rem', color: '#888' }}>No tenés tareas urgentes por ahora.</p>
        </div>
      )}

      {/* Modal detalle tarea */}
      {tareaDetalle && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setTareaDetalle(null) }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  {tareaDetalle.etiquetas.map((e: any) => (
                    <span key={e.id} style={{ fontSize: '0.65rem', fontWeight: 600, backgroundColor: e.color + '22', color: e.color, padding: '2px 8px', borderRadius: '4px' }}>{e.nombre}</span>
                  ))}
                </div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '0.25rem' }}>{tareaDetalle.titulo}</h2>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.75rem' }}>
                  <span style={{ color: '#888' }}>📅 {new Date(tareaDetalle.deadline + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}</span>
                  <span style={{
                    backgroundColor: PRIORIDAD_BG[tareaDetalle.prioridad],
                    color: PRIORIDAD_COLOR[tareaDetalle.prioridad],
                    fontWeight: 700, padding: '2px 8px', borderRadius: '99px',
                  }}>● {tareaDetalle.prioridad}</span>
                </div>
              </div>
              <button onClick={() => setTareaDetalle(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#888', marginLeft: '0.5rem' }}>×</button>
            </div>
            {tareaDetalle.descripcion && tareaDetalle.descripcion !== '<p></p>' && (
              <div style={{ backgroundColor: '#f9fafb', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#888', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Descripción</p>
                <RichContent html={tareaDetalle.descripcion} />
              </div>
            )}
            {tareaDetalle.asignados.length > 0 && (
              <div>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#888', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Asignado a</p>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {tareaDetalle.asignados.map((a: any) => (
                    <span key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', backgroundColor: a.avatar_color + '22', color: a.avatar_color, padding: '4px 10px', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 600 }}>
                      {a.avatar_emoji} {a.nombre}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => setTareaDetalle(null)} style={{ marginTop: '1.5rem', width: '100%', padding: '0.625rem', border: 'none', borderRadius: '8px', backgroundColor: '#f15922', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}

function TareaSeccion({ titulo, tareas, bordeColor, onSeleccionar }: { titulo: string; tareas: Tarea[]; bordeColor: string; onSeleccionar: (t: Tarea) => void }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h2 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1a1a1a', marginBottom: '0.75rem' }}>{titulo}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {tareas.map(tarea => (
          <div key={tarea.id} onClick={() => onSeleccionar(tarea)} style={{
            backgroundColor: '#fff', border: `1.5px solid ${bordeColor}`,
            borderRadius: '10px', padding: '0.875rem 1rem',
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            cursor: 'pointer', transition: 'box-shadow 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
          >
            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: PRIORIDAD_COLOR[tarea.prioridad], flexShrink: 0 }} />
            <p style={{ fontSize: '0.875rem', color: '#1a1a1a', flex: 1, fontWeight: 500 }}>{tarea.titulo}</p>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {tarea.asignados.slice(0, 3).map((a: any) => (
                <span key={a.id} title={a.nombre} style={{ width: 26, height: 26, borderRadius: '50%', backgroundColor: a.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>{a.avatar_emoji}</span>
              ))}
            </div>
            <span style={{ fontSize: '0.7rem', color: '#888', whiteSpace: 'nowrap' }}>
              {new Date(tarea.deadline + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
