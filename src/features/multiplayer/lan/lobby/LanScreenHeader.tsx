import { ArrowLeft } from 'lucide-react'

export function LanScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return <header className="pl03-header">
    <button type="button" className="pl03-back" aria-label="Voltar para Minha Galera" onClick={onBack}>
      <ArrowLeft size={23} aria-hidden="true" />
    </button>
    <h1>{title}</h1>
  </header>
}
