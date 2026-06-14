import type { PropsWithChildren } from 'react'
import { cn } from '../../lib/utils/cn'

export function SafeArea({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cn('min-h-dvh', className)}>
      <div className="safe-area min-h-dvh">{children}</div>
    </div>
  )
}
