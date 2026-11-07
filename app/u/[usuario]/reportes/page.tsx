'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ReportesAnalisis from '@/components/ReportesAnalisis'
import PasanteSeguimiento from '@/components/PasanteSeguimiento'
import { cargarPermisos, normEstado, rolCorto, hoyISO } from '@/lib/tareas'

type Usuario = { id: string; nombre: string; slug: string; avatar_color: string; avatar_emoji: string; rol: string }
type ReporteUsuario = {
  usuario: Usuario
  completadas: number; enProgreso: number; porHacer: number
  horasTotales: number; completadasEsteMes: number; vencidas: number
}
type HistorialItem = { id: string; usuario_id: string; tarea_titulo: string; accion: string; creado_en: string; usuario?: any }
type EtiquetaStat = { nombre: string; color: string; count: number }

const ACCION_INFO: Record<string, { label: string }> = {
  tarea_creada: { label: 'creó' }, tarea_editada: { label: 'editó' },
  tarea_movida: { label: 'movió' }, tarea_eliminada: { label: 'eliminó' },
  comentario_agregado: { label: 'comentó en' },
}

export default function ReportesPage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [reportes, setReportes] = useState<ReporteUsuario[]>([])
  const [historial, setHistorial] = useState<HistorialItem[]>([])
  const [etiquetaStats, setEtiquetaStats] = useState<EtiquetaStat[]>([])
  const [tareasVencidas, setTareasVencidas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modo, setModo] = useState<'resumen' | 'analisis' | 'pasante'>('resumen')
  const router = useRouter()

  useEffect(() => {
    const stored = sessionStorage.getItem('mkt_usuario')
    if (!stored) { router.push('/'); return }
    const u = JSON.parse(stored)
    cargarPermisos(u.rol).then(p => {
      if (!p.ver_reportes) { router.push(`/u/${u.slug}`); return }
      setUsuario(u)
      fetchAll()
    })
  }, [])

  async function fetchAll() {
    await Promise.all([fetchReportes(), fetchHistorial(), fetchEtiquetaStats(), fetchTareasVencidas()])
    setLoading(false)
  }

  async function fetchReportes() {
    const { data: usuarios } = await supabase.from('mkt_usuarios').select('*').eq('activo', true)
    const { data: tareas } = await supabase.from('mkt_tareas').select('*')
    const { data: asignados } = await supabase.from('mkt_tarea_asignados').select('*')
    if (!usuarios || !tareas) return
    const hoy = hoyISO()
    const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0)
    const data: ReporteUsuario[] = usuarios.map(u => {
      const idsAsignadas = (asignados || []).filter((a: any) => a.usuario_id === u.id).map((a: any) => a.tarea_id)
      const idsPropias = tareas.filter(t => t.creado_por === u.id).map(t => t.id)
      const todosIds = [...new Set([...idsAsignadas, ...idsPropias])]
      const misTareas = tareas.filter(t => todosIds.includes(t.id))
      return {
        usuario: u,
        completadas: misTareas.filter(t => normEstado(t.estado) === 'finalizada').length,
        enProgreso: misTareas.filter(t => ['en_proceso', 'correcciones', 'para_revision'].includes(normEstado(t.estado))).length,
        porHacer: misTareas.filter(t => ['pendiente', 'bloqueada'].includes(normEstado(t.estado))).length,
        horasTotales: misTareas.reduce((acc, t) => acc + (t.horas_dedicadas || 0), 0),
        completadasEsteMes: misTareas.filter(t => normEstado(t.estado) === 'finalizada' && new Date(t.finalizada_en || t.actualizado_en) >= inicioMes).length,
        vencidas: misTareas.filter(t => normEstado(t.estado) !== 'finalizada' && t.deadline < hoy).length,
      }
    })
    setReportes(data.sort((a, b) => b.completadasEsteMes - a.completadasEsteMes))
  }

  async function fetchHistorial() {
    const { data } = await supabase.from('mkt_historial').select('*').order('creado_en', { ascending: false }).limit(8)
    if (!data) return
    const { data: us } = await supabase.from('mkt_usuarios').select('id, nombre, avatar_emoji, avatar_color')
    const map = Object.fromEntries((us || []).map(u => [u.id, u]))
    setHistorial(data.map(item => ({ ...item, usuario: map[item.usuario_id] })))
  }

  async function fetchEtiquetaStats() {
    const { data: etiquetas } = await supabase.from('mkt_etiquetas').select('*')
    const { data: te } = await supabase.from('mkt_tarea_etiquetas').select('*')
    if (!etiquetas || !te) return
    const stats = etiquetas.map(e => ({ nombre: e.nombre, color: e.color, count: te.filter((t: any) => t.etiqueta_id === e.id).length }))
      .filter(s => s.count > 0).sort((a, b) => b.count - a.count)
    setEtiquetaStats(stats)
  }

  async function fetchTareasVencidas() {
    const hoy = hoyISO()
    const { data } = await supabase.from('mkt_tareas').select('*').lt('deadline', hoy).not('estado', 'in', '(finalizada,hecho)').order('deadline', { ascending: true })
    setTareasVencidas(data || [])
  }

  if (!usuario) return null

  const totalTareas = reportes.reduce((acc, r) => acc + r.completadas + r.enProgreso + r.porHacer, 0)
  const totalCompletadas = reportes.reduce((acc, r) => acc + r.completadas, 0)
  const totalHoras = reportes.reduce((acc, r) => acc + r.horasTotales, 0)
  const totalVencidas = reportes.reduce((acc, r) => acc + r.vencidas, 0)
  const maxCompletadas = Math.max(...reportes.map(r => r.completadasEsteMes), 1)

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: 'clamp(1.25rem, 4vw, 1.6rem)', fontWeight: 700, color: 'var(--text)' }}>📊 Reportes</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>{new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</p>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: '1.25rem', overflowX: 'auto' }}>
        {([['resumen', '📊 Resumen'], ['analisis', '🔎 Análisis'], ['pasante', '🌱 Pasante']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setModo(k)} style={{ whiteSpace: 'nowrap', padding: '0.45rem 0.9rem', borderRadius: 8, border: '1.5px solid var(--border)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: modo === k ? 700 : 400, backgroundColor: modo === k ? '#f15922' : 'var(--bg-card)', color: modo === k ? '#fff' : 'var(--text)' }}>{l}</button>
        ))}
      </div>
      {modo === 'analisis' && <ReportesAnalisis />}
      {modo === 'pasante' && <PasanteSeguimiento usuario={usuario as any} permisos={null} />}
      {modo === 'resumen' && (<>
      {/* Stats globales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '2rem' }}>
        {[
          { label: 'Tareas totales', value: totalTareas, color: '#3b82f6', emoji: '📋' },
          { label: 'Completadas', value: totalCompletadas, color: '#10b981', emoji: '✅' },
          { label: 'Horas registradas', value: `${totalHoras.toFixed(1)}h`, color: '#f15922', emoji: '⏱️' },
          { label: 'Vencidas sin completar', value: totalVencidas, color: '#ef4444', emoji: '🚨' },
        ].map(stat => (
          <div key={stat.label} style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: '12px', padding: '1rem' }}>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>{stat.emoji} {stat.label}</p>
            <p style={{ fontSize: '1.75rem', fontWeight: 700, color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>

        {/* Ranking */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: '14px', padding: '1.25rem' }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>🏆 Ranking este mes</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {reportes.map((r, i) => (
              <div key={r.usuario.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <span style={{ fontSize: '1rem', width: 24, textAlign: 'center', flexShrink: 0 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
                <div style={{ width: 30, height: 30, borderRadius: '50%', backgroundColor: r.usuario.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', flexShrink: 0 }}>{r.usuario.avatar_emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.usuario.nombre}</p>
                  <div style={{ height: 4, borderRadius: '99px', backgroundColor: 'var(--border)', marginTop: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(r.completadasEsteMes / maxCompletadas) * 100}%`, backgroundColor: r.usuario.avatar_color, borderRadius: '99px' }} />
                  </div>
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#10b981', flexShrink: 0 }}>{r.completadasEsteMes}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actividad reciente */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: '14px', padding: '1.25rem' }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>⚡ Actividad reciente</h2>
          {historial.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin actividad todavía.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {historial.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  {item.usuario && <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: item.usuario.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', flexShrink: 0, marginTop: '1px' }}>{item.usuario.avatar_emoji}</div>}
                  <p style={{ fontSize: '0.775rem', color: 'var(--text)', flex: 1, lineHeight: 1.4 }}>
                    <strong>{item.usuario?.nombre?.split(' ')[0]}</strong> {ACCION_INFO[item.accion]?.label || item.accion} <span style={{ color: 'var(--text-muted)' }}>"{item.tarea_titulo}"</span>
                  </p>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', flexShrink: 0 }}>{new Date(item.creado_en).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tareas vencidas */}
        {tareasVencidas.length > 0 && (
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid #fecaca', borderRadius: '14px', padding: '1.25rem' }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ef4444', marginBottom: '1rem' }}>🚨 Vencidas sin completar ({tareasVencidas.length})</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {tareasVencidas.slice(0, 6).map(t => (
                <div key={t.id} style={{ padding: '0.5rem 0.75rem', backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: '8px' }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>{t.titulo}</p>
                  <p style={{ fontSize: '0.7rem', color: '#ef4444', marginTop: '2px' }}>📅 {new Date(t.deadline + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</p>
                </div>
              ))}
              {tareasVencidas.length > 6 && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>+{tareasVencidas.length - 6} más</p>}
            </div>
          </div>
        )}

        {/* Etiquetas */}
        {etiquetaStats.length > 0 && (
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: '14px', padding: '1.25rem' }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>🏷️ Tareas por etiqueta</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {etiquetaStats.map(e => (
                <div key={e.nombre} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: e.color, backgroundColor: e.color + '22', padding: '2px 8px', borderRadius: '4px', minWidth: 72, textAlign: 'center' }}>{e.nombre}</span>
                  <div style={{ flex: 1, height: 6, backgroundColor: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(e.count / etiquetaStats[0].count) * 100}%`, backgroundColor: e.color, borderRadius: '99px' }} />
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', minWidth: 20, textAlign: 'right' }}>{e.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Por usuario */}
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>👤 Por integrante</h2>
      {loading ? <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Cargando...</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {reportes.map(r => (
            <div key={r.usuario.id} style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', backgroundColor: r.usuario.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>{r.usuario.avatar_emoji}</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.9rem' }}>{r.usuario.nombre}</p>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{rolCorto(r.usuario.rol)}</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>{r.completadasEsteMes}</p>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>este mes</p>
                  </div>
                  {r.vencidas > 0 && (
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ef4444' }}>{r.vencidas}</p>
                      <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>vencidas</p>
                    </div>
                  )}
                </div>
              </div>
              {(r.completadas + r.enProgreso + r.porHacer) > 0 && (
                <div style={{ marginBottom: '0.875rem' }}>
                  <div style={{ height: 8, borderRadius: '99px', backgroundColor: 'var(--border)', overflow: 'hidden', display: 'flex' }}>
                    {r.completadas > 0 && <div style={{ width: `${(r.completadas / (r.completadas + r.enProgreso + r.porHacer)) * 100}%`, backgroundColor: '#10b981' }} />}
                    {r.enProgreso > 0 && <div style={{ width: `${(r.enProgreso / (r.completadas + r.enProgreso + r.porHacer)) * 100}%`, backgroundColor: '#f59e0b' }} />}
                    {r.porHacer > 0 && <div style={{ width: `${(r.porHacer / (r.completadas + r.enProgreso + r.porHacer)) * 100}%`, backgroundColor: '#e8e8e8' }} />}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                {[{ label: 'Completadas', value: r.completadas, color: '#10b981' }, { label: 'En progreso', value: r.enProgreso, color: '#f59e0b' }, { label: 'Por hacer', value: r.porHacer, color: '#6b7280' }, { label: 'Horas', value: `${r.horasTotales.toFixed(1)}h`, color: '#f15922' }].map(s => (
                  <div key={s.label}>
                    <p style={{ fontSize: '1rem', fontWeight: 700, color: s.color }}>{s.value}</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      </>)}
    </div>
  )
}
