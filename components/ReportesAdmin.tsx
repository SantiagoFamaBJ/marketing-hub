'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Usuario } from '@/lib/tareas'
import ReportesResumen from '@/components/ReportesResumen'
import ReportesAnalisis from '@/components/ReportesAnalisis'
import PasanteSeguimiento from '@/components/PasanteSeguimiento'

const pesos = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

function Presupuestos() {
  const [camps, setCamps] = useState<any[]>([])
  const [vals, setVals] = useState<Record<string, string>>({})
  useEffect(() => {
    Promise.all([supabase.from('mkt_campanas').select('id,nombre').order('creado_en', { ascending: false }), supabase.from('mkt_presupuestos').select('*')]).then(([c, p]) => {
      const m: Record<string, number | null> = Object.fromEntries((p.data || []).map((x: any) => [x.campana_id, x.monto]))
      setCamps((c.data || []).map((x: any) => ({ ...x, presupuesto: m[x.id] ?? null })))
      setVals(Object.fromEntries((c.data || []).map((x: any) => [x.id, m[x.id] != null ? String(m[x.id]) : ''])))
    })
  }, [])
  async function guardar(id: string) {
    const monto = vals[id] ? parseFloat(vals[id]) : null
    if (monto == null) await supabase.from('mkt_presupuestos').delete().eq('campana_id', id)
    else await supabase.from('mkt_presupuestos').upsert({ campana_id: id, monto, actualizado_en: new Date().toISOString() })
    setCamps(cs => cs.map(c => c.id === id ? { ...c, presupuesto: monto } : c))
  }
  const total = camps.reduce((a, c) => a + (c.presupuesto || 0), 0)
  return (
    <div style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '1rem' }}>
      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>💰 Presupuesto por campaña</h3>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>Solo coordinación lo ve y edita (protegido en la base de datos). Total cargado: {pesos(total)}</p>
      {camps.length === 0 && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No hay campañas.</p>}
      {camps.map(c => (
        <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0.45rem 0', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <span style={{ flex: '1 1 160px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>{c.nombre}</span>
          <input type="number" min="0" value={vals[c.id] ?? ''} onChange={e => setVals(v => ({ ...v, [c.id]: e.target.value }))} placeholder="ARS" style={{ width: 130, padding: '0.4rem 0.6rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--text)', backgroundColor: 'var(--input-bg)' }} />
          <button onClick={() => guardar(c.id)} style={{ padding: '0.4rem 0.8rem', border: 'none', borderRadius: 8, backgroundColor: '#f15922', color: '#fff', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}>Guardar</button>
        </div>
      ))}
    </div>
  )
}

export default function ReportesAdmin() {
  const [modo, setModo] = useState<'resumen' | 'analisis' | 'pasante' | 'presupuestos'>('resumen')
  const [actor, setActor] = useState<Usuario | null>(null)
  // El admin no tiene identidad propia: las acciones quedan registradas a nombre de la coordinación
  useEffect(() => { supabase.from('mkt_usuarios').select('*').eq('activo', true).order('creado_en').then(({ data }) => setActor((data || []).find((u: any) => u.rol === 'mkt_reporte') || (data || [])[0] || null)) }, [])
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: '1.25rem', overflowX: 'auto' }}>
        {([['resumen', '📊 Resumen'], ['analisis', '🔎 Análisis'], ['pasante', '🌱 Seguimiento'], ['presupuestos', '💰 Presupuestos']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setModo(k)} style={{ whiteSpace: 'nowrap', padding: '0.45rem 0.9rem', borderRadius: 8, border: '1.5px solid var(--border)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: modo === k ? 700 : 400, backgroundColor: modo === k ? '#f15922' : 'var(--bg-card)', color: modo === k ? '#fff' : 'var(--text)' }}>{l}</button>
        ))}
      </div>
      {modo === 'resumen' && <ReportesResumen />}
      {modo === 'analisis' && <ReportesAnalisis />}
      {modo === 'pasante' && (actor ? <PasanteSeguimiento usuario={actor} permisos={null} /> : <p style={{ color: 'var(--text-muted)' }}>Cargando…</p>)}
      {modo === 'presupuestos' && <Presupuestos />}
    </div>
  )
}
