import { Check, FileJson } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Header } from '../../components/layout/Header'
import { Card } from '../../components/ui/Card'
import { supportedLocales, type SupportedLocale } from '../../i18n'
import { cn } from '../../lib/utils/cn'
import { useSettingsStore } from './settings.store'
import { contentAdminEnabled } from '../content/contentAdmin'

const localeLabels: Record<SupportedLocale, string> = { 'pt-BR': 'Português (Brasil)', 'en-US': 'English (US)', 'es-419': 'Español (Latinoamérica)' }
export function SettingsScreen() {
  const { t } = useTranslation('common'); const { locale, setLocale } = useSettingsStore(); const navigate = useNavigate()
  return <div className="min-h-dvh"><Header backTo="/" title={t('settings.title')} /><section className="px-5 py-7"><h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">{t('settings.language')}</h2><Card className="mt-3 overflow-hidden">{supportedLocales.map((item) => <button className={cn('flex min-h-14 w-full items-center justify-between border-b border-white/10 px-4 text-left last:border-0', item === locale && 'bg-lime-400/10 text-lime-300')} key={item} onClick={() => void setLocale(item)} type="button"><span className="font-semibold">{localeLabels[item]}</span>{item === locale ? <Check size={19} /> : null}</button>)}</Card><p className="mt-5 text-sm leading-6 text-slate-400">{t('settings.offlineNote')}</p>{contentAdminEnabled ? <Button className="mt-6 w-full" variant="secondary" onClick={() => navigate('/admin/content')}><FileJson size={18} />Administrar conteúdo</Button> : null}</section></div>
}
