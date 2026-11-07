'use client'

import { useEffect, useState } from 'react'
import { Usuario, Permisos, cargarPermisos } from '@/lib/tareas'

/** Usuario elegido (sessionStorage) + sus permisos según el rol */
export function useSesion() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [permisos, setPermisos] = useState<Permisos | null>(null)
  useEffect(() => {
    const stored = sessionStorage.getItem('mkt_usuario')
    if (!stored) return
    const u = JSON.parse(stored) as Usuario
    setUsuario(u)
    cargarPermisos(u.rol).then(setPermisos)
  }, [])
  return { usuario, permisos }
}
