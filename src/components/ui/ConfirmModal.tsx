'use client'

/**
 * Drop-in replacement for browser confirm().
 *
 * Usage:
 *   const [confirm, setConfirm] = useState<ConfirmState>(null)
 *
 *   // trigger:
 *   setConfirm({ message: 'Delete this?', onConfirm: () => doDelete(id) })
 *
 *   // render (anywhere in the JSX):
 *   <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
 */

export type ConfirmState = {
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
} | null

export default function ConfirmModal({
  state,
  onClose,
}: {
  state: ConfirmState
  onClose: () => void
}) {
  if (!state) return null

  const { message, confirmLabel = 'Confirm', danger = true, onConfirm } = state

  function handleConfirm() {
    onConfirm()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="card-premium w-full max-w-sm shadow-2xl p-6 space-y-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
              danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#0E3D52] hover:bg-indigo-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
