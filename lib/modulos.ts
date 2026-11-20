'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/** Secciones que se pueden prender/apagar desde /ADMIN. `ruta` es el tramo de URL de la sección. */
export const MODULOS: { clave: string; ruta: string; label: string; emoji: string }[] = [
  { clave: 'campanas', ruta: '/campanas', label: 'Campañas', emoji: '📣' },
  { clave: 'email', ruta: '/email', label: 'Email marketing', emoji: '✉️' },
  { clave: 'merch', ruta: '/merchandising', label: 'Merchandising', emoji: '🎁' },
  { clave: 'objetivos', ruta: '/objetivos', label: 'Objetivos', emoji: '🎯' },
  { clave: 'responsabilidades', ruta: '/responsabilidades', label: 'Responsabilidades', emoji: '🧭' },
  { clave: 'copys', ruta: '/copys', label: 'Copys', emoji: '✍️' },
  { clave: 'calendario', ruta: '/calendario', label: 'Calendario', emoji: '📅' },
  { clave: 'actividades', ruta: '/actividades', label: 'Actividades', emoji: '🗓️' },
  { clave: 'manuales', ruta: '/manuales', label: 'Manuales', emoji: '📚' },
  { clave: 'historial', ruta: '/historial', label: 'Historial', emoji: '🕐' },
  { clave: 'notas', ruta: '/notas', label: 'Mis notas', emoji: '📝' },
]

/** Estado por clave (si no hay fila, la sección está activa). `null` mientras carga. */
export function useModulos(): Record<string, boolean> | null {
  const [m, setM] = useState<Record<string, boolean> | null>(null)
  useEffect(() => {
    let vivo = true
    supabase.from('mkt_modulos').select('clave, activo').then(({ data }) => {
      if (!vivo) return
      const r: Record<string, boolean> = {}
      ;(data || []).forEach((x: any) => { r[x.clave] = x.activo })
      setM(r)
    })
    return () => { vivo = false }
  }, [])
  return m
}
export const moduloActivo = (m: Record<string, boolean> | null, clave: string) => !m || m[clave] !== false
