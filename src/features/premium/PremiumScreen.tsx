import { CheckCircle2, RefreshCcw, ShieldCheck, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { premiumConfig } from './premium.config'
import { usePremiumStore } from './premium.store'

export function PremiumScreen() {
  const { t } = useTranslation('common')
  const { availability, error, isPremium, loading, offering, purchasing, restoring, refreshPremiumStatus, purchasePremium, restorePremium, snapshot } = usePremiumStore()
  const priceLabel = offering?.priceLabel ?? premiumConfig.fallbackPriceLabel
  const busy = loading || purchasing || restoring

  return (
    <div className="min-h-dvh pb-10">
      <Header backTo="/" title={t('premium.title')} />
      <section className="px-5 py-7">
        <div className="rounded-3xl border border-lime-300/20 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(20,83,45,0.42))] p-5 shadow-2xl shadow-lime-950/20">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-lime-300/30 bg-lime-300/15 text-lime-200">
            <Sparkles size={24} />
          </div>
          <p className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-lime-200">{t('premium.badge')}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white">{isPremium ? t('premium.activeTitle') : t('premium.heroTitle')}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">{isPremium ? t('premium.activeDescription') : t('premium.heroDescription', { price: priceLabel })}</p>
        </div>

        <Card className="mt-5 p-5">
          <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-400">{t('premium.includesTitle')}</h2>
          <ul className="mt-4 space-y-3 text-sm font-semibold text-slate-200">
            <li className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-lime-300" size={18} />{t('premium.benefits.noAds')}</li>
            <li className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-lime-300" size={18} />{t('premium.benefits.allGames')}</li>
            <li className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-lime-300" size={18} />{t('premium.benefits.cancelAnytime')}</li>
          </ul>
        </Card>

        {error ? <p className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100">{t(error)}</p> : null}

        {isPremium ? (
          <div className="mt-5 grid gap-3">
            <Button className="w-full" disabled={busy} size="lg" variant="secondary" onClick={() => void refreshPremiumStatus()}>
              <RefreshCcw size={18} />{loading ? t('premium.actions.updating') : t('premium.actions.refresh')}
            </Button>
            {snapshot?.managementUrl ? (
              <Button className="w-full" size="lg" variant="ghost" onClick={() => window.open(snapshot.managementUrl ?? undefined, '_blank', 'noopener,noreferrer')}>
                <ShieldCheck size={18} />{t('premium.actions.manage')}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            <Button className="w-full" disabled={busy || availability === 'unavailable'} size="lg" onClick={() => void purchasePremium()}>
              <Sparkles size={18} />{purchasing ? t('premium.actions.purchasing') : t('premium.actions.subscribe', { price: priceLabel })}
            </Button>
            <Button className="w-full" disabled={busy} size="lg" variant="secondary" onClick={() => void restorePremium()}>
              <RefreshCcw size={18} />{restoring ? t('premium.actions.restoring') : t('premium.actions.restore')}
            </Button>
            {availability === 'unavailable' ? <p className="text-center text-xs font-semibold leading-5 text-slate-400">{t('premium.unavailable')}</p> : null}
          </div>
        )}

        <p className="mt-5 text-xs leading-5 text-slate-500">{t('premium.legal', { price: priceLabel })}</p>
      </section>
    </div>
  )
}
