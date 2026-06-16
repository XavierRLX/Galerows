import { ExternalLink, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card } from '../../components/ui/Card'

export function HubNativeAdCard() {
  const { t } = useTranslation('hub')

  return (
    <Card
      aria-label={t('nativeAd.ariaLabel')}
      className="relative min-h-36 overflow-hidden rounded-3xl border-emerald-300/20 bg-slate-950/70 p-0 shadow-2xl shadow-emerald-950/20 sm:col-span-2"
      role="complementary"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(16,185,129,0.22),transparent_26%),linear-gradient(135deg,rgba(2,6,23,0.98),rgba(15,23,42,0.92)_58%,rgba(6,78,59,0.58))]" />
      <div className="relative grid min-h-36 gap-4 p-4 sm:grid-cols-[1fr_180px] sm:items-center">
        <div className="flex items-start gap-3">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-emerald-300/25 bg-emerald-300/10 text-emerald-200 shadow-lg shadow-emerald-950/25">
            <Sparkles size={22} />
          </div>
          <div className="min-w-0">
            <div className="inline-flex rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-[0.16em] text-emerald-100">
              {t('nativeAd.badge')}
            </div>
            <h3 className="mt-3 text-xl font-black leading-tight text-white">
              {t('nativeAd.title')}
            </h3>
            <p className="mt-2 max-w-xl text-sm leading-5 text-slate-300">
              {t('nativeAd.description')}
            </p>
          </div>
        </div>

        <div className="flex h-20 items-center justify-between rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-slate-200 sm:h-24 sm:flex-col sm:items-start sm:justify-center">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            {t('nativeAd.sponsor')}
          </span>
          <span className="inline-flex items-center gap-2 text-sm font-black text-emerald-100">
            {t('nativeAd.cta')} <ExternalLink size={15} />
          </span>
        </div>
      </div>
    </Card>
  )
}
