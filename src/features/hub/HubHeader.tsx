import { Settings, Sparkles, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { canDisplayAds } from '../ads/ads.visibility'

export function HubHeader() {
  const { t } = useTranslation('hub')
  const navigate = useNavigate()

  return (
    <section className="relative isolate pb-4">
      <div className="hub-header-panel relative overflow-hidden bg-[#180735] px-5 pb-8 pt-4 shadow-2xl shadow-violet-950/50 sm:px-6 sm:pb-9 sm:pt-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(139,92,246,0.5),transparent_28%),radial-gradient(circle_at_82%_16%,rgba(14,165,233,0.28),transparent_30%),linear-gradient(135deg,rgba(88,28,135,0.92),rgba(2,6,23,0.25)_58%)]" />
        <div className="absolute -right-16 top-14 size-60 rounded-full border border-cyan-300/20 bg-cyan-400/10 blur-sm" />
        <div className="absolute -bottom-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-fuchsia-500/20 blur-3xl" />

        <div className="relative flex items-center justify-between gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/40 bg-slate-950/70 shadow-lg shadow-fuchsia-500/20 ring-1 ring-white/10">
            <img
              alt="Galerows"
              className="size-full object-cover"
              height="48"
              src="/icon-galerows.webp"
              width="48"
            />
          </div>
          <div className="flex gap-2">
            {canDisplayAds() ? (
              <Button
                aria-label="Premium"
                className="rounded-full border-lime-300/20 bg-lime-300/15 text-lime-200 shadow-lg shadow-violet-950/30 backdrop-blur hover:bg-lime-300/25"
                size="icon"
                variant="secondary"
                onClick={() => navigate('/premium')}
              >
                <Sparkles size={19} />
              </Button>
            ) : null}
            <Button
              aria-label="Minha Galera"
              className="rounded-full border-white/10 bg-white/10 text-white shadow-lg shadow-violet-950/30 backdrop-blur hover:bg-white/15"
              size="icon"
              variant="secondary"
              onClick={() => navigate('/players')}
            >
              <Users size={19} />
            </Button>
            <Button
              aria-label={t('settings')}
              className="rounded-full border-white/10 bg-white/10 text-white shadow-lg shadow-violet-950/30 backdrop-blur hover:bg-white/15"
              size="icon"
              variant="secondary"
              onClick={() => navigate('/settings')}
            >
              <Settings size={19} />
            </Button>
          </div>
        </div>

        <div className="relative mt-6 max-w-xl">
          <h1 className="text-3xl font-black leading-none tracking-tight text-white sm:text-4xl">{t('brand')}</h1>
          <p className="mt-1.5 text-sm font-extrabold uppercase tracking-[0.16em] text-cyan-200/85 sm:text-[0.95rem]">{t('subtitle')}</p>
        </div>
      </div>
    </section>
  )
}
