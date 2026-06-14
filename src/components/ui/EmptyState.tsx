import type { ReactNode } from 'react'
import { Card } from './Card'

export function EmptyState({ icon, title, description }: { icon?: ReactNode; title: string; description: string }) {
  return <Card className="flex flex-col items-center p-8 text-center">{icon}<h2 className="mt-3 text-lg font-bold">{title}</h2><p className="mt-2 text-sm text-slate-400">{description}</p></Card>
}
