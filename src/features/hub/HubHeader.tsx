import { Settings, Trophy, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'

const iconAction = 'shrink-0 border-0 bg-transparent shadow-none hover:bg-transparent active:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#D2F86A]'

export function HubHeader() {
  const { t } = useTranslation('hub')
  const navigate = useNavigate()

  return (
    <section className="relative isolate pb-2">
      <div className="hub-header-panel relative overflow-hidden border-b border-[#B8A0FF]/20 bg-[#1b1129] px-4 py-4 shadow-xl shadow-violet-950/30 sm:px-6 sm:py-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_30%,rgba(184,160,255,0.22),transparent_58%),linear-gradient(110deg,#1b1129,#261b38_65%,#1a122b)]"
        />
        <img
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -right-5 -top-16 w-56 rotate-[-11deg] opacity-50 sm:-right-8 sm:-top-24 sm:w-72"
          height="256"
          src="/assets/brand/galerows-mark.svg"
          width="256"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#1b1129]/95 via-[#1b1129]/55 to-[#1b1129]/15"
        />

        <h1 className="relative flex min-h-12 items-center" aria-label="Galerows — Jogos da Galera">
          <img
            alt=""
            aria-hidden="true"
            className="block h-auto w-[clamp(8.2rem,41vw,12.2rem)] max-w-full drop-shadow-[0_1px_12px_rgba(0,0,0,0.8)]"
            height="178"
            src="/assets/brand/galerows-wordmark.svg"
            width="530"
          />
        </h1>
      </div>

      <nav aria-label="Atalhos do Galerows" className="flex w-full items-center justify-between px-4 pt-1 sm:px-6">
        <div>
          <Button
            aria-label="Minha Galera"
            className={`${iconAction} text-[#B8A0FF]`}
            size="icon"
            variant="ghost"
            onClick={() => navigate('/players')}
          >
            <Users aria-hidden="true" fill="currentColor" size={25} strokeWidth={1.7} />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            aria-label="Ranking da Galera"
            className={`${iconAction} text-[#D2F86A]`}
            size="icon"
            variant="ghost"
            onClick={() => navigate('/players/ranking')}
          >
            <Trophy aria-hidden="true" fill="currentColor" size={25} strokeWidth={1.7} />
          </Button>
          <Button
            aria-label={t('settings')}
            className={`${iconAction} text-[#FFA9B9]`}
            size="icon"
            variant="ghost"
            onClick={() => navigate('/settings')}
          >
            <Settings aria-hidden="true" className="[&_circle]:fill-[#080a18] [&_circle]:stroke-[#080a18]" fill="currentColor" size={25} strokeWidth={1.7} />
          </Button>
        </div>
      </nav>
    </section>
  )
}
