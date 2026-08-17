import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  confirmVariant?: 'primary' | 'danger'
  loading?: boolean
  loadingText?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Voltar',
  confirmVariant = 'danger',
  loading = false,
  loadingText = 'Processando...',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      labelledBy="confirm-dialog-title"
      initialFocus
      maxWidth="sm"
    >
      <h2 id="confirm-dialog-title" className="text-lg font-bold text-emerald-900 mb-2">
        {title}
      </h2>
      <p className="text-stone-600 text-sm leading-relaxed mb-6">{message}</p>
      <div className="flex flex-col-reverse sm:flex-row gap-3">
        <Button variant="ghost" size="lg" className="w-full sm:w-auto" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant={confirmVariant}
          size="lg"
          className="w-full flex-1"
          loading={loading}
          loadingText={loadingText}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
