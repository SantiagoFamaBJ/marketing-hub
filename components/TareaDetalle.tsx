'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { RichContent } from '@/components/RichEditor'
import {
  Tarea, Usuario, Permisos, estadoInfo, prioridadInfo, fechaLarga, vencida, estaCerrada,
  aplicarAccion, log, notificar, versionActual, ESTADOS,
} from '@/lib/tareas'

type Comentario = { id: string; autor_id: string; contenido: string; creado_en: string }
type Adjunto = { id: string; nombre_archivo: string; url: string; tipo: string | null; creado_en: string; version: number }
type Subtarea = { id: string; texto: string; completado: boolean }
type Revision = { id: string; version: number; accion: string; comentario: string | null; usuario_id: string | null; creado_en: string }

const inp: React.CSSProperties = { width: '100%', padding: '0.625rem 0.875rem', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: '0.875rem', outline: 'none', color: 'var(--text)', backgroundColor: 'var(--input-bg)' }
const btn = (bg: string, color = '#fff'): React.CSSProperties => ({ padding: '0.5rem 1rem', border: 'none', borderRadius: 8, backgroundColor: bg, color, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' })

export default function TareaDetalle({ tarea, usuario, usuarios, permisos, campanaNombre, onClose, onChanged, onEditar }: {
  tarea: Tarea; usuario: Usuario; usuarios: Usuario[]; permisos: Permisos; campanaNombre?: string
  onClose: () => void; onChanged: () => void; onEditar: (t: Tarea) => void
}) {
  const [tab, setTab] = useState<'info' | 'checklist' | 'comentarios' | 'archivos' | 'revisiones'>('info')
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([])
  const [subtareas, setSubtareas] = useState<Subtarea[]>([])
  const [revisiones, setRevisiones] = useState<Revision[]>([])
  const [nuevoComentario, setNuevoComentario] = useState('')
  const [nuevaSub, setNuevaSub] = useState('')
  const [link, setLink] = useState({ nombre: '', url: '' })
  const [subiendo, setSubiendo] = useState(false)
  const [accion, setAccion] = useState<null | 'finalizar' | 'enviar_revision' | 'aprobar' | 'pedir_correcciones'>(null)
  const [texto, setTexto] = useState('')
  const [horas, setHoras] = useState('')
  const [guardando, setGuardando] = useState(false)

  const mapaUsuarios = Object.fromEntries(usuarios.map(u => [u.id, u]))
  const soyParte = tarea.creado_por === usuario.id || tarea.asignados.some(a => a.id === usuario.id)
  const puedeEditar = soyParte || permisos.aprobar_tareas
  const puedeAprobar = !!permisos.aprobar_tareas
  const est = estadoInfo(tarea.estado)
  const pri = prioridadInfo(tarea.prioridad)
  const cerrada = estaCerrada(tarea.estado)
  const puedeFinalizarDirecto = !tarea.requiere_aprobacion || puedeAprobar

  useEffect(() => { cargar() }, [tarea.id])

  async function cargar() {
    const [c, a, s, r] = await Promise.all([
      supabase.from('mkt_tarea_comentarios').select('*').eq('tarea_id', tarea.id).order('creado_en', { ascending: true }),
      supabase.from('mkt_tarea_adjuntos').select('*').eq('tarea_id', tarea.id).order('creado_en', { ascending: false }),
      supabase.from('mkt_subtareas').select('*').eq('tarea_id', tarea.id).order('orden').order('creado_en'),
      supabase.from('mkt_tarea_revisiones').select('*').eq('tarea_id', tarea.id).order('creado_en', { ascending: false }),
    ])
    setComentarios(c.data || []); setAdjuntos(a.data || []); setSubtareas(s.data || []); setRevisiones(r.data || [])
  }

  async function comentar() {
    const t = nuevoComentario.trim()
    if (!t) return
    await supabase.from('mkt_tarea_comentarios').insert({ tarea_id: tarea.id, autor_id: usuario.id, contenido: t })
    await log(usuario.id, tarea.id, tarea.titulo, 'comentario_agregado')
    // menciones @Nombre
    const menc = usuarios.filter(u => u.id !== usuario.id && t.toLowerCase().includes('@' + u.nombre.split(' ')[0].toLowerCase()))
    await notificar(menc.map(u => u.id), usuario.id, 'mencion', `${usuario.nombre} te mencionó`, `${tarea.titulo}: ${t.slice(0, 80)}`, tarea.id)
    const otros = tarea.asignados.filter(a => !menc.some(m => m.id === a.id)).map(a => a.id)
    await notificar(otros, usuario.id, 'tarea_comentario', 'Nuevo comentario', `${usuario.nombre} en ${tarea.titulo}`, tarea.id)
    setNuevoComentario(''); cargar()
  }

  async function agregarSub() {
    const t = nuevaSub.trim()
    if (!t) return
    await supabase.from('mkt_subtareas').insert({ tarea_id: tarea.id, texto: t, orden: subtareas.length })
    setNuevaSub(''); await cargar(); onChanged()
  }
  async function toggleSub(s: Subtarea) {
    setSubtareas(prev => prev.map(x => x.id === s.id ? { ...x, completado: !x.completado } : x))
    await supabase.from('mkt_subtareas').update({ completado: !s.completado }).eq('id', s.id)
    onChanged()
  }
  async function borrarSub(s: Subtarea) {
    await supabase.from('mkt_subtareas').delete().eq('id', s.id)
    await cargar(); onChanged()
  }

  async function subirArchivo(file: File) {
    setSubiendo(true)
    const ext = file.name.split('.').pop()
    const path = `${tarea.id}/${Date.now()}.${ext}`
    const { data } = await supabase.storage.from('mkt-adjuntos').upload(path, file)
    if (data) {
      const { data: u } = supabase.storage.from('mkt-adjuntos').getPublicUrl(path)
      await supabase.from('mkt_tarea_adjuntos').insert({ tarea_id: tarea.id, nombre_archivo: file.name, url: u.publicUrl, tipo: file.type, subido_por: usuario.id, version: await versionActual(tarea.id) })
      cargar()
    }
    setSubiendo(false)
  }
  async function agregarLink() {
    let url = link.url.trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url
    await supabase.from('mkt_tarea_adjuntos').insert({ tarea_id: tarea.id, nombre_archivo: link.nombre.trim() || url, url, tipo: 'link', subido_por: usuario.id, version: await versionActual(tarea.id) })
    setLink({ nombre: '', url: '' }); cargar()
  }

  async function mover(e: string) {
    if (e === tarea.estado) return
    if (e === 'finalizada') { puedeFinalizarDirecto ? setAccion('finalizar') : setAccion('enviar_revision'); return }
    if (e === 'para_revision') { setAccion('enviar_revision'); return }
    if (e === 'correcciones') { setAccion('pedir_correcciones'); return }
    await aplicarAccion({ tarea, accion: 'mover', actor: usuario, nuevoEstado: e })
    onChanged(); onClose()
  }

  async function confirmar() {
    if (!accion) return
    if (accion === 'pedir_correcciones' && !texto.trim()) return
    setGuardando(true)
    await aplicarAccion({ tarea, accion, actor: usuario, comentario: texto.trim() || undefined, horas: horas ? parseFloat(horas) : null })
    setGuardando(false); setAccion(null); setTexto(''); setHoras(''); onChanged(); onClose()
  }

  async function eliminar() {
    if (!confirm('¿Eliminás esta tarea?')) return
    await log(usuario.id, null, tarea.titulo, 'tarea_eliminada')
    await supabase.from('mkt_tareas').delete().eq('id', tarea.id)
    onChanged(); onClose()
  }

  // Archivos agrupados por versión (más nueva primero)
  const versiones = [...new Set(adjuntos.map(a => a.version || 1))].sort((a, b) => b - a)

  const tabs: [typeof tab, string][] = [
    ['info', '📋 Info'],
    ['checklist', `☑️ Checklist${tarea.subtareas.total || subtareas.length ? ` (${subtareas.filter(s => s.completado).length}/${subtareas.length})` : ''}`],
    ['comentarios', `💬 ${comentarios.length}`],
    ['archivos', `📎 ${adjuntos.length}`],
  ]
  if (tarea.requiere_aprobacion || revisiones.length > 0) tabs.push(['revisiones', `🔁 Revisiones (${revisiones.length})`])

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '0.75rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.25rem 0.875rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, backgroundColor: pri.bg, color: pri.color, padding: '2px 10px', borderRadius: 99 }}>{pri.label}</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, backgroundColor: est.bg, color: est.color, padding: '2px 10px', borderRadius: 99 }}>{est.label}</span>
                {tarea.categoria && <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 99 }}>{tarea.categoria}</span>}
                {tarea.requiere_aprobacion && <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#8b5cf6', border: '1px solid #8b5cf655', padding: '2px 8px', borderRadius: 99 }}>🔒 Con aprobación</span>}
                {tarea.etiquetas.map(e => <span key={e.id} style={{ fontSize: '0.65rem', fontWeight: 600, backgroundColor: e.color + '22', color: e.color, padding: '2px 8px', borderRadius: 4 }}>{e.nombre}</span>)}
              </div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', marginBottom: 4, wordBreak: 'break-word' }}>{tarea.titulo}</h2>
              <p style={{ fontSize: '0.75rem', color: vencida(tarea) ? '#ef4444' : 'var(--text-muted)' }}>📅 Vence {fechaLarga(tarea.deadline)}{vencida(tarea) && ' · Vencida'}{campanaNombre && ` · 📣 ${campanaNombre}`}</p>
            </div>
            <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: 'var(--text-muted)', alignSelf: 'flex-start' }}>×</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 0.75rem', overflowX: 'auto' }}>
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ padding: '0.6rem 0.75rem', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap', fontWeight: tab === k ? 700 : 400, color: tab === k ? '#f15922' : 'var(--text-muted)', borderBottom: tab === k ? '2px solid #f15922' : '2px solid transparent', marginBottom: -1 }}>{l}</button>
          ))}
        </div>

        {/* Contenido */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
          {tab === 'info' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 14 }}>
                <Dato label="Responsable">{tarea.responsable ? <Chip u={tarea.responsable} /> : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Sin asignar</span>}</Dato>
                <Dato label="Colaboradores">
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {tarea.asignados.filter(a => a.id !== tarea.responsable_id).map(a => <Chip key={a.id} u={a} />)}
                    {tarea.asignados.filter(a => a.id !== tarea.responsable_id).length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>}
                  </div>
                </Dato>
                <Dato label="Creada">{new Date(tarea.creado_en).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}{tarea.creado_por && mapaUsuarios[tarea.creado_por] ? ` · ${mapaUsuarios[tarea.creado_por].nombre.split(' ')[0]}` : ''}</Dato>
                {tarea.aprobada_en && <Dato label="Aprobada">{new Date(tarea.aprobada_en).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</Dato>}
                {tarea.finalizada_en && <Dato label="Finalizada">{new Date(tarea.finalizada_en).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}{tarea.horas_dedicadas ? ` · ${tarea.horas_dedicadas}h` : ''}</Dato>}
              </div>
              {tarea.descripcion && tarea.descripcion !== '<p></p>'
                ? <div style={{ backgroundColor: 'var(--bg)', borderRadius: 10, padding: '1rem', marginBottom: 14 }}><RichContent html={tarea.descripcion} /></div>
                : <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', marginBottom: 14 }}>Sin descripción.</p>}

              {/* Estado */}
              {puedeEditar && !cerrada && (
                <Dato label="Cambiar estado">
                  <select value={tarea.estado} onChange={e => mover(e.target.value)} style={{ ...inp, maxWidth: 260 }}>
                    {ESTADOS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </Dato>
              )}

              {/* Acciones de aprobación */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                {!cerrada && puedeEditar && tarea.estado !== 'para_revision' && (tarea.requiere_aprobacion || tarea.estado === 'correcciones') && (
                  <button onClick={() => setAccion('enviar_revision')} style={btn('#8b5cf6')}>📤 Enviar a revisión</button>
                )}
                {!cerrada && puedeEditar && puedeFinalizarDirecto && (
                  <button onClick={() => setAccion('finalizar')} style={btn('#10b981')}>✅ Finalizar</button>
                )}
                {tarea.estado === 'para_revision' && puedeAprobar && (
                  <>
                    <button onClick={() => { setAccion('aprobar'); setTexto('') }} style={btn('#10b981')}>👍 Aprobar</button>
                    <button onClick={() => { setAccion('pedir_correcciones'); setTexto('') }} style={btn('#ef4444')}>🔁 Pedir correcciones</button>
                  </>
                )}
                {puedeEditar && <button onClick={() => onEditar(tarea)} style={btn('var(--bg)', 'var(--text)')}>✏️ Editar</button>}
                {puedeEditar && <button onClick={eliminar} style={{ ...btn('#fef2f2', '#ef4444'), marginLeft: 'auto' }}>🗑️</button>}
              </div>
              {tarea.estado === 'para_revision' && !puedeAprobar && <p style={{ marginTop: 10, fontSize: '0.8rem', color: '#8b5cf6' }}>⏳ Esperando la revisión de coordinación.</p>}
            </>
          )}

          {tab === 'checklist' && (
            <div>
              {subtareas.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: 12 }}>Sin pasos todavía.</p>}
              {subtareas.length > 0 && (
                <div style={{ height: 6, borderRadius: 99, backgroundColor: 'var(--border)', overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{ height: '100%', width: `${(subtareas.filter(s => s.completado).length / subtareas.length) * 100}%`, backgroundColor: '#10b981' }} />
                </div>
              )}
              {subtareas.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>
                  <input type="checkbox" checked={s.completado} disabled={!puedeEditar} onChange={() => toggleSub(s)} style={{ width: 18, height: 18, accentColor: '#f15922' }} />
                  <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text)', textDecoration: s.completado ? 'line-through' : 'none', opacity: s.completado ? 0.6 : 1 }}>{s.texto}</span>
                  {puedeEditar && <button onClick={() => borrarSub(s)} aria-label="Quitar" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>×</button>}
                </div>
              ))}
              {puedeEditar && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <input value={nuevaSub} onChange={e => setNuevaSub(e.target.value)} onKeyDown={e => e.key === 'Enter' && agregarSub()} placeholder="Agregar paso..." style={{ ...inp, flex: 1 }} />
                  <button onClick={agregarSub} style={btn('#f15922')}>+</button>
                </div>
              )}
            </div>
          )}

          {tab === 'comentarios' && (
            <div>
              {comentarios.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: 12 }}>Sin comentarios todavía.</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
                {comentarios.map(c => {
                  const a = mapaUsuarios[c.autor_id]
                  return (
                    <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', backgroundColor: a?.avatar_color || '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', flexShrink: 0 }}>{a?.avatar_emoji || '👤'}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>{a?.nombre || 'Usuario'} <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.7rem' }}>{new Date(c.creado_en).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></p>
                        <div style={{ backgroundColor: 'var(--bg)', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.5, marginTop: 2, wordBreak: 'break-word' }}>{c.contenido}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={nuevoComentario} onChange={e => setNuevoComentario(e.target.value)} onKeyDown={e => e.key === 'Enter' && comentar()} placeholder="Comentá (usá @Nombre para mencionar)" style={{ ...inp, flex: 1 }} />
                <button onClick={comentar} style={btn('#f15922')}>Enviar</button>
              </div>
            </div>
          )}

          {tab === 'archivos' && (
            <div>
              {adjuntos.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: 12 }}>Sin archivos ni links.</p>}
              {versiones.map(v => (
                <div key={v} style={{ marginBottom: 12 }}>
                  {(tarea.requiere_aprobacion || versiones.length > 1) && (
                    <p style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Versión {v}{v === versiones[0] ? ' · actual' : ' · anterior'}</p>
                  )}
                  {adjuntos.filter(a => (a.version || 1) === v).map(a => (
                    <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.6rem 0.875rem', backgroundColor: 'var(--bg)', borderRadius: 8, textDecoration: 'none', marginBottom: 6, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '1.2rem' }}>{a.tipo === 'link' ? '🔗' : a.tipo?.startsWith('image') ? '🖼️' : a.tipo?.includes('pdf') ? '📄' : '📎'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nombre_archivo}</p>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(a.creado_en).toLocaleDateString('es-AR')}</p>
                      </div>
                      <span style={{ color: '#f15922', fontWeight: 700 }}>↗</span>
                    </a>
                  ))}
                </div>
              ))}
              {puedeEditar && (
                <>
                  <label style={{ display: 'block', padding: '0.75rem', border: '2px dashed var(--border)', borderRadius: 10, textAlign: 'center', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 10 }}>
                    {subiendo ? 'Subiendo...' : '+ Subir archivo'}
                    <input type="file" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) subirArchivo(f) }} />
                  </label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <input value={link.nombre} onChange={e => setLink(l => ({ ...l, nombre: e.target.value }))} placeholder="Nombre (opcional)" style={{ ...inp, flex: '1 1 120px' }} />
                    <input value={link.url} onChange={e => setLink(l => ({ ...l, url: e.target.value }))} placeholder="Pegá un link" style={{ ...inp, flex: '2 1 160px' }} />
                    <button onClick={agregarLink} style={btn('#f15922')}>🔗 Agregar</button>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'revisiones' && (
            <div>
              {revisiones.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: 12 }}>Todavía no hubo revisiones.</p>}
              {revisiones.map(r => {
                const info = r.accion === 'enviada' ? { t: 'Enviada a revisión', c: '#8b5cf6', e: '📤' } : r.accion === 'aprobada' ? { t: 'Aprobada', c: '#10b981', e: '👍' } : { t: 'Correcciones solicitadas', c: '#ef4444', e: '🔁' }
                return (
                  <div key={r.id} style={{ borderLeft: `3px solid ${info.c}`, padding: '6px 12px', marginBottom: 10 }}>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: info.c }}>{info.e} {info.t} · v{r.version}</p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{r.usuario_id ? mapaUsuarios[r.usuario_id]?.nombre : ''} · {new Date(r.creado_en).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                    {r.comentario && <p style={{ fontSize: '0.85rem', color: 'var(--text)', marginTop: 4 }}>{r.comentario}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de acción */}
      {accion && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}
          onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) setAccion(null) }}>
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 400 }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              {accion === 'finalizar' ? '🎉 Finalizar tarea' : accion === 'enviar_revision' ? '📤 Enviar a revisión' : accion === 'aprobar' ? '👍 Aprobar tarea' : '🔁 Pedir correcciones'}
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>{tarea.titulo}</p>
            {accion === 'finalizar' && (
              <input type="number" min="0" step="0.5" value={horas} onChange={e => setHoras(e.target.value)} placeholder="Horas dedicadas (opcional)" style={{ ...inp, marginBottom: 12 }} />
            )}
            {accion !== 'finalizar' && (
              <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={3} style={{ ...inp, marginBottom: 12, resize: 'vertical' }}
                placeholder={accion === 'pedir_correcciones' ? 'Qué hay que corregir (obligatorio)' : accion === 'enviar_revision' ? 'Nota para quien revisa (opcional). Subí los archivos en la pestaña 📎' : 'Comentario (opcional)'} />
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setAccion(null)} style={{ ...btn('var(--bg)', 'var(--text)'), flex: 1, border: '1.5px solid var(--border)' }}>Cancelar</button>
              <button onClick={confirmar} disabled={guardando || (accion === 'pedir_correcciones' && !texto.trim())} style={{ ...btn(accion === 'pedir_correcciones' ? '#ef4444' : accion === 'enviar_revision' ? '#8b5cf6' : '#10b981'), flex: 2, opacity: guardando || (accion === 'pedir_correcciones' && !texto.trim()) ? 0.6 : 1 }}>
                {guardando ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</p><div style={{ fontSize: '0.85rem', color: 'var(--text)' }}>{children}</div></div>
}
function Chip({ u }: { u: Usuario }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, backgroundColor: u.avatar_color + '22', color: u.avatar_color, padding: '3px 8px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600 }}>{u.avatar_emoji} {u.nombre}</span>
}
