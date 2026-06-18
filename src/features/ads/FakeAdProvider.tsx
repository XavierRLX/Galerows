import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { usePremiumStore } from '../premium/premium.store'
import { FakeAdContext, type FakeAdPlacement } from './FakeAdContext'
import { canDisplayAds } from './ads.visibility'

type FakeAdRequest = {
  placement: FakeAdPlacement
  resolve: () => void
}

const fakeAdDurationSeconds = 5

export function FakeAdProvider({ children }: PropsWithChildren) {
  const isPremium = usePremiumStore((state) => state.isPremium)
  const [request, setRequest] = useState<FakeAdRequest | null>(null)
  const [remaining, setRemaining] = useState(fakeAdDurationSeconds)
  const activePromise = useRef<Promise<void> | null>(null)

  const showFakeAd = useCallback((options?: { placement?: FakeAdPlacement }) => {
    if (!canDisplayAds()) return Promise.resolve()
    if (isPremium) return Promise.resolve()
    if (activePromise.current) return activePromise.current
    const promise = new Promise<void>((resolve) => {
      setRemaining(fakeAdDurationSeconds)
      setRequest({ placement: options?.placement ?? 'start-match', resolve })
    }).finally(() => {
      activePromise.current = null
    })
    activePromise.current = promise
    return promise
  }, [isPremium])

  useEffect(() => {
    if (!request) return
    const interval = window.setInterval(() => {
      setRemaining((current) => Math.max(0, current - 1))
    }, 1000)
    const timeout = window.setTimeout(() => {
      request.resolve()
      setRequest(null)
    }, fakeAdDurationSeconds * 1000)
    return () => {
      window.clearInterval(interval)
      window.clearTimeout(timeout)
    }
  }, [request])

  const value = useMemo(() => ({ showFakeAd }), [showFakeAd])
  const message = request?.placement === 'hub-play' ? 'Abrindo jogo em' : 'A partida começa em'

  return (
    <FakeAdContext.Provider value={value}>
      {children}
      {request ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/95 px-5 text-white" role="dialog" aria-modal="true" aria-labelledby="fake-ad-title">
          <section className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/40">
            <div className="border-b border-white/10 px-5 py-4">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-lime-300">Anúncio</p>
              <h2 id="fake-ad-title" className="mt-1 text-xl font-black">Espaço reservado para anúncio</h2>
            </div>
            <div className="flex aspect-video items-center justify-center bg-[radial-gradient(circle_at_30%_25%,rgba(163,230,53,0.18),transparent_32%),linear-gradient(135deg,rgba(15,23,42,1),rgba(30,41,59,1))] p-6 text-center">
              <div>
                <p className="text-5xl font-black text-lime-300">{remaining}</p>
                <p className="mt-3 text-sm font-bold text-slate-300">{message} {remaining}s</p>
              </div>
            </div>
            <div className="px-5 py-4">
              <button className="min-h-12 w-full rounded-2xl bg-white/10 px-4 text-sm font-black text-slate-300" disabled type="button">
                Continuando em {remaining}s
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </FakeAdContext.Provider>
  )
}
