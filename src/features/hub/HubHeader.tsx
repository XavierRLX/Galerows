import { ArrowUpRight, Settings, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'

export function HubHeader() {
  const { t } = useTranslation('hub')
  const navigate = useNavigate()
  return (
    <header className="hub-header">
      <div className="hub-brand-row">
        <h1 aria-label="Galerows — Jogos da Galera">
          <img alt="" aria-hidden="true" height="178" width="530" src="/assets/brand/galerows-wordmark.svg" />
        </h1>
        <Button aria-label={t('settings')} className="hub-settings" size="icon" variant="ghost" onClick={() => navigate('/settings')}>
          <Settings aria-hidden="true" size={21} />
        </Button>
      </div>

      <nav className="hub-shortcuts" aria-label={t('shortcuts')}>
        <button
          type="button"
          className="hub-group-card"
          aria-label={t('myGroup')}
          aria-describedby="hub-group-hint"
          onClick={() => navigate('/players')}
        >
          <span className="hub-group-icon" aria-hidden="true">
            <UsersRound size={29} strokeWidth={2.3} />
            <span className="hub-group-sparkle">✦</span>
          </span>
          <span className="hub-group-copy">
            <strong>{t('myGroup')}</strong>
            <span id="hub-group-hint">{t('groupLobbyHint')}</span>
          </span>
          <span className="hub-group-arrow" aria-hidden="true"><ArrowUpRight size={19} strokeWidth={2.6} /></span>
        </button>
      </nav>
    </header>
  )
}
