'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Usuario = { id: string; nombre: string; slug: string; avatar_color: string; avatar_emoji: string; rol: string }
type Manual = { id: string; titulo: string; descripcion: string | null; categoria: string; tipo: string; url: string | null; nombre_archivo: string | null; orden: number }

const CATEGORIAS = ['Identidad visual', 'Procesos', 'Herramientas', 'General']
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

const TIPO_ICON: Record<string, string> = { link: '🔗', archivo: '📎', documento: '📄' }

export default function ManualesPage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [manuales, setManuales] = useState<Manual[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Manual | null>(null)
  const [loading, setLoading] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [form, setForm] = useState({ titulo: '', descripcion: '', categoria: 'General', tipo: 'link', url: '', nombre_archivo: '' })
  const [archivo, setArchivo] = useState<File | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('mkt_usuario')
    if (stored) { setUsuario(JSON.parse(stored)); fetchManuales() }
  }, [])

  async function fetchManuales() {
    const { data } = await supabase.from('mkt_manuales').select('*').eq('activo', true).order('orden')
    setManuales(data || [])
  }

  function abrirNuevo() {
    setEditando(null)
    setForm({ titulo: '', descripcion: '', categoria: 'General', tipo: 'link', url: '', nombre_archivo: '' })
    setArchivo(null)
    setModalOpen(true)
  }

  function abrirEditar(m: Manual) {
    setEditando(m)
    setForm({ titulo: m.titulo, descripcion: m.descripcion || '', categoria: m.categoria, tipo: m.tipo, url: m.url || '', nombre_archivo: m.nombre_archivo || '' })
    setModalOpen(true)
  }

  async function guardar() {
    if (!form.titulo.trim() || !usuario) return
    setLoading(true)

    let urlFinal = form.url
    let nombreArchivo = form.nombre_archivo

    // Si hay archivo, subirlo a Storage
    if (archivo && form.tipo === 'archivo') {
      setSubiendo(true)
      const ext = archivo.name.split('.').pop()
      const path = `${Date.now()}.${ext}`
      const { data: uploadData } = await supabase.storage.from('mkt-manuales').upload(path, archivo)
      if (uploadData) {
        const { data: urlData } = supabase.storage.from('mkt-manuales').getPublicUrl(path)
        urlFinal = urlData.publicUrl
        nombreArchivo = archivo.name
      }
      setSubiendo(false)
    }

    const payload = {
      titulo: form.titulo, descripcion: form.descripcion || null,
      categoria: form.categoria, tipo: form.tipo,
      url: urlFinal || null, nombre_archivo: nombreArchivo || null,
    }

    if (editando) {
      await supabase.from('mkt_manuales').update(payload).eq('id', editando.id)
    } else {
      await supabase.from('mkt_manuales').insert({ ...payload, subido_por: usuario.id, activo: true, orden: manuales.length })
    }

    await fetchManuales()
    setModalOpen(false)
    setLoading(false)
  }

  async function eliminar(m: Manual) {
    if (!confirm(`¿Eliminás "${m.titulo}"?`)) return
    await supabase.from('mkt_manuales').update({ activo: false }).eq('id', m.id)
    fetchManuales()
  }

  if (!usuario) return null

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1a1a1a' }}>📚 Manuales y Recursos</h1>
          <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '0.25rem' }}>Guías, instructivos y links del equipo</p>
        </div>
        {usuario.rol === 'admin' && (
          <button onClick={abrirNuevo} style={{
            backgroundColor: '#f15922', color: '#fff', border: 'none',
            borderRadius: '10px', padding: '0.625rem 1.25rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
          }}>+ Agregar recurso</button>
        )}
      </div>

      {CATEGORIAS.filter(cat => manuales.some(m => m.categoria === cat)).map(cat => (
        <div key={cat} style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#a0a0a0', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
            {cat}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
            {manuales.filter(m => m.categoria === cat).map(m => (
              <div key={m.id} style={{
                backgroundColor: '#fff', border: '1.5px solid #e8e8e8',
                borderRadius: '12px', padding: '1.1rem',
                transition: 'box-shadow 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>{TIPO_ICON[m.tipo]}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1a1a1a', marginBottom: '0.25rem' }}>{m.titulo}</p>
                    {m.descripcion && <p style={{ fontSize: '0.75rem', color: '#666', lineHeight: 1.4 }}>{m.descripcion}</p>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.75rem' }}>
                  {m.url && (
                    <a href={m.url} target="_blank" rel="noopener noreferrer" style={{
                      flex: 1, textAlign: 'center', padding: '0.375rem', border: '1.5px solid #f15922',
                      borderRadius: '7px', backgroundColor: '#f9ddd3', cursor: 'pointer',
                      fontSize: '0.775rem', color: '#f15922', fontWeight: 600, textDecoration: 'none',
                    }}>
                      {m.tipo === 'link' ? 'Abrir link' : 'Descargar'}
                    </a>
                  )}
                  {usuario.rol === 'admin' && (
                    <>
                      <button onClick={() => abrirEditar(m)} style={{
                        padding: '0.375rem 0.625rem', border: '1.5px solid #e8e8e8',
                        borderRadius: '7px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.775rem', color: '#555',
                      }}>Editar</button>
                      <button onClick={() => eliminar(m)} style={{
                        padding: '0.375rem 0.625rem', border: '1.5px solid #fecaca',
                        borderRadius: '7px', backgroundColor: '#fef2f2', cursor: 'pointer', fontSize: '0.775rem', color: '#ef4444',
                      }}>✕</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {manuales.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#888' }}>
          <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📚</p>
          <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>No hay recursos todavía</p>
          {usuario.rol === 'admin' && <p style={{ fontSize: '0.875rem' }}>Agregá links, documentos o archivos para el equipo.</p>}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem',
        }} onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div style={{
            backgroundColor: '#fff', borderRadius: '16px', padding: '2rem',
            width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem' }}>
              {editando ? 'Editar recurso' : 'Nuevo recurso'}
            </h2>
            <Campo label="Título *">
              <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} style={inputStyle} />
            </Campo>
            <Campo label="Descripción">
              <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </Campo>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Campo label="Categoría">
                <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} style={inputStyle}>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Campo>
              <Campo label="Tipo">
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} style={inputStyle}>
                  <option value="link">🔗 Link externo</option>
                  <option value="archivo">📎 Archivo</option>
                  <option value="documento">📄 Documento</option>
                </select>
              </Campo>
            </div>
            {form.tipo === 'link' || form.tipo === 'documento' ? (
              <Campo label="URL">
                <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." style={inputStyle} />
              </Campo>
            ) : (
              <Campo label="Archivo">
                <input type="file" onChange={e => setArchivo(e.target.files?.[0] || null)}
                  style={{ ...inputStyle, padding: '0.5rem' }} />
              </Campo>
            )}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setModalOpen(false)} style={{
                flex: 1, padding: '0.625rem', border: '1.5px solid #e8e8e8',
                borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.875rem', color: '#555',
              }}>Cancelar</button>
              <button onClick={guardar} disabled={loading || subiendo} style={{
                flex: 2, padding: '0.625rem', border: 'none',
                borderRadius: '8px', backgroundColor: '#f15922', color: '#fff',
                cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
              }}>{subiendo ? 'Subiendo...' : loading ? 'Guardando...' : editando ? 'Guardar cambios' : 'Agregar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
