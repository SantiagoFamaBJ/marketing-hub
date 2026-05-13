'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Usuario = {
  id: string
  nombre: string
  slug: string
  avatar_color: string
  avatar_emoji: string
  rol: string
  activo: boolean
}

const EMOJIS = ['😊', '🧡', '⭐', '🌟', '💪', '🎯', '🚀', '🌸', '🦋', '🎨', '📱', '💡', '🔥', '✨', '🌈']
const COLORES = ['#f15922', '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1']

const slugify = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

export default function AdminPage() {
  const [usuario, setUsuario] = useState<any>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nombre: '',
    slug: '',
    avatar_color: '#f15922',
    avatar_emoji: '😊',
    rol: 'marketing',
  })
  const router = useRouter()

  useEffect(() => {
    const stored = sessionStorage.getItem('mkt_usuario')
    if (!stored) { router.push('/'); return }
    const u = JSON.parse(stored)
    if (u.rol !== 'admin') { router.push(`/${u.slug}`); return }
    setUsuario(u)
    fetchUsuarios()
  }, [])

  async function fetchUsuarios() {
    const { data } = await supabase.from('mkt_usuarios').select('*').order('creado_en', { ascending: true })
    setUsuarios(data || [])
  }

  function abrirNuevo() {
    setEditando(null)
    setForm({ nombre: '', slug: '', avatar_color: '#f15922', avatar_emoji: '😊', rol: 'marketing' })
    setModalOpen(true)
  }

  function abrirEditar(u: Usuario) {
    setEditando(u)
    setForm({ nombre: u.nombre, slug: u.slug, avatar_color: u.avatar_color, avatar_emoji: u.avatar_emoji, rol: u.rol })
    setModalOpen(true)
  }

  async function guardar() {
    if (!form.nombre.trim()) return
    setLoading(true)

    if (editando) {
      await supabase.from('mkt_usuarios').update({
        nombre: form.nombre,
        slug: form.slug || slugify(form.nombre),
        avatar_color: form.avatar_color,
        avatar_emoji: form.avatar_emoji,
        rol: form.rol,
      }).eq('id', editando.id)
    } else {
      await supabase.from('mkt_usuarios').insert({
        nombre: form.nombre,
        slug: form.slug || slugify(form.nombre),
        avatar_color: form.avatar_color,
        avatar_emoji: form.avatar_emoji,
        rol: form.rol,
        activo: true,
      })
    }

    await fetchUsuarios()
    setModalOpen(false)
    setLoading(false)
  }

  async function toggleActivo(u: Usuario) {
    await supabase.from('mkt_usuarios').update({ activo: !u.activo }).eq('id', u.id)
    await fetchUsuarios()
  }

  async function eliminar(u: Usuario) {
    if (!confirm(`¿Eliminás a ${u.nombre}? Esta acción no se puede deshacer.`)) return
    await supabase.from('mkt_usuarios').delete().eq('id', u.id)
    await fetchUsuarios()
  }

  if (!usuario) return null

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1a1a1a' }}>⚙️ Administración</h1>
          <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '0.25rem' }}>Gestioná los usuarios del equipo</p>
        </div>
        <button onClick={abrirNuevo} style={{
          backgroundColor: '#f15922',
          color: '#fff',
          border: 'none',
          borderRadius: '10px',
          padding: '0.625rem 1.25rem',
          fontWeight: 600,
          fontSize: '0.875rem',
          cursor: 'pointer',
        }}>
          + Nuevo usuario
        </button>
      </div>

      {/* Lista de usuarios */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {usuarios.map(u => (
          <div key={u.id} style={{
            backgroundColor: '#fff',
            border: '1.5px solid #e8e8e8',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            opacity: u.activo ? 1 : 0.5,
          }}>
            {/* Avatar */}
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              backgroundColor: u.avatar_color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              flexShrink: 0,
            }}>
              {u.avatar_emoji}
            </div>

            {/* Info */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <p style={{ fontWeight: 600, color: '#1a1a1a', fontSize: '0.9rem' }}>{u.nombre}</p>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  color: u.rol === 'admin' ? '#f15922' : '#3b82f6',
                  backgroundColor: u.rol === 'admin' ? '#f9ddd3' : '#eff6ff',
                  padding: '2px 8px',
                  borderRadius: '99px',
                  textTransform: 'uppercase',
                }}>
                  {u.rol}
                </span>
                {!u.activo && (
                  <span style={{ fontSize: '0.65rem', color: '#888', backgroundColor: '#f4f4f4', padding: '2px 8px', borderRadius: '99px' }}>
                    inactivo
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.75rem', color: '#a0a0a0', marginTop: '2px' }}>/{u.slug}</p>
            </div>

            {/* Acciones */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => abrirEditar(u)} style={{
                background: '#f4f4f4', border: 'none', borderRadius: '8px',
                padding: '0.375rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', color: '#444',
              }}>
                Editar
              </button>
              <button onClick={() => toggleActivo(u)} style={{
                background: u.activo ? '#fffbeb' : '#f0fdf4', border: 'none', borderRadius: '8px',
                padding: '0.375rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem',
                color: u.activo ? '#f59e0b' : '#10b981',
              }}>
                {u.activo ? 'Desactivar' : 'Activar'}
              </button>
              {u.slug !== 'admin' && (
                <button onClick={() => eliminar(u)} style={{
                  background: '#fef2f2', border: 'none', borderRadius: '8px',
                  padding: '0.375rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem', color: '#ef4444',
                }}>
                  Eliminar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal crear/editar */}
      {modalOpen && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div style={{
            backgroundColor: '#fff', borderRadius: '16px', padding: '2rem',
            width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem', color: '#1a1a1a' }}>
              {editando ? 'Editar usuario' : 'Nuevo usuario'}
            </h2>

            {/* Preview avatar */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                backgroundColor: form.avatar_color,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem',
              }}>
                {form.avatar_emoji}
              </div>
            </div>

            {/* Nombre */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '0.375rem' }}>
                Nombre
              </label>
              <input
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value, slug: slugify(e.target.value) }))}
                placeholder="Ej: Julieta García"
                style={{
                  width: '100%', padding: '0.625rem 0.875rem',
                  border: '1.5px solid #e8e8e8', borderRadius: '8px',
                  fontSize: '0.875rem', outline: 'none', color: '#1a1a1a',
                }}
              />
            </div>

            {/* Slug */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '0.375rem' }}>
                URL del perfil
              </label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #e8e8e8', borderRadius: '8px', overflow: 'hidden' }}>
                <span style={{ padding: '0.625rem 0.75rem', backgroundColor: '#f4f4f4', color: '#888', fontSize: '0.8rem', borderRight: '1px solid #e8e8e8' }}>
                  /
                </span>
                <input
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                  style={{ flex: 1, padding: '0.625rem 0.75rem', border: 'none', fontSize: '0.875rem', outline: 'none', color: '#1a1a1a' }}
                />
              </div>
            </div>

            {/* Rol */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '0.375rem' }}>
                Rol
              </label>
              <select
                value={form.rol}
                onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}
                style={{
                  width: '100%', padding: '0.625rem 0.875rem',
                  border: '1.5px solid #e8e8e8', borderRadius: '8px',
                  fontSize: '0.875rem', outline: 'none', color: '#1a1a1a', backgroundColor: '#fff',
                }}
              >
                <option value="marketing">Marketing</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* Emoji */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '0.375rem' }}>
                Emoji
              </label>
              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => setForm(f => ({ ...f, avatar_emoji: e }))} style={{
                    width: 36, height: 36, borderRadius: '8px', fontSize: '1.1rem',
                    border: form.avatar_emoji === e ? '2px solid #f15922' : '1.5px solid #e8e8e8',
                    backgroundColor: form.avatar_emoji === e ? '#f9ddd3' : '#fff',
                    cursor: 'pointer',
                  }}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', display: 'block', marginBottom: '0.375rem' }}>
                Color del avatar
              </label>
              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                {COLORES.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, avatar_color: c }))} style={{
                    width: 28, height: 28, borderRadius: '50%', backgroundColor: c,
                    border: form.avatar_color === c ? '3px solid #1a1a1a' : '2px solid transparent',
                    cursor: 'pointer',
                  }} />
                ))}
              </div>
            </div>

            {/* Botones */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setModalOpen(false)} style={{
                flex: 1, padding: '0.625rem', border: '1.5px solid #e8e8e8',
                borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer',
                fontSize: '0.875rem', color: '#555',
              }}>
                Cancelar
              </button>
              <button onClick={guardar} disabled={loading} style={{
                flex: 2, padding: '0.625rem', border: 'none',
                borderRadius: '8px', backgroundColor: '#f15922', color: '#fff',
                cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
              }}>
                {loading ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
