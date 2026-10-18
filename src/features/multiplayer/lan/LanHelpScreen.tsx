import { ArrowLeft, LogOut, QrCode, RefreshCw, Smartphone, Users, Wifi, WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Header } from '../../../components/layout/Header'
import { Card } from '../../../components/ui/Card'
import { getLanConnectionHelpKey, type LanConnectionHelpState } from './lanHelp.model'

const topics = [
  { key: 'create', icon: Users },
  { key: 'join', icon: Wifi },
  { key: 'qr', icon: QrCode },
  { key: 'network', icon: Smartphone },
  { key: 'hotspot', icon: Wifi },
  { key: 'noRoom', icon: WifiOff },
  { key: 'reconnect', icon: RefreshCw },
  { key: 'leave', icon: LogOut },
] as const

export function LanHelpScreen() {
  const { t } = useTranslation('common')
  return <div className="min-h-dvh bg-[#101014] pb-10 text-[#F5F3EF]">
    <Header backTo="/settings" title={t('help.title')} />
    <main className="px-5 py-6">
      <h1 className="sr-only">{t('help.title')}</h1>
      <p className="mb-5 text-sm leading-6 text-slate-300">{t('help.intro')}</p>
      <div className="grid gap-3">
        {topics.map(({ key, icon: Icon }) => (
          <Card className="p-4" key={key}>
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-[#B8A0FF]/15 p-2 text-[#B8A0FF]">
                <Icon size={20} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-black">{t(`help.${key}Title`)}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-300">{t(`help.${key}Description`)}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Link className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 text-sm font-bold" to="/players">
        <ArrowLeft size={17} aria-hidden="true" />{t('help.goToGroup')}
      </Link>
    </main>
  </div>
}

export function LanConnectionHelpHint(state: LanConnectionHelpState) {
  const { t } = useTranslation('common')
  const key = getLanConnectionHelpKey(state)
  if (!key) return null
  return <p className="mt-3 rounded-xl border border-[#B8A0FF]/25 bg-[#B8A0FF]/10 p-3 text-sm leading-5 text-[#F5F3EF]" role="status">
    {t(key)}
  </p>
}
