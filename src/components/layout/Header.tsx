import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'

export function Header({ title, backTo, action }: { title: string; backTo?: string; action?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <header className="flex min-h-16 items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
      <div className="flex min-w-0 items-center gap-3">
        {backTo ? <Button aria-label="Voltar" size="icon" variant="ghost" onClick={() => navigate(backTo)}><ArrowLeft size={21} /></Button> : null}
        <p className="truncate text-lg font-extrabold tracking-tight">{title}</p>
      </div>
      {action}
    </header>
  )
}
