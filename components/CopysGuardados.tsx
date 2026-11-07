'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { notificar, log, usuariosConPermiso, fechaCorta } from '@/lib/tareas'

export type CopyRow = {
  id: string; nombre: string; contenido_final: string; creado_en: string; plantilla_id: string | null
  estado: string | null; tipo: string | null; campana_id: string | null; fecha_publicacion: string | null
  publicado_por: string | null; publicado_en: string | null; creado_por: string | null
}
type Archivo = { id: string; nombre_archivo: string; url: string; tipo: string | null }

export const COPY_ESTADOS = [
  { key: 'borrador', label: 'Borrador', color: '#6b7280' },
  { key: 'revision', label: 'En revisión', color: '#f59e0b' },
  { key: 'aprobado', label: 'Aprobado', color: '#10b981' },
  { key: 'publicado', label: 'Publicado', color: '#3b82f6' },
]
export const COPY_TIPOS = [
  { key: 'social', label: 'Redes sociales' }, { key: 'email', label: 'Email' }, { key: 'promociones', label: 'Promociones' },
  { key: 'lanzamientos', label: 'Lanzamientos' }, { key: 'capacitaciones', label: 'Capacitaciones' },
]
const SIG: Record<string, { to: string; label: string }> = {
  borrador: { to: 'revision', label: 'Enviar a revisión' },
  revision: { to: 'aprobado', label: '✅ Aprobar' },
  aprobado: { to: 'publicado', label: '📣 Marcar publicado' },
}
const inp: React.CSSProperties = { padding: '0.45rem 0.6rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.8rem', color: 'var(--text)', backgroundColor: 'var(--input-bg)' }

