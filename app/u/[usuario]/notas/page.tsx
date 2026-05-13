'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

type Usuario = { id: string; nombre: string; slug: string; avatar_color: string; avatar_emoji: string; rol: string }

export default function NotasPage() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [contenido, setContenido] = useState('')
  const [guardado, setGuardado] = useState(true)
  const [ultimoGuardado, setUltimoGuardado] = useState<Date | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('mkt_usuario')
    if (stored) {
      const u = JSON.parse(stored)
      setUsuario(u)
      fetchNota(u.id)
    }
  }, [])

  async function fetchNota(userId: string) {
    const { data } = await supabase.from('mkt_notas').select('*').eq('usuario_id', userId).single()
    if (data) {
      setContenido(data.contenido || '')
      setUltimoGuardado(new Date(data.actualizado_en))
    }
  }

  async function guardarNota(texto: string, userId: string) {
    const { data: existing } = await supabase.from('mkt_notas').select('id').eq('usuario_id', userId).single()
    if (existing) {
      await supabase.from('mkt_notas').update({ contenido: texto, actualizado_en: new Date().toISOString() }).eq('usuario_id', userId)
    } else {
      await supabase.from('mkt_notas').insert({ usuario_id: userId, contenido: texto })
    }
    setGuardado(true)
    setUltimoGuardado(new Date())
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const texto = e.target.value
    setContenido(texto)
    setGuardado(false)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (usuario) guardarNota(texto, usuario.id)
    }, 1500)
  }

  if (!usuario) return null

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', height: 'calc(100vh - 4rem)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1a1a1a' }}>📝 Mis notas</h1>
          <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '0.25rem' }}>Solo vos podés ver esto</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: guardado ? '#10b981' : '#f59e0b',
          }} />
          <span style={{ fontSize: '0.75rem', color: '#888' }}>
            {guardado
              ? ultimoGuardado
                ? `Guardado ${ultimoGuardado.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
                : 'Guardado'
              : 'Guardando...'}
          </span>
        </div>
      </div>

      <textarea
        value={contenido}
        onChange={handleChange}
        placeholder="Escribí acá tus ideas, pendientes, notas rápidas...&#10;&#10;Solo vos podés ver este espacio. Se guarda automáticamente."
        style={{
          flex: 1,
          width: '100%',
          padding: '1.5rem',
          border: '1.5px solid #e8e8e8',
          borderRadius: '14px',
          fontSize: '0.95rem',
          lineHeight: 1.75,
          color: '#1a1a1a',
          backgroundColor: '#fff',
          outline: 'none',
          resize: 'none',
          fontFamily: 'inherit',
        }}
        onFocus={e => e.target.style.borderColor = '#f15922'}
        onBlur={e => e.target.style.borderColor = '#e8e8e8'}
      />
    </div>
  )
}
