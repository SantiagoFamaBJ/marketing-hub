'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSesion } from '@/lib/useSesion'
import { Tarea, Usuario as UsuarioT, cargarTareas, cargarUsuarios, estaCerrada, CATEGORIAS } from '@/lib/tareas'
import TareaDetalle from '@/components/TareaDetalle'

type Evento = { id: string; titulo: string; descripcion: string | null; tipo: string; fecha_inicio: string; fecha_fin: string | null; color: string }
type CheckItem = { id: string; evento_id: string; texto: string; completado: boolean; orden: number }
type CopyCal = { id: string; nombre: string; fecha_publicacion: string; estado: string | null }
type CampCal = { id: string; nombre: string; color: string; fecha_inicio: string | null; fecha_fin: string | null }
type Campana = { id: string; nombre: string }

const TIPOS = [
  { key: 'evento', label: 'Evento', emoji: '📌' },
  { key: 'congreso', label: 'Congreso', emoji: '🏛️' },
  { key: 'lanzamiento', label: 'Lanzamiento', emoji: '🚀' },
  { key: 'deadline', label: 'Deadline', emoji: '⏰' },
  { key: 'curso', label: 'Curso', emoji: '🎓' },
  { key: 'capacitacion', label: 'Capacitación', emoji: '🧑‍🏫' },
  { key: 'publicacion', label: 'Publicación', emoji: '📣' },
  { key: 'reunion', label: 'Reunión', emoji: '👥' },
]
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS_CORTO = ['L','M','M','J','V','S','D'] // lunes primero, igual que Tareas → Mes
const COLORES = ['#f15922','#3B82F6','#8B5CF6','#10B981','#F59E0B','#EC4899','#06B6D4']
const PRIORIDAD_COLOR: Record<string,string> = { urgente:'#dc2626', alta:'#ef4444', media:'#f59e0b', baja:'#10b981' }

const inputStyle: React.CSSProperties = { width:'100%', padding:'0.625rem 0.875rem', border:'1.5px solid var(--border)', borderRadius:'8px', fontSize:'0.875rem', outline:'none', color:'var(--text)', backgroundColor:'var(--input-bg)' }

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: '0.375rem' }}>{label}</label>
      {children}
    </div>
  )
}

