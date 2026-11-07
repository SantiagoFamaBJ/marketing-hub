'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Los reportes ahora viven solo en /ADMIN
export default function ReportesRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/ADMIN') }, [router])
  return null
}
