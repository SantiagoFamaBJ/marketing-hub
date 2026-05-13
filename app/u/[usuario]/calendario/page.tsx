'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Usuario = { id: string; nombre: string; slug: string; avatar_color: string; avatar_emoji: string; rol: string }
type Evento = { id: string; titulo: string; descripcion: string | null; tipo: string; fecha_inicio: string; fecha_fin: string | null; color: string; campana_id: string | null }
type CheckItem = { id: string; evento_id: string; texto: string; completado: boolean; orden: number }
type Campana = { id: string; nombre: string }

const TIPOS = [
  { key: 'evento', label: 'Evento', emoji: '📌' },
  { key: 'congreso', label: 'Congreso', emoji: '🏛️' },
  { key: 'lanzamiento', label: 'Lanzamiento', emoji: '🚀' },
  { key: 'deadline', label: 'Deadline', emoji: '⏰' },
  { key: 'curso', label: 'Curso', emoji: '🎓' },
]

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const COLORES = ['#f15922', '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4']

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.625rem 0.875rem',
  border: '1.5px solid #e8e8e8', borderRadius: '8px',
  fontSize: '0.875rem', outline: 'none', color: '#1a1a1a', backgroundColor: '#fff',
}
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '0.375rem' }}>{label}</label>
      {children}
    </div>
  )
}

