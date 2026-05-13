'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Usuario = { id: string; nombre: string; slug: string; avatar_color: string; avatar_emoji: string; rol: string }
type Variable = { key: string; label: string }
type Plantilla = { id: string; nombre: string; categoria: string; contenido: string; variables: Variable[]; activa: boolean }
type CopyGenerado = { id: string; nombre: string; contenido_final: string; creado_en: string; plantilla_id: string | null }

const CATEGORIAS = ['Cursos', 'Congresos', 'Productos', 'Institucional', 'General']
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

export default function CopysPage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [plantillas, setPlantillas] = useState<Plantilla[]>([])
  const [historial, setHistorial] = useState<CopyGenerado[]>([])
  const [vista, setVista] = useState<'plantillas' | 'historial'>('plantillas')
  const [plantillaActiva, setPlantillaActiva] = useState<Plantilla | null>(null)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [nombreCopy, setNombreCopy] = useState('')
  const [copiado, setCopiado] = useState(false)

  // Modal admin - gestión de plantillas
  const [modalPlantilla, setModalPlantilla] = useState(false)
  const [editandoPlantilla, setEditandoPlantilla] = useState<Plantilla | null>(null)
  const [formPlantilla, setFormPlantilla] = useState({
    nombre: '', categoria: 'General', contenido: '', variablesRaw: '',
  })

  useEffect(() => {
    const stored = sessionStorage.getItem('mkt_usuario')
    if (stored) { setUsuario(JSON.parse(stored)); fetchPlantillas(); fetchHistorial() }
  }, [])

  async function fetchPlantillas() {
    const { data } = await supabase.from('mkt_plantillas').select('*').eq('activa', true).order('nombre')
    setPlantillas(data || [])
  }

  async function fetchHistorial() {
    const { data } = await supabase.from('mkt_copys_generados').select('*').order('creado_en', { ascending: false }).limit(50)
    setHistorial(data || [])
  }

  function seleccionarPlantilla(p: Plantilla) {
    setPlantillaActiva(p)
    const init: Record<string, string> = {}
    p.variables.forEach(v => { init[v.key] = '' })
    setValores(init)
    setNombreCopy('')
    setCopiado(false)
  }

  function generarTexto() {
    if (!plantillaActiva) return ''
    let texto = plantillaActiva.contenido
    plantillaActiva.variables.forEach(v => {
      texto = texto.replaceAll(`{{${v.key}}}`, valores[v.key] || `[${v.label}]`)
    })
    return texto
  }

  async function guardarCopy() {
    if (!usuario || !plantillaActiva) return
    const contenido = generarTexto()
    await supabase.from('mkt_copys_generados').insert({
      plantilla_id: plantillaActiva.id,
      nombre: nombreCopy || `${plantillaActiva.nombre} — ${new Date().toLocaleDateString('es-AR')}`,
      contenido_final: contenido,
      variables_usadas: valores,
      creado_por: usuario.id,
    })
    fetchHistorial()
    alert('✅ Copy guardado en el historial')
  }

  async function copiarTexto() {
    navigator.clipboard.writeText(generarTexto())
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  // Admin: gestión de plantillas
  function abrirNuevaPlantilla() {
    setEditandoPlantilla(null)
    setFormPlantilla({ nombre: '', categoria: 'General', contenido: '', variablesRaw: '' })
    setModalPlantilla(true)
  }

  function abrirEditarPlantilla(p: Plantilla) {
    setEditandoPlantilla(p)
    setFormPlantilla({
      nombre: p.nombre, categoria: p.categoria, contenido: p.contenido,
      variablesRaw: p.variables.map(v => `${v.key}:${v.label}`).join('\n'),
    })
    setModalPlantilla(true)
  }

  function parsearVariables(raw: string): Variable[] {
    return raw.split('\n').filter(Boolean).map(line => {
      const [key, ...rest] = line.split(':')
      return { key: key.trim(), label: rest.join(':').trim() || key.trim() }
    })
  }

  async function guardarPlantilla() {
    if (!formPlantilla.nombre.trim() || !usuario) return
    const variables = parsearVariables(formPlantilla.variablesRaw)
    const payload = {
      nombre: formPlantilla.nombre, categoria: formPlantilla.categoria,
      contenido: formPlantilla.contenido, variables,
    }
    if (editandoPlantilla) {
      await supabase.from('mkt_plantillas').update(payload).eq('id', editandoPlantilla.id)
    } else {
      await supabase.from('mkt_plantillas').insert({ ...payload, creado_por: usuario.id, activa: true })
    }
    await fetchPlantillas()
    setModalPlantilla(false)
  }

  async function eliminarPlantilla(p: Plantilla) {
    if (!confirm(`¿Eliminás la plantilla "${p.nombre}"?`)) return
    await supabase.from('mkt_plantillas').update({ activa: false }).eq('id', p.id)
    fetchPlantillas()
    if (plantillaActiva?.id === p.id) setPlantillaActiva(null)
  }

  const textoGenerado = generarTexto()
  const todosCompletos = plantillaActiva?.variables.every(v => valores[v.key]?.trim()) ?? false

  if (!usuario) return null

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1a1a1a' }}>✍️ Copys</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ display: 'flex', border: '1.5px solid #e8e8e8', borderRadius: '8px', overflow: 'hidden' }}>
            {(['plantillas', 'historial'] as const).map(v => (
              <button key={v} onClick={() => setVista(v)} style={{
                padding: '0.375rem 0.875rem', border: 'none',
                backgroundColor: vista === v ? '#f15922' : '#fff',
                color: vista === v ? '#fff' : '#666',
                cursor: 'pointer', fontSize: '0.8rem', fontWeight: vista === v ? 600 : 400,
              }}>
                {v === 'plantillas' ? '📋 Plantillas' : '🕐 Historial'}
              </button>
            ))}
          </div>
          {usuario.rol === 'admin' && (
            <button onClick={abrirNuevaPlantilla} style={{
              backgroundColor: '#f15922', color: '#fff', border: 'none',
              borderRadius: '8px', padding: '0.5rem 1rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
            }}>+ Nueva plantilla</button>
          )}
        </div>
      </div>

      {/* VISTA PLANTILLAS */}
      {vista === 'plantillas' && (
        <div style={{ display: 'grid', gridTemplateColumns: plantillaActiva ? '280px 1fr' : '1fr', gap: '1.5rem' }}>
          {/* Lista de plantillas */}
          <div>
            {CATEGORIAS.filter(cat => plantillas.some(p => p.categoria === cat)).map(cat => (
              <div key={cat} style={{ marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#a0a0a0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.375rem' }}>
                  {cat}
                </p>
                {plantillas.filter(p => p.categoria === cat).map(p => (
                  <div key={p.id} style={{
                    backgroundColor: plantillaActiva?.id === p.id ? '#f9ddd3' : '#fff',
                    border: `1.5px solid ${plantillaActiva?.id === p.id ? '#f15922' : '#e8e8e8'}`,
                    borderRadius: '10px', padding: '0.75rem', marginBottom: '0.5rem',
                    cursor: 'pointer',
                  }}
                    onClick={() => seleccionarPlantilla(p)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1a1a1a' }}>{p.nombre}</p>
                      {usuario.rol === 'admin' && (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button onClick={e => { e.stopPropagation(); abrirEditarPlantilla(p) }} style={{
                            background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#888', padding: '2px 4px',
                          }}>✏️</button>
                          <button onClick={e => { e.stopPropagation(); eliminarPlantilla(p) }} style={{
                            background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#ef4444', padding: '2px 4px',
                          }}>✕</button>
                        </div>
                      )}
                    </div>
                    <p style={{ fontSize: '0.7rem', color: '#888', marginTop: '2px' }}>{p.variables.length} variables</p>
                  </div>
                ))}
              </div>
            ))}
            {plantillas.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#888', fontSize: '0.875rem' }}>
                No hay plantillas. {usuario.rol === 'admin' && 'Creá una.'}
              </div>
            )}
          </div>

          {/* Generador */}
          {plantillaActiva && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {/* Formulario de variables */}
              <div style={{ backgroundColor: '#fff', border: '1.5px solid #e8e8e8', borderRadius: '14px', padding: '1.5rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '1.25rem' }}>
                  Completá los campos
                </h3>
                {plantillaActiva.variables.map(v => (
                  <Campo key={v.key} label={v.label}>
                    <input
                      value={valores[v.key] || ''}
                      onChange={e => setValores(prev => ({ ...prev, [v.key]: e.target.value }))}
                      placeholder={`Ingresá ${v.label.toLowerCase()}...`}
                      style={inputStyle}
                    />
                  </Campo>
                ))}
                <Campo label="Nombre del copy (para historial)">
                  <input value={nombreCopy} onChange={e => setNombreCopy(e.target.value)}
                    placeholder="Ej: WhatsApp Dr. García — Junio"
                    style={inputStyle} />
                </Campo>
              </div>

              {/* Preview */}
              <div style={{ backgroundColor: '#fff', border: '1.5px solid #e8e8e8', borderRadius: '14px', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '1rem' }}>
                  Preview
                </h3>
                <div style={{
                  flex: 1, backgroundColor: '#f9fafb', borderRadius: '10px', padding: '1rem',
                  fontSize: '0.85rem', color: '#333', lineHeight: 1.7, whiteSpace: 'pre-wrap',
                  overflowY: 'auto', minHeight: 200, marginBottom: '1rem',
                }}>
                  {textoGenerado || <span style={{ color: '#a0a0a0' }}>El texto aparece acá mientras completás los campos...</span>}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={copiarTexto} style={{
                    flex: 1, padding: '0.625rem', border: '1.5px solid #e8e8e8',
                    borderRadius: '8px', backgroundColor: copiado ? '#f0fdf4' : '#fff',
                    color: copiado ? '#10b981' : '#555', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
                  }}>
                    {copiado ? '✅ Copiado' : '📋 Copiar'}
                  </button>
                  <button onClick={guardarCopy} style={{
                    flex: 1, padding: '0.625rem', border: 'none',
                    borderRadius: '8px', backgroundColor: '#f15922', color: '#fff',
                    cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
                  }}>
                    💾 Guardar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VISTA HISTORIAL */}
      {vista === 'historial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {historial.length === 0 && (
            <div style={{ textAlign: 'center', padding: '4rem', color: '#888' }}>
              <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🕐</p>
              <p style={{ fontWeight: 600 }}>No hay copys guardados todavía</p>
            </div>
          )}
          {historial.map(c => (
            <div key={c.id} style={{ backgroundColor: '#fff', border: '1.5px solid #e8e8e8', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <p style={{ fontWeight: 600, color: '#1a1a1a', fontSize: '0.9rem' }}>{c.nombre}</p>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: '#888' }}>
                    {new Date(c.creado_en).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <button onClick={() => navigator.clipboard.writeText(c.contenido_final)} style={{
                    padding: '0.25rem 0.625rem', border: '1.5px solid #e8e8e8',
                    borderRadius: '6px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.75rem', color: '#555',
                  }}>Copiar</button>
                </div>
              </div>
              <div style={{
                backgroundColor: '#f9fafb', borderRadius: '8px', padding: '0.875rem',
                fontSize: '0.8rem', color: '#444', lineHeight: 1.6, whiteSpace: 'pre-wrap',
                maxHeight: 120, overflowY: 'auto',
              }}>
                {c.contenido_final}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal gestión de plantillas (admin) */}
      {modalPlantilla && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem',
        }} onClick={e => { if (e.target === e.currentTarget) setModalPlantilla(false) }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: '16px', padding: '2rem',
            width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem' }}>
              {editandoPlantilla ? 'Editar plantilla' : 'Nueva plantilla'}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Campo label="Nombre *">
                <input value={formPlantilla.nombre} onChange={e => setFormPlantilla(f => ({ ...f, nombre: e.target.value }))} style={inputStyle} />
              </Campo>
              <Campo label="Categoría">
                <select value={formPlantilla.categoria} onChange={e => setFormPlantilla(f => ({ ...f, categoria: e.target.value }))} style={inputStyle}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Campo>
            </div>
            <Campo label="Contenido (usá {{variable}} para marcar campos)">
              <textarea value={formPlantilla.contenido} onChange={e => setFormPlantilla(f => ({ ...f, contenido: e.target.value }))}
                rows={10} placeholder="Pegá el texto acá y marcá las variables con {{nombre_variable}}"
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem' }} />
            </Campo>
            <Campo label="Variables (una por línea, formato: clave:Etiqueta)">
              <textarea value={formPlantilla.variablesRaw} onChange={e => setFormPlantilla(f => ({ ...f, variablesRaw: e.target.value }))}
                rows={6} placeholder={"dictante:Dictante/s\nfecha_curso:Fecha del curso\nprecio_1:1° precio (USD)"}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem' }} />
            </Campo>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setModalPlantilla(false)} style={{
                flex: 1, padding: '0.625rem', border: '1.5px solid #e8e8e8',
                borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.875rem', color: '#555',
              }}>Cancelar</button>
              <button onClick={guardarPlantilla} style={{
                flex: 2, padding: '0.625rem', border: 'none',
                borderRadius: '8px', backgroundColor: '#f15922', color: '#fff',
                cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
              }}>{editandoPlantilla ? 'Guardar cambios' : 'Crear plantilla'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
