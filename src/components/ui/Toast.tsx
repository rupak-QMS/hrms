'use client'

/**
 * Auto-dismissing toast notification.
 *
 * Usage:
 *   const [toast, setToast] = useState<ToastState>(null)
 *
 *   // trigger (success):
 *   setToast({ message: 'Saved successfully', type: 'success' })
 *
 *   // trigger (error):
 *   setToast({ message: 'Something went wrong', type: 'error' })
 *
 *   // render (anywhere in JSX):
 *   <Toast state={toast} onClose={() => setToast(null)} />
 */

import { useEffect } from 'react'

export type ToastState = {
  message: string
  type?: 'success' | 'error' | 'info'
  duration?: number
} | null

export default function Toast({
  state,
  onClose,
}: {
  state: ToastState
  onClose: () => void
}) {
  useEffect(() => {
    if (!state) return
    const t = setTimeout(onClose, state.duration ?? 3500)
    return () => clearTimeout(t)
  }, [state, onClose])

  if (!state) return null

  const { message, type = 'info' } = state

  const styles = {
    success: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700',
      icon: '✓',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      text: 'text-emerald-800 dark:text-emerald-200',
    },
    error: {
      bg: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700',
      icon: '✕',
      iconColor: 'text-red-600 dark:text-red-400',
      text: 'text-red-800 dark:text-red-200',
    },
    info: {
      bg: 'bg-[#E0EEF4] dark:bg-[#0E3D52]/20 border-[#b8d4e0] dark:border-[#1A6080]',
      icon: 'ℹ',
      iconColor: 'text-[#0E3D52] dark:text-[#4ebac4]',
      text: 'text-[#0E3D52] dark:text-[#9ccfda]',
    },
  }[type]

  return (
    <div className="fixed bottom-6 right-6 z-[70] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm ${styles.bg}`}>
        <span className={`text-sm font-bold flex-shrink-0 ${styles.iconColor}`}>{styles.icon}</span>
        <p className={`text-sm font-medium ${styles.text}`}>{message}</p>
        <button
          onClick={onClose}
          className={`ml-2 flex-shrink-0 text-xs opacity-60 hover:opacity-100 transition-opacity ${styles.text}`}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