export default function CalendarioPage() {
  const { usuario, permisos } = useSesion()
  const [eventos, setEventos] = useState<Evento[]>([])
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioT[]>([])
  const [copys, setCopys] = useState<CopyCal[]>([])
  const [camps, setCamps] = useState<CampCal[]>([])
  const [campanas, setCampanas] = useState<Campana[]>([])
  const [fCat, setFCat] = useState(''); const [fResp, setFResp] = useState('')
  const [ver, setVer] = useState({ tareas: true, eventos: true, copys: true, campanas: true })
  const [detalleId, setDetalleId] = useState<string | null>(null)
  const hoy = new Date()
  const [mes, setMes] = useState(hoy.getMonth())
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [seleccionado, setSeleccionado] = useState<{ tipo: 'evento'; data: any } | null>(null)
  const [checklist, setChecklist] = useState<CheckItem[]>([])
  const [nuevoCheck, setNuevoCheck] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ titulo: '', descripcion: '', tipo: 'evento', fecha_inicio: '', fecha_fin: '', color: '#f15922', campana_id: '' })

  useEffect(() => { if (usuario && permisos) recargar() }, [usuario?.id, permisos])

  async function recargar() {
    if (!usuario || !permisos) return
    fetchEventos(); fetchCampanas()
    const [t, u, c] = await Promise.all([
      cargarTareas({ usuarioId: usuario.id, soloMias: !permisos.ver_todas_tareas }), cargarUsuarios(),
      supabase.from('mkt_copys_generados').select('id,nombre,fecha_publicacion,estado').not('fecha_publicacion', 'is', null),
    ])
    setTareas(t); setUsuarios(u); setCopys((c.data || []) as CopyCal[])
  }

  async function fetchEventos() {
    const { data } = await supabase.from('mkt_eventos').select('*').order('fecha_inicio')
    setEventos(data || [])
  }

  async function fetchCampanas() {
    const { data } = await supabase.from('mkt_campanas').select('id, nombre, color, fecha_inicio, fecha_fin, estado')
    setCampanas(data || [])
    setCamps((data || []).filter((c: any) => c.fecha_inicio && c.fecha_fin && c.estado !== 'archivada'))
  }

  async function fetchChecklist(eventoId: string) {
    const { data } = await supabase.from('mkt_evento_checklist').select('*').eq('evento_id', eventoId).order('orden')
    setChecklist(data || [])
  }

  async function crearEvento() {
    if (!form.titulo.trim() || !form.fecha_inicio || !usuario) return
    await supabase.from('mkt_eventos').insert({
      titulo: form.titulo, descripcion: form.descripcion || null, tipo: form.tipo,
      fecha_inicio: form.fecha_inicio, fecha_fin: form.fecha_fin || null,
      color: form.color, campana_id: form.campana_id || null, creado_por: usuario.id
    })
    await fetchEventos()
    setModalOpen(false)
    setForm({ titulo: '', descripcion: '', tipo: 'evento', fecha_inicio: '', fecha_fin: '', color: '#f15922', campana_id: '' })
  }

  async function eliminarEvento(e: Evento) {
    if (!confirm('¿Eliminás este evento?')) return
    await supabase.from('mkt_eventos').delete().eq('id', e.id)
    setSeleccionado(null); fetchEventos()
  }

  async function agregarCheck() {
    if (!nuevoCheck.trim() || !seleccionado || seleccionado.tipo !== 'evento') return
    await supabase.from('mkt_evento_checklist').insert({ evento_id: seleccionado.data.id, texto: nuevoCheck, completado: false, orden: checklist.length })
    setNuevoCheck(''); fetchChecklist(seleccionado.data.id)
  }

  async function toggleCheck(item: CheckItem) {
    await supabase.from('mkt_evento_checklist').update({ completado: !item.completado }).eq('id', item.id)
    fetchChecklist(seleccionado!.data.id)
  }

  async function eliminarCheck(item: CheckItem) {
    await supabase.from('mkt_evento_checklist').delete().eq('id', item.id)
    fetchChecklist(seleccionado!.data.id)
  }

  function seleccionarEvento(e: Evento) {
    setSeleccionado({ tipo: 'evento', data: e })
    fetchChecklist(e.id)
  }

  const primerDia = (new Date(anio, mes, 1).getDay() + 6) % 7
  const diasEnMes = new Date(anio, mes + 1, 0).getDate()
  const celdas: (number | null)[] = [...Array(primerDia).fill(null), ...Array.from({ length: diasEnMes }, (_, i) => i + 1)]
  while (celdas.length % 7 !== 0) celdas.push(null)

  const diaStr = (dia: number) => `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  const eventosDia = (dia: number) => !ver.eventos ? [] : eventos.filter(e => e.fecha_inicio <= diaStr(dia) && (e.fecha_fin ? e.fecha_fin >= diaStr(dia) : e.fecha_inicio === diaStr(dia)))
  const tareasFiltradas = tareas.filter(t => !estaCerrada(t.estado) && (!fCat || t.categoria === fCat) && (!fResp || t.responsable_id === fResp || t.asignados.some(a => a.id === fResp)))
  const tareasDia = (dia: number) => ver.tareas ? tareasFiltradas.filter(t => t.deadline === diaStr(dia)) : []
  const copysDia = (dia: number) => ver.copys ? copys.filter(c => c.fecha_publicacion === diaStr(dia)) : []
  const campsDia = (dia: number) => ver.campanas ? camps.filter(c => c.fecha_inicio! <= diaStr(dia) && c.fecha_fin! >= diaStr(dia)) : []
  const esHoy = (dia: number) => dia === hoy.getDate() && mes === hoy.getMonth() && anio === hoy.getFullYear()

  if (!usuario || !permisos) return null

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h1 style={{ fontSize: 'clamp(1.25rem, 4vw, 1.6rem)', fontWeight: 700, color: 'var(--text)' }}>📅 Calendario</h1>
        <button onClick={() => setModalOpen(true)} style={{ backgroundColor: '#f15922', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.5rem 1rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>+ Nuevo evento</button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        <select value={fCat} onChange={e => setFCat(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}>
          <option value="">Todas las categorías</option>{CATEGORIAS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        {permisos.ver_todas_tareas && (
          <select value={fResp} onChange={e => setFResp(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}>
            <option value="">Todo el equipo</option>{usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        )}
        {([['tareas', '✅ Tareas'], ['eventos', '📌 Eventos'], ['copys', '✍️ Copys'], ['campanas', '📣 Campañas']] as const).map(([k, l]) => (
          <label key={k} style={{ fontSize: '0.78rem', color: 'var(--text)', display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={ver[k]} onChange={() => setVer(v => ({ ...v, [k]: !v[k] }))} style={{ accentColor: '#f15922' }} />{l}
          </label>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: seleccionado ? 'minmax(0,1fr) 300px' : '1fr', gap: '1.25rem' }}>
        {/* Calendario */}
        <div style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: '14px', padding: '1.25rem', overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <button onClick={() => { if (mes === 0) { setMes(11); setAnio(a => a - 1) } else setMes(m => m - 1) }} style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: '8px', padding: '0.375rem 0.75rem', cursor: 'pointer' }}>‹</button>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>{MESES[mes]} {anio}</h2>
            <button onClick={() => { if (mes === 11) { setMes(0); setAnio(a => a + 1) } else setMes(m => m + 1) }} style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: '8px', padding: '0.375rem 0.75rem', cursor: 'pointer' }}>›</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
            {DIAS_CORTO.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#a0a0a0', padding: '0.25rem' }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {celdas.map((dia, i) => {
              const evs = dia ? eventosDia(dia) : []
              const tars = dia ? tareasDia(dia) : []
              const cps = dia ? copysDia(dia) : []
              const cms = dia ? campsDia(dia) : []
              return (
                <div key={i} style={{ minHeight: 72, borderRadius: '6px', padding: '0.25rem', backgroundColor: dia && esHoy(dia) ? '#f9ddd3' : 'var(--bg)', border: `1.5px solid ${dia && esHoy(dia) ? '#f15922' : 'var(--border)'}` }}>
                  {dia && (
                    <>
                      <p style={{ fontSize: '0.7rem', fontWeight: esHoy(dia) ? 700 : 400, color: esHoy(dia) ? '#f15922' : '#555', marginBottom: '3px' }}>{dia}</p>
                      {evs.slice(0, 2).map(e => (
                        <div key={e.id} onClick={() => seleccionarEvento(e)} style={{ backgroundColor: e.color, color: '#fff', borderRadius: '3px', padding: '1px 4px', marginBottom: '2px', fontSize: '0.55rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {TIPOS.find(t => t.key === e.tipo)?.emoji} {e.titulo}
                        </div>
                      ))}
                      {tars.slice(0, 2).map(t => (
                        <div key={t.id} onClick={() => setDetalleId(t.id)} style={{ backgroundColor: PRIORIDAD_COLOR[t.prioridad] + '22', color: PRIORIDAD_COLOR[t.prioridad], border: `1px solid ${PRIORIDAD_COLOR[t.prioridad]}44`, borderRadius: '3px', padding: '1px 4px', marginBottom: '2px', fontSize: '0.55rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          ✅ {t.titulo}
                        </div>
                      ))}
                      {cps.slice(0, 1).map(c => (
                        <div key={c.id} title={c.nombre} style={{ backgroundColor: '#3b82f622', color: '#3b82f6', border: '1px solid #3b82f644', borderRadius: 3, padding: '1px 4px', marginBottom: 2, fontSize: '0.55rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>✍️ {c.nombre}</div>
                      ))}
                      {cms.slice(0, 2).map(c => {
                        const rotulo = i % 7 === 0 || dia === 1 || c.fecha_inicio === diaStr(dia)
                        return (
                          <div key={c.id} title={`📣 ${c.nombre}`} style={{ marginBottom: 2 }}>
                            {rotulo && <div style={{ fontSize: '0.55rem', fontWeight: 700, color: c.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>📣 {c.nombre}</div>}
                            <div style={{ height: 4, borderRadius: 2, backgroundColor: c.color, opacity: 0.8 }} />
                          </div>
                        )
                      })}
                      {(evs.length + tars.length) > 4 && <p style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>+{evs.length + tars.length - 4}</p>}
                    </>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}><span style={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: '#f15922', display: 'inline-block' }} /> Eventos</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}><span style={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: '#f59e0b44', border: '1px solid #f59e0b', display: 'inline-block' }} /> Tareas</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}><span style={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: '#3b82f622', border: '1px solid #3b82f6', display: 'inline-block' }} /> Copys (fecha de publicación)</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}><span style={{ width: 14, height: 4, borderRadius: 2, backgroundColor: '#f15922', display: 'inline-block' }} /> Campañas (barra del color de cada campaña)</span>
          </div>
        </div>

        {/* Panel detalle */}
        {seleccionado && (
          <div style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: '14px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                {seleccionado.tipo === 'evento' ? (
                  <>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{TIPOS.find(t => t.key === seleccionado.data.tipo)?.emoji} {TIPOS.find(t => t.key === seleccionado.data.tipo)?.label}</div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.25rem' }}>{seleccionado.data.titulo}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(seleccionado.data.fecha_inicio + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
                      {seleccionado.data.fecha_fin && ` → ${new Date(seleccionado.data.fecha_fin + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}`}
                    </p>
                  </>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {seleccionado.tipo === 'evento' && (
                  <button onClick={() => eliminarEvento(seleccionado.data)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1rem' }}>🗑️</button>
                )}
                <button onClick={() => setSeleccionado(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.25rem' }}>×</button>
              </div>
            </div>

            {seleccionado?.data.descripcion && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text)', marginBottom: '1rem', lineHeight: 1.5 }}>{seleccionado.data.descripcion}</p>
            )}

            {seleccionado?.tipo === 'evento' && (
              <div>
                <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.75rem' }}>
                  Checklist ({checklist.filter(c => c.completado).length}/{checklist.length})
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '0.75rem' }}>
                  {checklist.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input type="checkbox" checked={item.completado} onChange={() => toggleCheck(item)} style={{ width: 16, height: 16, accentColor: '#f15922', cursor: 'pointer' }} />
                      <span style={{ fontSize: '0.85rem', color: item.completado ? '#a0a0a0' : 'var(--text)', textDecoration: item.completado ? 'line-through' : 'none', flex: 1 }}>{item.texto}</span>
                      <button onClick={() => eliminarCheck(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: '0.875rem' }}>✕</button>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.375rem' }}>
                  <input value={nuevoCheck} onChange={e => setNuevoCheck(e.target.value)} onKeyDown={e => e.key === 'Enter' && agregarCheck()} placeholder="Agregar ítem..." style={{ ...inputStyle, padding: '0.5rem 0.75rem', fontSize: '0.8rem' }} />
                  <button onClick={agregarCheck} style={{ padding: '0.5rem 0.75rem', backgroundColor: '#f15922', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>+</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal nuevo evento */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem' }}>Nuevo evento</h2>
            <Campo label="Título *">
              <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} style={inputStyle} />
            </Campo>
            <Campo label="Tipo">
              <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} style={inputStyle}>
                {TIPOS.map(t => <option key={t.key} value={t.key}>{t.emoji} {t.label}</option>)}
              </select>
            </Campo>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Campo label="Fecha inicio *">
                <input type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} style={inputStyle} />
              </Campo>
              <Campo label="Fecha fin">
                <input type="date" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} style={inputStyle} />
              </Campo>
            </div>
            <Campo label="Descripción">
              <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </Campo>
            {campanas.length > 0 && (
              <Campo label="Campaña">
                <select value={form.campana_id} onChange={e => setForm(f => ({ ...f, campana_id: e.target.value }))} style={inputStyle}>
                  <option value="">Sin campaña</option>
                  {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </Campo>
            )}
            <Campo label="Color">
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {COLORES.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: c, border: 'none', outline: form.color === c ? '3px solid #1a1a1a' : 'none', cursor: 'pointer' }} />
                ))}
              </div>
            </Campo>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setModalOpen(false)} style={{ flex: 1, padding: '0.625rem', border: '1.5px solid var(--border)', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--text)' }}>Cancelar</button>
              <button onClick={crearEvento} style={{ flex: 2, padding: '0.625rem', border: 'none', borderRadius: '8px', backgroundColor: '#f15922', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>Crear evento</button>
            </div>
          </div>
        </div>
      )}
      {tareas.find(t => t.id === detalleId) && <TareaDetalle tarea={tareas.find(t => t.id === detalleId)!} usuario={usuario} usuarios={usuarios} permisos={permisos} onClose={() => setDetalleId(null)} onChanged={recargar} onEditar={() => setDetalleId(null)} />}
    </div>
  )
}
