import { X } from 'lucide-react'
import type { PropsWithChildren } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'

export function Modal({ open, title, onClose, children }: PropsWithChildren<{ open: boolean; title: string; onClose: () => void }>) {
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" role="presentation" onMouseDown={onClose}>
      <section aria-modal="true" className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 p-5 text-white shadow-2xl" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-xl font-extrabold">{title}</h2><Button aria-label="Fechar" size="icon" variant="ghost" onClick={onClose}><X size={20} /></Button></div>
        {children}
      </section>
    </div>, document.body,
  )
}
