import { Gamepad2, Settings, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'

export function HubHeader() {
  const { t } = useTranslation('hub')
  const navigate = useNavigate()

  return (
    <section className="relative isolate pb-6">
      <div className="hub-header-panel relative overflow-hidden bg-[#180735] px-5 pb-12 pt-5 shadow-2xl shadow-violet-950/50 sm:px-6 sm:pb-14 sm:pt-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(139,92,246,0.5),transparent_28%),radial-gradient(circle_at_82%_16%,rgba(14,165,233,0.28),transparent_30%),linear-gradient(135deg,rgba(88,28,135,0.92),rgba(2,6,23,0.25)_58%)]" />
        <div className="absolute -right-16 top-14 size-60 rounded-full border border-cyan-300/20 bg-cyan-400/10 blur-sm" />
        <div className="absolute -bottom-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-fuchsia-500/20 blur-3xl" />

        <div className="relative flex items-center justify-between gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/40 bg-slate-950/70 text-cyan-300 shadow-lg shadow-fuchsia-500/20 ring-1 ring-white/10">
            <Gamepad2 size={24} />
          </div>
          <div className="flex gap-2">
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

        <div className="relative mt-9 max-w-xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-cyan-200/85">{t('brand')}</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white sm:text-5xl">{t('subtitle')}</h1>
          <p className="mt-3 text-sm leading-6 text-violet-100/80 sm:text-base sm:leading-7">{t('description')}</p>
        </div>
      </div>
    </section>
  )
}