export default function CalendarioPage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [campanas, setCampanas] = useState<Campana[]>([])
  const [hoy] = useState(new Date())
  const [mes, setMes] = useState(new Date().getMonth())
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [eventoSeleccionado, setEventoSeleccionado] = useState<Evento | null>(null)
  const [checklist, setChecklist] = useState<CheckItem[]>([])
  const [nuevoCheck, setNuevoCheck] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ titulo: '', descripcion: '', tipo: 'evento', fecha_inicio: '', fecha_fin: '', color: '#f15922', campana_id: '' })

  useEffect(() => {
    const stored = sessionStorage.getItem('mkt_usuario')
    if (stored) { setUsuario(JSON.parse(stored)); fetchEventos(); fetchCampanas() }
  }, [])

  async function fetchEventos() {
    const { data } = await supabase.from('mkt_eventos').select('*').order('fecha_inicio')
    setEventos(data || [])
  }

  async function fetchCampanas() {
    const { data } = await supabase.from('mkt_campanas').select('id, nombre')
    setCampanas(data || [])
  }

  async function fetchChecklist(eventoId: string) {
    const { data } = await supabase.from('mkt_evento_checklist').select('*').eq('evento_id', eventoId).order('orden')
    setChecklist(data || [])
  }

  async function seleccionarEvento(e: Evento) {
    setEventoSeleccionado(e)
    await fetchChecklist(e.id)
  }

  async function crearEvento() {
    if (!form.titulo.trim() || !form.fecha_inicio || !usuario) return
    await supabase.from('mkt_eventos').insert({
      titulo: form.titulo, descripcion: form.descripcion || null,
      tipo: form.tipo, fecha_inicio: form.fecha_inicio,
      fecha_fin: form.fecha_fin || null, color: form.color,
      campana_id: form.campana_id || null, creado_por: usuario.id,
    })
    await fetchEventos()
    setModalOpen(false)
    setForm({ titulo: '', descripcion: '', tipo: 'evento', fecha_inicio: '', fecha_fin: '', color: '#f15922', campana_id: '' })
  }

  async function eliminarEvento(e: Evento) {
    if (!confirm(`¿Eliminás "${e.titulo}"?`)) return
    await supabase.from('mkt_eventos').delete().eq('id', e.id)
    setEventoSeleccionado(null)
    fetchEventos()
  }

  async function agregarCheck() {
    if (!nuevoCheck.trim() || !eventoSeleccionado) return
    await supabase.from('mkt_evento_checklist').insert({
      evento_id: eventoSeleccionado.id, texto: nuevoCheck, completado: false, orden: checklist.length,
    })
    setNuevoCheck('')
    fetchChecklist(eventoSeleccionado.id)
  }

  async function toggleCheck(item: CheckItem) {
    await supabase.from('mkt_evento_checklist').update({ completado: !item.completado }).eq('id', item.id)
    fetchChecklist(eventoSeleccionado!.id)
  }

  async function eliminarCheck(item: CheckItem) {
    await supabase.from('mkt_evento_checklist').delete().eq('id', item.id)
    fetchChecklist(eventoSeleccionado!.id)
  }

  // Armar grilla del mes
  const primerDia = new Date(anio, mes, 1).getDay()
  const diasEnMes = new Date(anio, mes + 1, 0).getDate()
  const celdas: (number | null)[] = [...Array(primerDia).fill(null), ...Array.from({ length: diasEnMes }, (_, i) => i + 1)]
  while (celdas.length % 7 !== 0) celdas.push(null)

  function eventosDelDia(dia: number) {
    const fecha = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    return eventos.filter(e => e.fecha_inicio <= fecha && (e.fecha_fin ? e.fecha_fin >= fecha : e.fecha_inicio === fecha))
  }

  const esHoy = (dia: number) => dia === hoy.getDate() && mes === hoy.getMonth() && anio === hoy.getFullYear()

  if (!usuario) return null

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1a1a1a' }}>📅 Calendario</h1>
        <button onClick={() => setModalOpen(true)} style={{
          backgroundColor: '#f15922', color: '#fff', border: 'none',
          borderRadius: '8px', padding: '0.5rem 1rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
        }}>+ Nuevo evento</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: eventoSeleccionado ? '1fr 320px' : '1fr', gap: '1.5rem' }}>
        {/* Calendario */}
        <div style={{ backgroundColor: '#fff', border: '1.5px solid #e8e8e8', borderRadius: '14px', padding: '1.5rem' }}>
          {/* Nav mes */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <button onClick={() => { if (mes === 0) { setMes(11); setAnio(a => a - 1) } else setMes(m => m - 1) }}
              style={{ background: 'none', border: '1.5px solid #e8e8e8', borderRadius: '8px', padding: '0.375rem 0.75rem', cursor: 'pointer', fontSize: '1rem' }}>‹</button>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1a1a' }}>{MESES[mes]} {anio}</h2>
            <button onClick={() => { if (mes === 11) { setMes(0); setAnio(a => a + 1) } else setMes(m => m + 1) }}
              style={{ background: 'none', border: '1.5px solid #e8e8e8', borderRadius: '8px', padding: '0.375rem 0.75rem', cursor: 'pointer', fontSize: '1rem' }}>›</button>
          </div>

          {/* Días de la semana */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
            {DIAS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#a0a0a0', padding: '0.375rem' }}>{d}</div>
            ))}
          </div>

          {/* Grilla */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
            {celdas.map((dia, i) => {
              const evs = dia ? eventosDelDia(dia) : []
              return (
                <div key={i} style={{
                  minHeight: 80, borderRadius: '8px', padding: '0.375rem',
                  backgroundColor: dia && esHoy(dia) ? '#f9ddd3' : '#fafafa',
                  border: `1.5px solid ${dia && esHoy(dia) ? '#f15922' : '#f0f0f0'}`,
                }}>
                  {dia && (
                    <>
                      <p style={{ fontSize: '0.75rem', fontWeight: esHoy(dia) ? 700 : 400, color: esHoy(dia) ? '#f15922' : '#555', marginBottom: '4px' }}>
                        {dia}
                      </p>
                      {evs.slice(0, 3).map(e => (
                        <div key={e.id} onClick={() => seleccionarEvento(e)} style={{
                          backgroundColor: e.color, color: '#fff',
                          borderRadius: '4px', padding: '2px 5px', marginBottom: '2px',
                          fontSize: '0.6rem', fontWeight: 600, cursor: 'pointer',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {TIPOS.find(t => t.key === e.tipo)?.emoji} {e.titulo}
                        </div>
                      ))}
                      {evs.length > 3 && <p style={{ fontSize: '0.6rem', color: '#888' }}>+{evs.length - 3} más</p>}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Panel evento seleccionado */}
        {eventoSeleccionado && (
          <div style={{ backgroundColor: '#fff', border: '1.5px solid #e8e8e8', borderRadius: '14px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: eventoSeleccionado.color }} />
                  <span style={{ fontSize: '0.7rem', color: '#888' }}>
                    {TIPOS.find(t => t.key === eventoSeleccionado.tipo)?.emoji} {TIPOS.find(t => t.key === eventoSeleccionado.tipo)?.label}
                  </span>
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1a1a' }}>{eventoSeleccionado.titulo}</h3>
                <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
                  {new Date(eventoSeleccionado.fecha_inicio + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
                  {eventoSeleccionado.fecha_fin && ` → ${new Date(eventoSeleccionado.fecha_fin + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}`}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {usuario.rol === 'admin' && (
                  <button onClick={() => eliminarEvento(eventoSeleccionado)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '1rem',
                  }}>🗑️</button>
                )}
                <button onClick={() => setEventoSeleccionado(null)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '1.2rem',
                }}>×</button>
              </div>
            </div>

            {eventoSeleccionado.descripcion && (
              <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: '1rem', lineHeight: 1.5 }}>{eventoSeleccionado.descripcion}</p>
            )}

            {/* Checklist */}
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '0.75rem' }}>
                Checklist ({checklist.filter(c => c.completado).length}/{checklist.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '0.75rem' }}>
                {checklist.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" checked={item.completado} onChange={() => toggleCheck(item)}
                      style={{ width: 16, height: 16, accentColor: '#f15922', cursor: 'pointer' }} />
                    <span style={{ fontSize: '0.85rem', color: item.completado ? '#a0a0a0' : '#1a1a1a', textDecoration: item.completado ? 'line-through' : 'none', flex: 1 }}>
                      {item.texto}
                    </span>
                    <button onClick={() => eliminarCheck(item)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: '0.875rem',
                    }}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                <input value={nuevoCheck} onChange={e => setNuevoCheck(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && agregarCheck()}
                  placeholder="Agregar ítem..."
                  style={{ ...inputStyle, padding: '0.5rem 0.75rem', fontSize: '0.8rem' }} />
                <button onClick={agregarCheck} style={{
                  padding: '0.5rem 0.75rem', backgroundColor: '#f15922', color: '#fff',
                  border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700,
                }}>+</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal nuevo evento */}
      {modalOpen && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem',
        }} onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: '16px', padding: '2rem',
            width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}>
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
              <Campo label="Campaña (opcional)">
                <select value={form.campana_id} onChange={e => setForm(f => ({ ...f, campana_id: e.target.value }))} style={inputStyle}>
                  <option value="">Sin campaña</option>
                  {campanas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </Campo>
            )}
            <Campo label="Color">
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {COLORES.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{
                    width: 28, height: 28, borderRadius: '50%', backgroundColor: c, border: 'none',
                    outline: form.color === c ? '3px solid #1a1a1a' : 'none', cursor: 'pointer',
                  }} />
                ))}
              </div>
            </Campo>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setModalOpen(false)} style={{
                flex: 1, padding: '0.625rem', border: '1.5px solid #e8e8e8',
                borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.875rem', color: '#555',
              }}>Cancelar</button>
              <button onClick={crearEvento} style={{
                flex: 2, padding: '0.625rem', border: 'none',
                borderRadius: '8px', backgroundColor: '#f15922', color: '#fff',
                cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
              }}>Crear evento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
