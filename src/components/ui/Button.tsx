import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils/cn'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'md' | 'lg' | 'icon' }
const variants = { primary: 'bg-lime-400 text-slate-950 hover:bg-lime-300', secondary: 'border border-white/15 bg-white/10 text-white hover:bg-white/15', ghost: 'bg-transparent text-slate-200 hover:bg-white/10', danger: 'bg-rose-500 text-white hover:bg-rose-400' }
const sizes = { md: 'min-h-11 px-4 py-2.5 text-sm', lg: 'min-h-13 px-5 py-3 text-base', icon: 'size-11 p-0' }

export function Button({ className, variant = 'primary', size = 'md', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn('inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45', variants[variant], sizes[size], className)} {...props} />
}
