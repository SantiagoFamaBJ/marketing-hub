'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Tarea, Usuario, cargarTareas, cargarUsuarios, estaCerrada, estadoInfo, ESTADOS, fechaCorta, hoyISO, sumarDias, vencida } from '@/lib/tareas'

const LIMITE_CARGA = 8
const card: React.CSSProperties = { backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '1rem', marginBottom: 14 }
const h3: React.CSSProperties = { fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', marginBottom: 4 }
const sub: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 10 }
const dia = (ts: string) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const dias = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 86400000
const prom = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
const fmtD = (n: number | null) => n == null ? 'sin datos' : n < 1 ? '<1 día' : `${n.toFixed(1)} días`

export default function ReportesAnalisis() {
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [campanas, setCampanas] = useState<any[]>([])
  const [sec, setSec] = useState<'cuellos' | 'carga' | 'cumplimiento' | 'resolucion' | 'proyectos'>('cuellos')
  const [cargado, setCargado] = useState(false)

  useEffect(() => {
    Promise.all([cargarTareas({}), cargarUsuarios(), supabase.from('mkt_campanas').select('*')]).then(([t, u, c]) => {
      setTareas(t); setUsuarios(u); setCampanas(c.data || []); setCargado(true)
    })
  }, [])

  if (!cargado) return <p style={{ color: 'var(--text-muted)' }}>Cargando…</p>

  const hoy = hoyISO()
  const abiertas = tareas.filter(t => !estaCerrada(t.estado))
  const cerradas = tareas.filter(t => t.finalizada_en)
  const hace90 = sumarDias(-90)
  const recientes = cerradas.filter(t => dia(t.finalizada_en!) >= hace90)
  const aTiempo = (t: Tarea) => dia(t.finalizada_en!) <= t.deadline
  const nombre = (id: string | null) => usuarios.find(u => u.id === id)?.nombre.split(' ')[0] || 'Sin asignar'

  const bloqueadas = abiertas.filter(t => t.estado === 'bloqueada')
  const enRevision = abiertas.filter(t => t.estado === 'para_revision' && !!t.enviada_revision_en && dias(t.enviada_revision_en!, new Date().toISOString()) > 2)
  const estancadas = abiertas.filter(t => t.estado !== 'bloqueada' && t.estado !== 'para_revision' && dias(t.actualizado_en!, new Date().toISOString()) > 7)
  const vencidas = abiertas.filter(vencida)

  const Lista = ({ titulo, desc, items, extra }: { titulo: string; desc: string; items: Tarea[]; extra?: (t: Tarea) => string }) => (
    <div style={card}>
      <h3 style={h3}>{titulo} <span style={{ color: items.length ? '#ef4444' : '#10b981' }}>({items.length})</span></h3>
      <p style={sub}>{desc}</p>
      {items.length === 0 && <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Nada por acá 👌</p>}
      {items.map(t => (
        <div key={t.id} style={{ display: 'flex', gap: 8, padding: '0.4rem 0', borderTop: '1px solid var(--border)', fontSize: '0.82rem', flexWrap: 'wrap' }}>
          <span style={{ flex: '1 1 160px', color: 'var(--text)', fontWeight: 600 }}>{t.titulo}</span>
          <span style={{ color: 'var(--text-muted)' }}>{nombre(t.responsable_id)} · vence {fechaCorta(t.deadline)}{extra ? ` · ${extra(t)}` : ''}</span>
        </div>
      ))}
    </div>
  )

  const Barra = ({ v, max, color }: { v: number; max: number; color: string }) => (
    <div style={{ flex: 1, height: 8, borderRadius: 99, backgroundColor: 'var(--border)', overflow: 'hidden', minWidth: 60 }}>
      <div style={{ width: `${Math.min(100, max ? (v / max) * 100 : 0)}%`, height: '100%', backgroundColor: color }} />
    </div>
  )

  const porCat: Record<string, number[]> = {}
  cerradas.forEach(t => { const k = t.categoria || 'Sin categoría'; (porCat[k] ||= []).push(dias(t.creado_en, t.finalizada_en!)) })
  const conAprob = tareas.filter(t => t.enviada_revision_en && t.aprobada_en)

  const secciones = [['cuellos', '🚧 Cuellos de botella'], ['carga', '⚖️ Carga'], ['cumplimiento', '🎯 Cumplimiento'], ['resolucion', '⏱️ Resolución'], ['proyectos', '📁 Proyectos']] as const

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 14, paddingBottom: 2 }}>
        {secciones.map(([k, l]) => (
          <button key={k} onClick={() => setSec(k)} style={{ whiteSpace: 'nowrap', padding: '0.4rem 0.8rem', borderRadius: 99, border: '1.5px solid var(--border)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: sec === k ? 700 : 400, backgroundColor: sec === k ? '#f15922' : 'var(--bg-card)', color: sec === k ? '#fff' : 'var(--text)' }}>{l}</button>
        ))}
      </div>

      {sec === 'cuellos' && (
        <>
          <div style={card}>
            <h3 style={h3}>Dónde están las tareas abiertas</h3>
            <p style={sub}>{abiertas.length} tareas abiertas por estado</p>
            {ESTADOS.filter(e => !estaCerrada(e.key)).map(e => {
              const n = abiertas.filter(t => t.estado === e.key).length
              return <div key={e.key} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, fontSize: '0.8rem', color: 'var(--text)' }}><span style={{ width: 130 }}>{e.label}</span><Barra v={n} max={abiertas.length} color={e.color} /><span style={{ width: 24, textAlign: 'right' }}>{n}</span></div>
            })}
          </div>
          <Lista titulo="🚨 Vencidas" desc="Pasó el deadline y siguen abiertas" items={vencidas} />
          <Lista titulo="⏸️ Bloqueadas" desc="Esperando algo externo" items={bloqueadas} />
          <Lista titulo="🔁 Esperando revisión hace más de 2 días" desc="La persona que aprueba es el cuello" items={enRevision} extra={t => `en revisión desde ${fechaCorta(dia(t.enviada_revision_en!))}`} />
          <Lista titulo="💤 Sin movimiento hace más de 7 días" desc="Abiertas que nadie tocó" items={estancadas} extra={t => `última actividad ${fechaCorta(dia(t.actualizado_en!))}`} />
        </>
      )}

      {sec === 'carga' && (
        <div style={card}>
          <h3 style={h3}>Carga por persona</h3>
          <p style={sub}>Tareas abiertas (responsable o colaborador). Alerta desde {LIMITE_CARGA}.</p>
          {usuarios.map(u => {
            const mias = abiertas.filter(t => t.responsable_id === u.id || t.asignados.some(a => a.id === u.id))
            const sobre = mias.length >= LIMITE_CARGA
            return (
              <div key={u.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, fontSize: '0.82rem', color: 'var(--text)', flexWrap: 'wrap' }}>
                <span style={{ width: 110, fontWeight: 600 }}>{u.avatar_emoji} {u.nombre.split(' ')[0]}</span>
                <Barra v={mias.length} max={Math.max(LIMITE_CARGA, ...usuarios.map(x => abiertas.filter(t => t.responsable_id === x.id).length))} color={sobre ? '#ef4444' : '#f15922'} />
                <span style={{ width: 200, color: sobre ? '#ef4444' : 'var(--text-muted)' }}>{mias.length} abiertas · {mias.filter(vencida).length} vencidas · {mias.filter(t => t.prioridad === 'urgente' || t.prioridad === 'alta').length} urgentes/altas{sobre ? ' ⚠️ sobrecarga' : ''}</span>
              </div>
            )
          })}
        </div>
      )}

      {sec === 'cumplimiento' && (
        <div style={card}>
          <h3 style={h3}>Cumplimiento en fecha</h3>
          <p style={sub}>Tareas finalizadas en los últimos 90 días: {recientes.length} · a tiempo {recientes.length ? Math.round(recientes.filter(aTiempo).length / recientes.length * 100) : 0}% en total</p>
          {usuarios.map(u => {
            const fin = recientes.filter(t => t.responsable_id === u.id)
            const ok = fin.filter(aTiempo).length
            return (
              <div key={u.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, fontSize: '0.82rem', color: 'var(--text)', flexWrap: 'wrap' }}>
                <span style={{ width: 110, fontWeight: 600 }}>{u.avatar_emoji} {u.nombre.split(' ')[0]}</span>
                <Barra v={ok} max={fin.length} color="#10b981" />
                <span style={{ width: 200, color: 'var(--text-muted)' }}>{fin.length ? `${Math.round(ok / fin.length * 100)}% a tiempo (${ok}/${fin.length})` : 'sin tareas finalizadas'}</span>
              </div>
            )
          })}
        </div>
      )}

      {sec === 'resolucion' && (
        <>
          <div style={card}>
            <h3 style={h3}>Tiempo de resolución por persona</h3>
            <p style={sub}>Desde que se crea la tarea hasta que se finaliza</p>
            {usuarios.map(u => (
              <p key={u.id} style={{ fontSize: '0.82rem', color: 'var(--text)', marginBottom: 6 }}><strong>{u.avatar_emoji} {u.nombre.split(' ')[0]}</strong> · {fmtD(prom(cerradas.filter(t => t.responsable_id === u.id).map(t => dias(t.creado_en, t.finalizada_en!))))}</p>
            ))}
          </div>
          <div style={card}>
            <h3 style={h3}>Por categoría</h3>
            {Object.keys(porCat).length === 0 && <p style={sub}>Todavía no hay tareas finalizadas.</p>}
            {Object.entries(porCat).map(([k, v]) => <p key={k} style={{ fontSize: '0.82rem', color: 'var(--text)', marginBottom: 6 }}><strong>{k}</strong> · {fmtD(prom(v))} ({v.length})</p>)}
          </div>
          <div style={card}>
            <h3 style={h3}>Tiempo de aprobación</h3>
            <p style={sub}>Desde que se envía a revisión hasta que se aprueba</p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text)' }}>{fmtD(prom(conAprob.map(t => dias(t.enviada_revision_en!, t.aprobada_en!))))} {conAprob.length ? `(${conAprob.length} tareas)` : ''}</p>
          </div>
        </>
      )}

      {sec === 'proyectos' && (
        <>
          {campanas.filter(c => c.estado !== 'archivada').map(c => {
            const ts = tareas.filter(t => t.campana_id === c.id)
            const h = ts.filter(t => estaCerrada(t.estado)).length
            const v = ts.filter(vencida).length
            return (
              <div key={c.id} style={{ ...card, borderLeft: `4px solid ${c.color}` }}>
                <h3 style={h3}>{c.nombre} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 400 }}>· {c.estado}</span></h3>
                <p style={sub}>{c.fecha_inicio || c.fecha_fin ? `${c.fecha_inicio ? fechaCorta(c.fecha_inicio) : '?'} → ${c.fecha_fin ? fechaCorta(c.fecha_fin) : '?'}` : 'Sin fechas'} · Responsable: {nombre(c.responsable_id)}</p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.8rem', color: 'var(--text)' }}>
                  <Barra v={h} max={ts.length} color="#10b981" /><span>{ts.length ? `${h}/${ts.length} tareas` : 'sin tareas'}{v ? <span style={{ color: '#ef4444' }}> · {v} vencida{v > 1 ? 's' : ''}</span> : ''}</span>
                </div>
                {c.fecha_fin && c.fecha_fin < hoy && c.estado !== 'completada' && <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: 6 }}>Pasó la fecha de fin y no está marcada como completada.</p>}
              </div>
            )
          })}
          <div style={card}><p style={{ fontSize: '0.82rem', color: 'var(--text)' }}>Tareas abiertas sin campaña: <strong>{abiertas.filter(t => !t.campana_id).length}</strong></p></div>
        </>
      )}
    </div>
  )
}
