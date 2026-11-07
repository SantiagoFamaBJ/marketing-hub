'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Tarea, Usuario, cargarTareas, cargarUsuarios, estaCerrada, fechaCorta, transferirTareas, vencida } from '@/lib/tareas'

type Meta = { id: string; usuario_id: string; titulo: string; tipo: 'manual' | 'tareas_finalizadas' | 'a_tiempo_pct'; objetivo: number | null; cumplida: boolean; orden: number }
type Pas = Usuario & { es_pasante?: boolean; fecha_baja?: string | null; creado_en?: string }

const card: React.CSSProperties = { backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '1rem', marginBottom: 14 }
const inp: React.CSSProperties = { padding: '0.45rem 0.6rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--text)', backgroundColor: 'var(--input-bg)' }
const btn = (bg: string, color = '#fff'): React.CSSProperties => ({ padding: '0.4rem 0.8rem', border: 'none', borderRadius: 8, backgroundColor: bg, color, cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' })
const dia = (ts: string) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const TIPOS = { manual: 'Checklist (la marco yo)', tareas_finalizadas: 'Tareas finalizadas (cantidad)', a_tiempo_pct: 'Entregas a tiempo (%)' }

export default function PasanteSeguimiento({ usuario, permisos }: { usuario: Usuario; permisos: any }) {
  const [pasantes, setPasantes] = useState<Pas[]>([])
  const [activos, setActivos] = useState<Usuario[]>([])
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [metas, setMetas] = useState<Meta[]>([])
  const [nueva, setNueva] = useState<{ titulo: string; tipo: Meta['tipo']; objetivo: string }>({ titulo: '', tipo: 'manual', objetivo: '' })
  const [resumen, setResumen] = useState<Pas | null>(null)
  const [destino, setDestino] = useState('')
  const [msg, setMsg] = useState('')
  const esCoord = usuario.rol === 'mkt_reporte'

  useEffect(() => { cargar() }, [])
  async function cargar() {
    const [p, a, t, m] = await Promise.all([
      supabase.from('mkt_usuarios').select('*').eq('es_pasante', true).order('creado_en'),
      cargarUsuarios(), cargarTareas({}), supabase.from('mkt_pasantia_metas').select('*').order('orden'),
    ])
    setPasantes(p.data || []); setActivos(a); setTareas(t); setMetas(m.data || [])
  }

  const statsDe = (u: Pas) => {
    const mias = tareas.filter(t => t.responsable_id === u.id || t.asignados.some(a => a.id === u.id))
    const fin = mias.filter(t => t.finalizada_en)
    const ok = fin.filter(t => dia(t.finalizada_en!) <= t.deadline).length
    return { mias, fin, abiertas: mias.filter(t => !estaCerrada(t.estado)), vencidas: mias.filter(vencida).length, ok, pct: fin.length ? Math.round((ok / fin.length) * 100) : null }
  }

  function progreso(m: Meta, u: Pas): { texto: string; ratio: number | null; ok: boolean } {
    const s = statsDe(u)
    if (m.tipo === 'manual') return { texto: m.cumplida ? 'Cumplida' : 'Pendiente', ratio: m.cumplida ? 1 : 0, ok: m.cumplida }
    if (m.tipo === 'tareas_finalizadas') return { texto: `${s.fin.length} / ${m.objetivo ?? '?'}`, ratio: m.objetivo ? s.fin.length / m.objetivo : null, ok: !!m.objetivo && s.fin.length >= m.objetivo }
    return s.pct == null ? { texto: 'Sin tareas finalizadas todavía', ratio: null, ok: false } : { texto: `${s.pct}% (objetivo ${m.objetivo ?? '?'}%)`, ratio: m.objetivo ? s.pct / m.objetivo : null, ok: !!m.objetivo && s.pct >= m.objetivo }
  }

  async function agregarMeta(u: Pas) {
    if (!nueva.titulo.trim()) return
    const obj = nueva.tipo === 'manual' ? null : parseFloat(nueva.objetivo)
    if (nueva.tipo !== 'manual' && !(obj && obj > 0)) return alert('Poné un objetivo numérico.')
    await supabase.from('mkt_pasantia_metas').insert({ usuario_id: u.id, titulo: nueva.titulo.trim(), tipo: nueva.tipo, objetivo: obj, orden: metas.filter(m => m.usuario_id === u.id).length })
    setNueva({ titulo: '', tipo: 'manual', objetivo: '' }); cargar()
  }
  async function toggleMeta(m: Meta) { await supabase.from('mkt_pasantia_metas').update({ cumplida: !m.cumplida }).eq('id', m.id); cargar() }
  async function borrarMeta(m: Meta) { if (confirm(`¿Quitar la meta "${m.titulo}"?`)) { await supabase.from('mkt_pasantia_metas').delete().eq('id', m.id); cargar() } }

  async function traspasar(u: Pas) {
    const hacia = activos.find(x => x.id === destino)
    if (!hacia) return
    const n = statsDe(u).abiertas.length
    if (!confirm(`¿Pasar ${n} tarea${n === 1 ? '' : 's'} abierta${n === 1 ? '' : 's'} de ${u.nombre} a ${hacia.nombre}? Las finalizadas quedan a nombre de ${u.nombre}.`)) return
    const hechas = await transferirTareas(u, hacia, usuario)
    setMsg(`✅ Se pasaron ${hechas} tareas a ${hacia.nombre}.`); setDestino(''); cargar()
  }
  async function cambiarAcceso(u: Pas, activar: boolean) {
    if (!activar && !confirm(`¿Desactivar el acceso de ${u.nombre}? No puede entrar más, pero queda todo su historial, tareas y comentarios.`)) return
    await supabase.from('mkt_usuarios').update(activar ? { activo: true, fecha_baja: null } : { activo: false, fecha_baja: new Date().toISOString() }).eq('id', u.id)
    setMsg(activar ? '✅ Acceso reactivado.' : '✅ Acceso desactivado. Los datos se conservan.'); cargar()
  }

  function textoResumen(u: Pas) {
    const s = statsDe(u); const ms = metas.filter(m => m.usuario_id === u.id)
    const porCat: Record<string, number> = {}; s.fin.forEach(t => { const k = t.categoria || 'Sin categoría'; porCat[k] = (porCat[k] || 0) + 1 })
    return [
      `RESUMEN DE PASANTÍA — ${u.nombre}`, u.creado_en ? `En el Hub desde: ${fechaCorta(dia(u.creado_en))}` : '', `Generado: ${new Date().toLocaleDateString('es-AR')}`, '',
      `Tareas participadas: ${s.mias.length}`, `Finalizadas: ${s.fin.length}`, `Abiertas: ${s.abiertas.length} (vencidas: ${s.vencidas})`,
      `Entregas a tiempo: ${s.pct == null ? 'sin datos' : `${s.pct}% (${s.ok}/${s.fin.length})`}`, '',
      'Finalizadas por categoría:', ...(Object.keys(porCat).length ? Object.entries(porCat).map(([k, v]) => `- ${k}: ${v}`) : ['- (ninguna)']), '',
      'Metas:', ...(ms.length ? ms.map(m => `- ${m.titulo}: ${progreso(m, u).texto}${progreso(m, u).ok ? ' ✓' : ''}`) : ['- (no se cargaron metas)']), '',
      'Tareas finalizadas:', ...(s.fin.length ? s.fin.map(t => `- ${t.titulo} (${fechaCorta(dia(t.finalizada_en!))})`) : ['- (ninguna)']),
    ].filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n')
  }

  if (pasantes.length === 0) return (
    <div style={card}><p style={{ fontSize: '0.85rem', color: 'var(--text)' }}>No hay personas marcadas como pasantes. Marcalas en <strong>/ADMIN → Usuarios</strong> (opción “Es pasante”).</p></div>
  )

  return (
    <div>
      {msg && <p style={{ ...card, fontSize: '0.85rem', color: 'var(--text)' }}>{msg}</p>}
      {pasantes.map(u => {
        const s = statsDe(u); const ms = metas.filter(m => m.usuario_id === u.id)
        return (
          <div key={u.id} style={{ ...card, opacity: u.activo === false ? 0.8 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ fontSize: '1.4rem' }}>{u.avatar_emoji}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, color: 'var(--text)' }}>{u.nombre} {u.activo === false && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 99, padding: '1px 8px' }}>acceso desactivado{u.fecha_baja ? ` · ${fechaCorta(dia(u.fecha_baja))}` : ''}</span>}</p>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{u.creado_en ? `En el Hub desde ${fechaCorta(dia(u.creado_en))}` : ''}</p>
              </div>
              <button onClick={() => setResumen(u)} style={btn('#f15922')}>📄 Resumen de cierre</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginBottom: 12 }}>
              {[['Finalizadas', s.fin.length, '#10b981'], ['Abiertas', s.abiertas.length, '#3b82f6'], ['Vencidas', s.vencidas, '#ef4444'], ['A tiempo', s.pct == null ? '—' : `${s.pct}%`, '#f15922']].map(([l, v, c]) => (
                <div key={l as string} style={{ backgroundColor: 'var(--bg)', borderRadius: 8, padding: '0.5rem 0.7rem' }}><p style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{l}</p><p style={{ fontSize: '1.2rem', fontWeight: 700, color: c as string }}>{v}</p></div>
              ))}
            </div>

            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Metas</p>
            {ms.length === 0 && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>Sin metas. Cargalas vos: no se inventa ningún número.</p>}
            {ms.map(m => {
              const p = progreso(m, u)
              return (
                <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0.4rem 0', borderTop: '1px solid var(--border)', fontSize: '0.82rem', flexWrap: 'wrap' }}>
                  {m.tipo === 'manual' && <input type="checkbox" checked={m.cumplida} onChange={() => toggleMeta(m)} style={{ accentColor: '#f15922' }} />}
                  <span style={{ flex: '1 1 150px', color: 'var(--text)', fontWeight: 600 }}>{m.titulo}</span>
                  {p.ratio != null && m.tipo !== 'manual' && <div style={{ width: 80, height: 6, borderRadius: 99, backgroundColor: 'var(--border)', overflow: 'hidden' }}><div style={{ width: `${Math.min(100, p.ratio * 100)}%`, height: '100%', backgroundColor: p.ok ? '#10b981' : '#f15922' }} /></div>}
                  <span style={{ color: p.ok ? '#10b981' : 'var(--text-muted)', fontSize: '0.78rem' }}>{p.texto}{p.ok && m.tipo !== 'manual' ? ' ✓' : ''}</span>
                  <button onClick={() => borrarMeta(m)} aria-label="Quitar meta" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
                </div>
              )
            })}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <input value={nueva.titulo} onChange={e => setNueva(n => ({ ...n, titulo: e.target.value }))} placeholder="Nueva meta…" style={{ ...inp, flex: '1 1 160px' }} />
              <select value={nueva.tipo} onChange={e => setNueva(n => ({ ...n, tipo: e.target.value as Meta['tipo'] }))} style={inp}>{Object.entries(TIPOS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              {nueva.tipo !== 'manual' && <input type="number" min="1" value={nueva.objetivo} onChange={e => setNueva(n => ({ ...n, objetivo: e.target.value }))} placeholder={nueva.tipo === 'a_tiempo_pct' ? '% objetivo' : 'Cantidad'} style={{ ...inp, width: 90 }} />}
              <button onClick={() => agregarMeta(u)} style={btn('#f15922')}>+ Agregar</button>
            </div>

            {esCoord && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Pasar tareas abiertas ({s.abiertas.length}) a</span>
                <select value={destino} onChange={e => setDestino(e.target.value)} style={inp}><option value="">Elegir…</option>{activos.filter(a => a.id !== u.id).map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select>
                <button onClick={() => traspasar(u)} disabled={!destino || s.abiertas.length === 0} style={{ ...btn('var(--bg)', 'var(--text)'), border: '1.5px solid var(--border)', opacity: destino && s.abiertas.length ? 1 : 0.5 }}>Traspasar</button>
                <span style={{ flex: 1 }} />
                {u.activo === false ? <button onClick={() => cambiarAcceso(u, true)} style={btn('#10b981')}>Reactivar acceso</button> : <button onClick={() => cambiarAcceso(u, false)} style={btn('#fef2f2', '#ef4444')}>Desactivar acceso</button>}
              </div>
            )}
          </div>
        )
      })}

      {resumen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '0.75rem' }} onClick={e => { if (e.target === e.currentTarget) setResumen(null) }}>
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 16, padding: '1.25rem', width: '100%', maxWidth: 560, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            <pre style={{ flex: 1, overflowY: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.6, margin: 0 }}>{textoResumen(resumen)}</pre>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => navigator.clipboard.writeText(textoResumen(resumen))} style={btn('#f15922')}>Copiar</button>
              <button onClick={() => {
                const w = window.open('', '_blank'); if (!w) return
                w.document.write(`<pre style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap;padding:24px">${textoResumen(resumen).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`); w.document.close(); w.print()
              }} style={btn('var(--bg)', 'var(--text)')}>🖨️ Imprimir / PDF</button>
              <button onClick={() => setResumen(null)} style={{ ...btn('var(--bg)', 'var(--text)'), marginLeft: 'auto' }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
