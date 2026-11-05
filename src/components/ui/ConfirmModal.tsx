'use client'

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
    <div className="modal-overlay">
      <div className="modal-panel max-w-sm w-full">
        <div className="modal-header">
          <span className="modal-title">{danger ? '⚠ Confirm Action' : 'Confirm'}</span>
        </div>
        <div className="modal-body">
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{message}</p>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className={danger ? 'btn-danger' : 'btn-primary'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
