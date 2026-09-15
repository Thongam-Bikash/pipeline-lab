import { useEffect, useRef, type ReactNode } from 'react'

type Props = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

// A native dialog, so Escape, focus trapping, and the backdrop come from the browser.
export function Dialog({ open, title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    // m-auto: the browser centres a modal dialog with margin auto, which the base styles reset to 0.
    <dialog ref={ref} onClose={onClose} className="m-auto rounded-base border border-rule bg-surface p-6 text-ink backdrop:bg-ink/40">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </dialog>
  )
}
