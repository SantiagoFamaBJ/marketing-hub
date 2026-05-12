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
}

export default function HomePage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchUsuarios()
  }, [])

  async function fetchUsuarios() {
  const { data, error } = await supabase
    .from('mkt_usuarios')
    .select('*')
    .eq('activo', true)
    .order('creado_en', { ascending: true })
  
  console.log('data:', data)
  console.log('error:', error)
  
  setUsuarios(data || [])
  setLoading(false)
}

  function handleSelect(usuario: Usuario) {
    // Guardamos el usuario en sessionStorage
    sessionStorage.setItem('mkt_usuario', JSON.stringify(usuario))
    router.push(`/${usuario.slug}`)
  }
console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 20))
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#fafafa',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
    }}>

      {/* Logo / Header */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '0.75rem',
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '10px',
            backgroundColor: '#f15922',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
          }}>
            🦷
          </div>
          <span style={{
            fontSize: '1.4rem',
            fontWeight: 700,
            color: '#1a1a1a',
            letterSpacing: '-0.02em',
          }}>
            Dental Medrano
          </span>
        </div>
        <p style={{
          fontSize: '0.95rem',
          color: '#666',
          fontWeight: 400,
        }}>
          Marketing Hub — ¿Quién sos?
        </p>
      </div>

      {/* Cards de usuarios */}
      {loading ? (
        <div style={{ color: '#a0a0a0', fontSize: '0.9rem' }}>Cargando...</div>
      ) : (
        <div style={{
          display: 'flex',
          gap: '1.5rem',
          flexWrap: 'wrap',
          justifyContent: 'center',
          maxWidth: '700px',
        }}>
          {usuarios.map((u, i) => (
            <button
              key={u.id}
              onClick={() => handleSelect(u)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.875rem',
                padding: '2rem 1.75rem',
                backgroundColor: '#ffffff',
                border: '1.5px solid #e8e8e8',
                borderRadius: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                minWidth: '140px',
                animation: `fadeIn 0.3s ease ${i * 0.07}s both`,
              }}
              onMouseEnter={e => {
                const el = e.currentTarget
                el.style.borderColor = '#f15922'
                el.style.transform = 'translateY(-4px)'
                el.style.boxShadow = '0 12px 32px rgba(241,89,34,0.12)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget
                el.style.borderColor = '#e8e8e8'
                el.style.transform = 'translateY(0)'
                el.style.boxShadow = 'none'
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                backgroundColor: u.avatar_color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                flexShrink: 0,
              }}>
                {u.avatar_emoji}
              </div>

              {/* Nombre */}
              <div style={{ textAlign: 'center' }}>
                <p style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: '#1a1a1a',
                  marginBottom: '0.25rem',
                }}>
                  {u.nombre}
                </p>
                {u.rol === 'admin' && (
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: '#f15922',
                    backgroundColor: '#f9ddd3',
                    padding: '2px 8px',
                    borderRadius: '99px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    Admin
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      <p style={{
        marginTop: '3rem',
        fontSize: '0.75rem',
        color: '#c0c0c0',
      }}>
        Marketing Hub · Dental Medrano © {new Date().getFullYear()}
      </p>
    </div>
  )
}
