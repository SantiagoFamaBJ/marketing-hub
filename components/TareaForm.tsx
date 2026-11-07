'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { Tarea, Usuario, Etiqueta, Permisos, PRIORIDADES, CATEGORIAS, log, notificar } from '@/lib/tareas'

const RichEditor = dynamic(() => import('@/components/RichEditor'), { ssr: false })

type Campana = { id: string; nombre: string }

const inp: React.CSSProperties = { width: '100%', padding: '0.625rem 0.875rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', color: 'var(--text)', backgroundColor: 'var(--input-bg)' }

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: '0.875rem' }}><label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>{children}</div>
}

export default function TareaForm({ tarea, usuario, usuarios, etiquetas, campanas, permisos, campanaInicial, onClose, onSaved, onNuevaEtiqueta }: {
  tarea: Tarea | null; campanaInicial?: string; usuario: Usuario; usuarios: Usuario[]; etiquetas: Etiqueta[]; campanas: Campana[]; permisos: Permisos
  onClose: () => void; onSaved: () => void; onNuevaEtiqueta: () => void
}) {
  const puedeAsignar = !!permisos.asignar_a_otros
  const [f, setF] = useState({
    titulo: tarea?.titulo || '',
    descripcion: tarea?.descripcion || '',
    prioridad: tarea?.prioridad || 'media',
    deadline: tarea?.deadline || '',
    categoria: tarea?.categoria || '',
    campana_id: tarea?.campana_id || campanaInicial || '',
    responsable_id: tarea?.responsable_id || usuario.id,
    colaboradores: (tarea?.asignados || []).filter(a => a.id !== tarea?.responsable_id).map(a => a.id),
    etiquetas: (tarea?.etiquetas || []).map(e => e.id),
    requiere_aprobacion: tarea?.requiere_aprobacion || false,
    recurrencia: tarea?.recurrencia || '',
  })
  const [subs, setSubs] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }))
  const toggle = (k: 'colaboradores' | 'etiquetas', id: string) => setF(p => ({ ...p, [k]: p[k].includes(id) ? p[k].filter(x => x !== id) : [...p[k], id] }))

  // Quien no puede asignar a otros, solo se asigna a sí mismo
  const candidatos = puedeAsignar ? usuarios : usuarios.filter(u => u.id === usuario.id)

  async function guardar() {
    if (!f.titulo.trim() || !f.deadline || guardando) return
    setGuardando(true)
    const resp = puedeAsignar ? f.responsable_id : usuario.id
    const colabs = puedeAsignar ? f.colaboradores.filter(id => id !== resp) : []
    const todos = [resp, ...colabs]
    const payload = {
      titulo: f.titulo.trim(), descripcion: f.descripcion && f.descripcion !== '<p></p>' ? f.descripcion : null,
      prioridad: f.prioridad, deadline: f.deadline, categoria: f.categoria || null,
      campana_id: f.campana_id || null, responsable_id: resp, requiere_aprobacion: f.requiere_aprobacion, recurrencia: f.recurrencia || null,
      actualizado_en: new Date().toISOString(),
    }
    let id = tarea?.id
    if (tarea) {
      await supabase.from('mkt_tareas').update(payload).eq('id', tarea.id)
      await supabase.from('mkt_tarea_asignados').delete().eq('tarea_id', tarea.id)
      await supabase.from('mkt_tarea_etiquetas').delete().eq('tarea_id', tarea.id)
    } else {
      const { data } = await supabase.from('mkt_tareas').insert({ ...payload, creado_por: usuario.id, estado: 'pendiente' }).select().single()
      if (!data) { setGuardando(false); return }
      id = data.id
    }
    await supabase.from('mkt_tarea_asignados').insert(todos.map(uid => ({ tarea_id: id, usuario_id: uid })))
    if (f.etiquetas.length) await supabase.from('mkt_tarea_etiquetas').insert(f.etiquetas.map(e => ({ tarea_id: id, etiqueta_id: e })))
    if (!tarea && subs.length) await supabase.from('mkt_subtareas').insert(subs.map((texto, i) => ({ tarea_id: id, texto, orden: i })))

    if (tarea) {
      await log(usuario.id, id!, f.titulo, 'tarea_editada')
      if (tarea.responsable_id !== resp) {
        await log(usuario.id, id!, f.titulo, 'tarea_reasignada', `${tarea.responsable?.nombre || 'Sin responsable'} → ${usuarios.find(u => u.id === resp)?.nombre}`)
        await notificar([resp], usuario.id, 'tarea_reasignada', 'Te pasaron una tarea', f.titulo, id!)
      }
      const nuevos = todos.filter(u => !tarea.asignados.some(a => a.id === u) && u !== resp)
      await notificar(nuevos, usuario.id, 'tarea_asignada', 'Te sumaron a una tarea', f.titulo, id!)
    } else {
      await log(usuario.id, id!, f.titulo, 'tarea_creada')
      await notificar(todos, usuario.id, 'tarea_asignada', 'Te asignaron una tarea', f.titulo, id!)
    }
    setGuardando(false); onSaved()
  }

  const [subTxt, setSubTxt] = useState('')
  const chip = (activo: boolean): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 6, padding: '0.35rem 0.7rem', borderRadius: 99, cursor: 'pointer', fontSize: '0.8rem', border: activo ? '2px solid #f15922' : '1.5px solid var(--border)', backgroundColor: activo ? '#f9ddd3' : 'var(--bg-card)', color: activo ? '#c94a1a' : 'var(--text)', fontWeight: activo ? 600 : 400 })

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '0.75rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 16, padding: '1.25rem', width: '100%', maxWidth: 580, maxHeight: '94vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text)' }}>{tarea ? 'Editar tarea' : 'Nueva tarea'}</h2>
        <Campo label="Título *"><input value={f.titulo} onChange={e => set('titulo', e.target.value)} placeholder="¿Qué hay que hacer?" style={inp} autoFocus /></Campo>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0 0.75rem' }}>
          <Campo label="Prioridad">
            <select value={f.prioridad} onChange={e => set('prioridad', e.target.value)} style={inp}>
              {Object.entries(PRIORIDADES).sort((a, b) => b[1].rank - a[1].rank).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Campo>
          <Campo label="Vence *"><input type="date" value={f.deadline} onChange={e => set('deadline', e.target.value)} style={inp} /></Campo>
          <Campo label="Categoría / área">
            <select value={f.categoria} onChange={e => set('categoria', e.target.value)} style={inp}>
              <option value="">Sin categoría</option>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Campo>
          <Campo label="Repetir">
            <select value={f.recurrencia} onChange={e => set('recurrencia', e.target.value)} style={inp}>
              <option value="">No se repite</option>
              <option value="semanal">🔁 Cada semana</option>
              <option value="mensual">🔁 Cada mes</option>
            </select>
          </Campo>
          {campanas.length > 0 && (
            <Campo label="Campaña">
              <select value={f.campana_id} onChange={e => set('campana_id', e.target.value)} style={inp}>
                <option value="">Sin campaña</option>
                {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Campo>
          )}
        </div>

        <Campo label="Responsable principal">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {candidatos.map(u => <button key={u.id} type="button" onClick={() => set('responsable_id', u.id)} style={chip(f.responsable_id === u.id)}>{u.avatar_emoji} {u.nombre}</button>)}
          </div>
        </Campo>
        {puedeAsignar && (
          <Campo label="Colaboradores (opcional)">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {usuarios.filter(u => u.id !== f.responsable_id).map(u => <button key={u.id} type="button" onClick={() => toggle('colaboradores', u.id)} style={chip(f.colaboradores.includes(u.id))}>{u.avatar_emoji} {u.nombre}</button>)}
            </div>
          </Campo>
        )}

        <Campo label="Descripción"><RichEditor value={f.descripcion} onChange={v => set('descripcion', v)} placeholder="Detalles, contexto, links..." minHeight={90} /></Campo>

        {!tarea && (
          <Campo label="Checklist (opcional)">
            {subs.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, fontSize: '0.85rem', color: 'var(--text)' }}>
                <span style={{ flex: 1 }}>☐ {s}</span>
                <button type="button" onClick={() => setSubs(subs.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>×</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={subTxt} onChange={e => setSubTxt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && subTxt.trim()) { setSubs([...subs, subTxt.trim()]); setSubTxt('') } }} placeholder="Agregar paso y Enter" style={{ ...inp, flex: 1 }} />
              <button type="button" onClick={() => { if (subTxt.trim()) { setSubs([...subs, subTxt.trim()]); setSubTxt('') } }} style={{ padding: '0 14px', border: '1.5px solid var(--border)', borderRadius: 8, background: 'var(--bg-card)', color: 'var(--text)', cursor: 'pointer' }}>+</button>
            </div>
          </Campo>
        )}

        <Campo label="Etiquetas">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {etiquetas.map(e => (
              <button key={e.id} type="button" onClick={() => toggle('etiquetas', e.id)} style={{ padding: '0.25rem 0.625rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', border: f.etiquetas.includes(e.id) ? `2px solid ${e.color}` : '1.5px solid var(--border)', backgroundColor: f.etiquetas.includes(e.id) ? e.color + '22' : 'var(--bg-card)', color: f.etiquetas.includes(e.id) ? e.color : 'var(--text-muted)' }}>{e.nombre}</button>
            ))}
            <button type="button" onClick={onNuevaEtiqueta} style={{ padding: '0.25rem 0.625rem', borderRadius: 4, fontSize: '0.75rem', border: '1.5px dashed var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer' }}>+ Nueva</button>
          </div>
        </Campo>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.7rem 0.875rem', border: '1.5px solid var(--border)', borderRadius: 10, cursor: 'pointer', marginBottom: '1rem', backgroundColor: f.requiere_aprobacion ? '#f5f3ff' : 'transparent' }}>
          <input type="checkbox" checked={f.requiere_aprobacion} onChange={e => set('requiere_aprobacion', e.target.checked)} style={{ width: 18, height: 18, accentColor: '#8b5cf6' }} />
          <span style={{ fontSize: '0.85rem', color: f.requiere_aprobacion ? '#6d28d9' : 'var(--text)' }}>
            <strong>🔒 Requiere aprobación</strong><br />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Se envía a revisión y coordinación aprueba o pide correcciones antes de finalizar.</span>
          </span>
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '0.65rem', border: '1.5px solid var(--border)', borderRadius: 8, backgroundColor: 'var(--bg-card)', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text)' }}>Cancelar</button>
          <button onClick={guardar} disabled={!f.titulo.trim() || !f.deadline || guardando} style={{ flex: 2, padding: '0.65rem', border: 'none', borderRadius: 8, backgroundColor: '#f15922', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, opacity: !f.titulo.trim() || !f.deadline || guardando ? 0.6 : 1 }}>
            {guardando ? 'Guardando...' : tarea ? 'Guardar cambios' : 'Crear tarea'}
          </button>
        </div>
      </div>
    </div>
  )
}
