import { ChevronDown, Settings, Smartphone, Spade, Trophy, Users, Wifi } from 'lucide-react'
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
      <div className="hub-welcome">
        <div>
          <p className="hub-eyebrow">{t('welcome.eyebrow')}</p>
          <p className="hub-welcome-title">{t('welcome.title')}<br /><span>{t('welcome.accent')}</span></p>
        </div>
        <div className="hub-card-fan" aria-hidden="true"><span><Spade size={26} fill="currentColor" /></span><span><img src="/assets/brand/galerows-mark.svg" alt="" width="256" height="256" /></span></div>
      </div>
      <p className="hub-concept">{t('welcome.description')}</p>
      <nav className="hub-shortcuts" aria-label={t('shortcuts')}>
        <button type="button" onClick={() => navigate('/players')}><Users aria-hidden="true" size={17} />{t('myGroup')}</button>
        <button type="button" onClick={() => navigate('/players/ranking')}><Trophy aria-hidden="true" size={17} />{t('ranking')}</button>
      </nav>
      <details className="hub-mode-guide">
        <summary><span><Smartphone aria-hidden="true" size={16} />{t('modes.guide')}</span><ChevronDown aria-hidden="true" size={16} /></summary>
        <div className="hub-mode-guide-content">
          <div><Smartphone aria-hidden="true" size={19} /><p><strong>{t('modes.shared')}</strong>{t('modes.sharedDescription')}</p></div>
          <div><Users aria-hidden="true" size={19} /><p><strong>{t('modes.personal')}</strong>{t('modes.personalDescription')}</p></div>
          <div><Wifi aria-hidden="true" size={19} /><p><strong>{t('modes.lan')}</strong>{t('modes.lanDescription')}</p></div>
        </div>
      </details>
    </header>
  )
}