export default function CopysGuardados({ usuario, permisos, copys, campanas, usuarios, onChanged }: {
  usuario: any; permisos: any; copys: CopyRow[]; campanas: { id: string; nombre: string }[]; usuarios: { id: string; nombre: string }[]; onChanged: () => void
}) {
  const [fe, setFe] = useState(''); const [ft, setFt] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)
  const [archivos, setArchivos] = useState<Archivo[]>([])
  const puedeAprobar = !!permisos?.aprobar_tareas

  useEffect(() => {
    if (!abierto) return
    supabase.from('mkt_archivos').select('id,nombre_archivo,url,tipo').eq('entidad', 'copy').eq('entidad_id', abierto).order('creado_en', { ascending: false })
      .then(({ data }) => setArchivos(data || []))
  }, [abierto])

  async function patch(c: CopyRow, cambios: Record<string, any>) {
    await supabase.from('mkt_copys_generados').update(cambios).eq('id', c.id)
    onChanged()
  }

  async function avanzar(c: CopyRow) {
    const est = c.estado || 'borrador'; const sig = SIG[est]; if (!sig) return
    if ((sig.to === 'aprobado' || sig.to === 'publicado') && !puedeAprobar) return alert('Necesitás permiso de aprobación.')
    const cambios: any = { estado: sig.to }
    if (sig.to === 'publicado') { cambios.publicado_por = usuario.id; cambios.publicado_en = new Date().toISOString() }
    await patch(c, cambios)
    if (sig.to === 'revision') {
      const aprob = await usuariosConPermiso('aprobar_tareas')
      await notificar(aprob.map(u => u.id), usuario.id, 'revision_solicitada', 'Copy para revisar', `${usuario.nombre} envió a revisión "${c.nombre}"`, c.id, 'copy')
    }
    if (sig.to === 'aprobado' && c.creado_por)
      await notificar([c.creado_por], usuario.id, 'tarea_aprobada', 'Copy aprobado', `Tu copy "${c.nombre}" fue aprobado`, c.id, 'copy')
    await log(usuario.id, null, c.nombre, `copy_${sig.to}`)
  }

  async function pedirCambios(c: CopyRow) {
    await patch(c, { estado: 'borrador' })
    if (c.creado_por) await notificar([c.creado_por], usuario.id, 'correcciones_solicitadas', 'Cambios en tu copy', `Pedimos cambios en "${c.nombre}"`, c.id, 'copy')
  }

  async function subir(c: CopyRow, f: File) {
    const path = `copys/${c.id}/${Date.now()}.${f.name.split('.').pop()}`
    const { data } = await supabase.storage.from('mkt-adjuntos').upload(path, f)
    if (!data) return
    const { data: u } = supabase.storage.from('mkt-adjuntos').getPublicUrl(path)
    await supabase.from('mkt_archivos').insert({ entidad: 'copy', entidad_id: c.id, nombre_archivo: f.name, url: u.publicUrl, tipo: f.type, subido_por: usuario.id })
    const { data: a } = await supabase.from('mkt_archivos').select('id,nombre_archivo,url,tipo').eq('entidad', 'copy').eq('entidad_id', c.id)
    setArchivos(a || [])
  }

  const lista = copys.filter(c => (!fe || (c.estado || 'borrador') === fe) && (!ft || c.tipo === ft))

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select value={fe} onChange={e => setFe(e.target.value)} style={inp}><option value="">Todos los estados</option>{COPY_ESTADOS.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}</select>
        <select value={ft} onChange={e => setFt(e.target.value)} style={inp}><option value="">Todos los tipos</option>{COPY_TIPOS.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}</select>
      </div>
      {lista.length === 0 && <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}><p style={{ fontSize: '2rem' }}>🕐</p><p style={{ fontWeight: 600 }}>No hay copys</p></div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lista.map(c => {
          const est = COPY_ESTADOS.find(e => e.key === (c.estado || 'borrador'))!
          const sig = SIG[c.estado || 'borrador']
          const camp = campanas.find(x => x.id === c.campana_id)
          const quien = usuarios.find(u => u.id === c.publicado_por)
          return (
            <div key={c.id} style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <p style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.9rem' }}>{c.nombre}</p>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 9px', borderRadius: 99, backgroundColor: est.color + '22', color: est.color }}>{est.label}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <select value={c.tipo || ''} onChange={e => patch(c, { tipo: e.target.value || null })} style={inp}><option value="">Tipo…</option>{COPY_TIPOS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select>
                <select value={c.campana_id || ''} onChange={e => patch(c, { campana_id: e.target.value || null })} style={inp}><option value="">Sin campaña</option>{campanas.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select>
                <input type="date" value={c.fecha_publicacion || ''} onChange={e => patch(c, { fecha_publicacion: e.target.value || null })} style={inp} title="Fecha de publicación" />
              </div>
              <div style={{ backgroundColor: 'var(--bg)', borderRadius: 8, padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 110, overflowY: 'auto' }}>{c.contenido_final}</div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {sig && (sig.to === 'revision' || puedeAprobar) && <button onClick={() => avanzar(c)} style={{ padding: '0.4rem 0.8rem', border: 'none', borderRadius: 8, backgroundColor: '#f15922', color: '#fff', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer' }}>{sig.label}</button>}
                {c.estado === 'revision' && puedeAprobar && <button onClick={() => pedirCambios(c)} style={{ padding: '0.4rem 0.8rem', border: '1.5px solid var(--border)', borderRadius: 8, background: 'transparent', color: 'var(--text)', fontSize: '0.78rem', cursor: 'pointer' }}>↩ Pedir cambios</button>}
                <button onClick={() => navigator.clipboard.writeText(c.contenido_final)} style={{ padding: '0.4rem 0.8rem', border: '1.5px solid var(--border)', borderRadius: 8, background: 'transparent', color: 'var(--text)', fontSize: '0.78rem', cursor: 'pointer' }}>Copiar</button>
                <button onClick={() => setAbierto(abierto === c.id ? null : c.id)} style={{ padding: '0.4rem 0.8rem', border: '1.5px solid var(--border)', borderRadius: 8, background: 'transparent', color: 'var(--text)', fontSize: '0.78rem', cursor: 'pointer' }}>📎 Materiales</button>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {camp ? `📣 ${camp.nombre} · ` : ''}{c.estado === 'publicado' && quien ? `Publicó ${quien.nombre.split(' ')[0]} ${c.publicado_en ? fechaCorta(c.publicado_en.slice(0, 10)) : ''}` : new Date(c.creado_en).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              {abierto === c.id && (
                <div style={{ marginTop: 8 }}>
                  {archivos.map(a => <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', fontSize: '0.8rem', color: '#f15922', padding: '2px 0' }}>📎 {a.nombre_archivo}</a>)}
                  <label style={{ display: 'inline-block', marginTop: 4, fontSize: '0.78rem', color: 'var(--text-muted)', cursor: 'pointer', border: '1.5px dashed var(--border)', borderRadius: 8, padding: '0.3rem 0.7rem' }}>+ Subir
                    <input type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) subir(c, f) }} />
                  </label>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
