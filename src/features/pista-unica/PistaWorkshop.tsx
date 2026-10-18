import { Capacitor } from '@capacitor/core'
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, DoorOpen, EyeOff, Layers, LockKeyhole, Sparkles } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { PistaUnicaCategory } from './pistaUnica.types'
import './pistaWorkshop.css'

export function PistaWorkshop({ children, mode, round, total, stage, onBack, onExit, footer }: {
  children: ReactNode; mode: string; round?: number; total?: number; stage?: number
  onBack?: () => void; onExit?: () => void; footer?: ReactNode
}) {
  return <main className={Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
    ? 'pista-workshop pista-workshop--android' : 'pista-workshop'}>
    <div className="pw-shell">
      <header className="pw-header">
        {onBack ? <button className="pw-back" type="button" onClick={onBack} aria-label="Voltar"><ArrowLeft size={20} /></button> : <Layers className="pw-brand-mark" size={24} aria-hidden="true" />}
        <div><span className="pw-brand">PISTA ÚNICA</span><span className="pw-edition">OFICINA DAS PISTAS</span></div>
        <span className="pw-mode">{mode}{round != null && <b>{String(round).padStart(2, '0')} <small>/ {String(total).padStart(2, '0')}</small></b>}</span>
        {onExit && <button className="pw-back" type="button" onClick={onExit} aria-label="Opções de saída"><DoorOpen size={18} /></button>}
      </header>
      {stage != null && <ol className="pw-stages" aria-label="Etapas da rodada">
        {['Criar', 'Revisar', 'Adivinhar', 'Revelar'].map((name, i) => <li key={name} aria-current={stage === i ? 'step' : undefined} className={i < stage ? 'is-done' : ''}><span>{i < stage ? <Check size={10} /> : `0${i + 1}`}</span>{name}</li>)}
      </ol>}
      <div className="pw-content">{children}</div>
      {footer && <footer className="pw-footer">{footer}</footer>}
    </div>
  </main>
}

export function RoundCategoryBadge({ category }: { category: PistaUnicaCategory }) {
  const { t } = useTranslation('pista-unica')
  return <p className="pw-round-category">TEMA DA RODADA · {t(`categories.${category}.name`).toLocaleUpperCase('pt-BR')}</p>
}

export function WorkshopHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <div className="pw-heading"><p className="pw-eyebrow">{eyebrow}</p><h1>{title}</h1>{children && <div className="pw-description">{children}</div>}</div>
}

export function PaperCard({ children, label, tone = 'cream', stamp, className = '' }: {
  children: ReactNode; label: string; tone?: 'cream' | 'lime' | 'lavender' | 'muted'; stamp?: ReactNode; className?: string
}) {
  return <article className={`pw-paper pw-paper--${tone} ${className}`} aria-label={label}>
    <div className="pw-paper-top"><span>{label}</span><Sparkles size={15} aria-hidden="true" /></div>
    <div className="pw-paper-word">{children}</div>
    {stamp && <div className="pw-stamp">{stamp}</div>}
    <div className="pw-paper-bottom" aria-hidden="true"><span>PU / OFICINA</span><span>✦</span></div>
  </article>
}

export function SealedCard({ name, children }: { name: string; children?: ReactNode }) {
  return <div className="pw-sealed"><div className="pw-sealed-inner"><LockKeyhole size={24} aria-hidden="true" /><span className="pw-sealed-symbol" aria-hidden="true">?</span><strong>{name}</strong>{children && <p>{children}</p>}<EyeOff size={17} aria-hidden="true" /></div></div>
}

/** Pages remain presentational; edits and submitted values belong to the caller. */
export function CardDeck({ children, label, pageSize = 1 }: { children: ReactNode[]; label: string; pageSize?: number }) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(children.length / pageSize))
  const current = Math.min(page, pages - 1)
  return <div className="pw-deck">
    <div className="pw-deck-cards" key={current}>{children.slice(current * pageSize, (current + 1) * pageSize)}</div>
    {pages > 1 && <nav className="pw-pager" aria-label={label}>
      <button type="button" aria-label={`${label}: carta anterior`} disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft size={20} /></button>
      <span aria-live="polite">{current + 1} <span>/ {pages}</span></span>
      <button type="button" aria-label={`${label}: próxima carta`} disabled={current >= pages - 1} onClick={() => setPage(current + 1)}><ChevronRight size={20} /></button>
    </nav>}
  </div>
}

export function ClueProgress({ count, total }: { count: number; total: number }) {
  return <div className="pw-progress" role="progressbar" aria-label="Pistas recebidas" aria-valuemin={0} aria-valuemax={total} aria-valuenow={count}>
    <div><span>Pistas na mesa</span><b>{count}<span> / {total}</span></b></div>
    <div className="pw-progress-slots" aria-hidden="true">{Array.from({ length: total }, (_, i) => <span key={i} className={i < count ? 'is-filled' : ''} />)}</div>
  </div>
}

export function AwardReceipt({ awards, note }: { awards: { id: string; name: string; points: number; reason: string }[]; note?: string }) {
  return <section className="pw-receipt" aria-label="Pontuação da rodada"><h2>PONTOS DA RODADA</h2>
    {awards.length ? <CardDeck label="Prêmios" pageSize={2}>{awards.map(award => <div className="pw-award" key={award.id}><span><strong>{award.name}</strong><small>{award.reason}</small></span><b>+{award.points}</b></div>)}</CardDeck> : <p className="pw-zero">0 pontos nesta rodada</p>}
    {note && <p className="pw-note">{note}</p>}
  </section>
}

export function WorkshopConfirm({ title, description, confirm, onConfirm, onCancel, disabled }: {
  title: string; description: string; confirm: string; onConfirm: () => void; onCancel: () => void; disabled?: boolean
}) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => prior?.focus()
  }, [])
  return <div className="pw-modal-backdrop"><div ref={ref} className="pw-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={event => {
    if (event.key === 'Escape') onCancel()
    if (event.key === 'Tab') {
      const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
      const next = buttons[(buttons.indexOf(document.activeElement as HTMLButtonElement) + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]
      event.preventDefault(); next?.focus()
    }
  }}><LockKeyhole size={25} /><h2 id={titleId}>{title}</h2><p>{description}</p><button className="pw-button pw-button--secondary" type="button" onClick={onCancel}>Continuar aqui</button><button className="pw-button" type="button" disabled={disabled} onClick={onConfirm}>{confirm}<ArrowRight size={18} /></button></div></div>
}
