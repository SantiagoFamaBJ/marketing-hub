'use client'

import { useSesion } from '@/lib/useSesion'

const URL_ACTIVIDADES = 'https://actividades.dentalmedrano.com/'

export default function ActividadesPage() {
  const { usuario } = useSesion()
  if (!usuario) return null
  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: 'clamp(1.25rem, 4vw, 1.6rem)', fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>🗓️ Actividades</h1>
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '1.5rem 1.25rem', marginTop: 14, textAlign: 'center' }}>
        <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Toda la info en</p>
        <a href={URL_ACTIVIDADES} target="_blank" rel="noopener noreferrer" style={{ color: '#f15922', fontWeight: 700, fontSize: '1rem', overflowWrap: 'anywhere' }}>actividades.dentalmedrano.com</a>
        <div style={{ marginTop: 16 }}>
          <a href={URL_ACTIVIDADES} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '0.7rem 1.4rem', borderRadius: 8, backgroundColor: '#f15922', color: '#fff', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none', minHeight: 44, lineHeight: '1.7' }}>Abrir actividades ↗</a>
        </div>
      </div>
    </div>
  )
}
