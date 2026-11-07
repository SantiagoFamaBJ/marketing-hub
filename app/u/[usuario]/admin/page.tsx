'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// La administración vive solo en /ADMIN (requiere sesión de coordinación + clave)
export default function AdminLegacy() {
  const router = useRouter()
  useEffect(() => { router.replace('/ADMIN') }, [router])
  return null
}
