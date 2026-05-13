'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Usuario = { id: string; nombre: string; slug: string; avatar_color: string; avatar_emoji: string; rol: string }
type ReporteUsuario = {
  usuario: Usuario
  completadas: number
  enProgreso: number
  porHacer: number
  horasTotales: number
  completadasEsteMes: number
}

export default function ReportesPage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [reportes, setReportes] = useState<ReporteUsuario[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const stored = sessionStorage.getItem('mkt_usuario')
    if (!stored) { router.push('/'); return }
    const u = JSON.parse(stored)
    if (u.rol !== 'admin') { router.push(`/u/${u.slug}`); return }
    setUsuario(u)
    fetchReportes()
  }, [])

  async function fetchReportes() {
    const { data: usuarios } = await supabase.from('mkt_usuarios').select('*').eq('activo', true)
    const { data: tareas } = await supabase.from('mkt_tareas').select('*')
    const { data: asignados } = await supabase.from('mkt_tarea_asignados').select('*')

    if (!usuarios || !tareas) { setLoading(false); return }

    const inicioMes = new Date()
    inicioMes.setDate(1)
    inicioMes.setHours(0, 0, 0, 0)

    const reportesData: ReporteUsuario[] = usuarios.map(u => {
      const idsAsignadas = (asignados || []).filter((a: any) => a.usuario_id === u.id).map((a: any) => a.tarea_id)
      const idsPropias = tareas.filter(t => t.creado_por === u.id).map(t => t.id)
      const todosIds = [...new Set([...idsAsignadas, ...idsPropias])]
      const misTareas = tareas.filter(t => todosIds.includes(t.id))

      return {
        usuario: u,
        completadas: misTareas.filter(t => t.estado === 'hecho').length,
        enProgreso: misTareas.filter(t => t.estado === 'en_progreso').length,
        porHacer: misTareas.filter(t => t.estado === 'por_hacer').length,
        horasTotales: misTareas.reduce((acc, t) => acc + (t.horas_dedicadas || 0), 0),
        completadasEsteMes: misTareas.filter(t =>
          t.estado === 'hecho' && new Date(t.actualizado_en) >= inicioMes
        ).length,
      }
    })

    setReportes(reportesData)
    setLoading(false)
  }

  if (!usuario) return null

  const totalTareas = reportes.reduce((acc, r) => acc + r.completadas + r.enProgreso + r.porHacer, 0)
  const totalCompletadas = reportes.reduce((acc, r) => acc + r.completadas, 0)
  const totalHoras = reportes.reduce((acc, r) => acc + r.horasTotales, 0)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1a1a1a' }}>📊 Reportes</h1>
        <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          {new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats globales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Tareas totales', value: totalTareas, color: '#3b82f6', bg: '#eff6ff', emoji: '📋' },
          { label: 'Completadas', value: totalCompletadas, color: '#10b981', bg: '#f0fdf4', emoji: '✅' },
          { label: 'Horas registradas', value: `${totalHoras.toFixed(1)}h`, color: '#f15922', bg: '#f9ddd3', emoji: '⏱️' },
        ].map(stat => (
          <div key={stat.label} style={{
            backgroundColor: '#fff', border: '1.5px solid #e8e8e8',
            borderRadius: '12px', padding: '1.25rem',
          }}>
            <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.5rem' }}>{stat.emoji} {stat.label}</p>
            <p style={{ fontSize: '2rem', fontWeight: 700, color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Por usuario */}
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '1rem' }}>Por integrante</h2>
      {loading ? (
        <p style={{ color: '#888', fontSize: '0.9rem' }}>Cargando...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {reportes.map(r => (
            <div key={r.usuario.id} style={{
              backgroundColor: '#fff', border: '1.5px solid #e8e8e8',
              borderRadius: '12px', padding: '1.25rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1rem' }}>
                <div style={{
                  width: 42, height: 42, borderRadius: '50%',
                  backgroundColor: r.usuario.avatar_color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
                }}>
                  {r.usuario.avatar_emoji}
                </div>
                <div>
                  <p style={{ fontWeight: 700, color: '#1a1a1a', fontSize: '0.9rem' }}>{r.usuario.nombre}</p>
                  <p style={{ fontSize: '0.75rem', color: '#888' }}>{r.usuario.rol}</p>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>{r.completadasEsteMes}</p>
                  <p style={{ fontSize: '0.7rem', color: '#888' }}>este mes</p>
                </div>
              </div>

              {/* Barra de progreso */}
              {(r.completadas + r.enProgreso + r.porHacer) > 0 && (
                <div style={{ marginBottom: '0.875rem' }}>
                  <div style={{ height: 8, borderRadius: '99px', backgroundColor: '#f4f4f4', overflow: 'hidden', display: 'flex' }}>
                    {r.completadas > 0 && (
                      <div style={{
                        width: `${(r.completadas / (r.completadas + r.enProgreso + r.porHacer)) * 100}%`,
                        backgroundColor: '#10b981',
                      }} />
                    )}
                    {r.enProgreso > 0 && (
                      <div style={{
                        width: `${(r.enProgreso / (r.completadas + r.enProgreso + r.porHacer)) * 100}%`,
                        backgroundColor: '#f59e0b',
                      }} />
                    )}
                    {r.porHacer > 0 && (
                      <div style={{
                        width: `${(r.porHacer / (r.completadas + r.enProgreso + r.porHacer)) * 100}%`,
                        backgroundColor: '#e8e8e8',
                      }} />
                    )}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                {[
                  { label: 'Completadas', value: r.completadas, color: '#10b981' },
                  { label: 'En progreso', value: r.enProgreso, color: '#f59e0b' },
                  { label: 'Por hacer', value: r.porHacer, color: '#6b7280' },
                  { label: 'Horas', value: `${r.horasTotales.toFixed(1)}h`, color: '#f15922' },
                ].map(s => (
                  <div key={s.label}>
                    <p style={{ fontSize: '1rem', fontWeight: 700, color: s.color }}>{s.value}</p>
                    <p style={{ fontSize: '0.7rem', color: '#a0a0a0' }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
