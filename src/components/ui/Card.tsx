import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-3xl border border-white/10 bg-white/[0.07] shadow-xl shadow-black/10', className)} {...props} />
}
