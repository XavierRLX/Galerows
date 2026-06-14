import type { PropsWithChildren } from 'react'
import { cn } from '../../lib/utils/cn'

export function SafeArea({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn('safe-area min-h-dvh', className)}>{children}</div>
}
