'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

// This page has been consolidated into the Edit Client page under the Theme tab.
// Redirect users there automatically.
export default function ThemeRedirectPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  useEffect(() => {
    router.replace(`/super-admin/clients/${id}?tab=theme`)
  }, [id, router])

  return (
    <div className="text-gray-600 dark:text-[#9BB0BC] p-6 text-sm">Redirecting to theme editor…</div>
  )
}
