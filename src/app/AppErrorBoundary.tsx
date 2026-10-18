import { AlertTriangle, ArrowLeft, Mail, RotateCcw, X } from 'lucide-react'
import { Component, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { getInstalledAppDetails, type InstalledAppDetails } from '../lib/capacitor/app'
import { createFeedbackMailto } from '../features/settings/feedback'

type Props = { children: ReactNode; pathname: string }
type State = { failed: boolean; attempts: number }

function isLanRoomRoute(pathname: string) {
  return pathname.startsWith('/__lan-')
}

function SafeFeedbackLink() {
  const { i18n, t } = useTranslation('common')
  const [details, setDetails] = useState<InstalledAppDetails>({ version: '—', build: null, platform: 'web' })
  useEffect(() => {
    let active = true
    void getInstalledAppDetails().then((result) => { if (active) setDetails(result) })
    return () => { active = false }
  }, [])
  return <a className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold" href={createFeedbackMailto(details, i18n.language)}>
    <Mail size={17} aria-hidden="true" />{t('errors.report')}
  </a>
}

function RenderErrorFallback({ onRetry, inRoom }: { onRetry: () => void; inRoom: boolean }) {
  const { t } = useTranslation('common')
  return <main className="flex min-h-dvh flex-col items-center justify-center bg-[#101014] px-6 py-10 text-center text-[#F5F3EF]" role="alert">
    <div className="rounded-3xl bg-[#B8A0FF]/15 p-5 text-[#B8A0FF]"><AlertTriangle size={36} aria-hidden="true" /></div>
    <h1 className="mt-6 text-2xl font-black">{t('errors.renderTitle')}</h1>
    <p className="mt-3 max-w-sm text-sm leading-6 text-slate-300">{t(inRoom ? 'errors.roomRecovery' : 'errors.renderDescription')}</p>
    <div className="mt-7 grid w-full max-w-sm gap-3">
      {!inRoom ? <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#D2F86A] px-4 font-bold text-[#101014]" onClick={onRetry} type="button">
        <RotateCcw size={18} aria-hidden="true" />{t('errors.retry')}
      </button> : null}
      <Link className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 px-4 text-sm font-bold" to="/">
        <ArrowLeft size={18} aria-hidden="true" />{t('errors.home')}
      </Link>
      <SafeFeedbackLink />
    </div>
  </main>
}

class RenderErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, attempts: 0 }

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true }
  }

  // No componentDidCatch logging: component stacks may include private session data.

  componentDidUpdate(previous: Props) {
    if (previous.pathname !== this.props.pathname && this.state.failed) {
      this.setState({ failed: false })
    }
  }

  retry = () => {
    if (isLanRoomRoute(this.props.pathname)) return
    this.setState((state) => ({ failed: false, attempts: state.attempts + 1 }))
  }

  render() {
    if (this.state.failed) {
      return <RenderErrorFallback inRoom={isLanRoomRoute(this.props.pathname)} onRetry={this.retry} />
    }
    return this.props.children
  }
}

/** Lives inside BrowserRouter; never resets local persistence or a room itself. */
export function GlobalErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <RenderErrorBoundary pathname={pathname}>{children}</RenderErrorBoundary>
}

/** Async rejections are not React render errors: offer guidance without retrying an action. */
export function AsyncErrorNotice() {
  const { pathname } = useLocation()
  const { t } = useTranslation('common')
  const [hasIssue, setHasIssue] = useState(false)

  useEffect(() => {
    const onRejection = (event: PromiseRejectionEvent) => {
      // Technical reasons can include secrets; keep them out of UI and browser reports.
      event.preventDefault()
      setHasIssue(true)
    }
    window.addEventListener('unhandledrejection', onRejection)
    return () => window.removeEventListener('unhandledrejection', onRejection)
  }, [])

  if (!hasIssue) return null
  return <aside className="fixed inset-x-3 bottom-4 z-50 mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-[#B8A0FF]/50 bg-[#25212D] p-4 text-[#F5F3EF] shadow-2xl" role="alert">
    <AlertTriangle className="mt-0.5 shrink-0 text-[#B8A0FF]" size={20} aria-hidden="true" />
    <p className="flex-1 text-sm leading-5">{t(isLanRoomRoute(pathname) ? 'errors.asyncLan' : 'errors.asyncGeneral')}</p>
    <button aria-label={t('errors.dismiss')} className="rounded-lg p-1" onClick={() => setHasIssue(false)} type="button">
      <X size={18} aria-hidden="true" />
    </button>
  </aside>
}
