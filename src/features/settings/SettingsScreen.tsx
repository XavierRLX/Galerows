import { BookOpen, Check, FileJson, Info, Mail, ShieldCheck, Star, Wifi } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Header } from '../../components/layout/Header'
import { Card } from '../../components/ui/Card'
import { supportedLocales, type SupportedLocale } from '../../i18n'
import { cn } from '../../lib/utils/cn'
import { canUseNativeAndroidPlayStore, PlayStore } from '../../lib/capacitor/playStore'
import { getInstalledAppDetails, type InstalledAppDetails } from '../../lib/capacitor/app'
import { useSettingsStore } from './settings.store'
import { createFeedbackMailto } from './feedback'
import { contentAdminEnabled } from '../content/contentAdmin'

const localeLabels: Record<SupportedLocale, string> = {
  'pt-BR': 'Português (Brasil)',
  'en-US': 'English (US)',
  'es-419': 'Español (Latinoamérica)',
}

export function SettingsScreen() {
  const { t } = useTranslation('common')
  const { locale, setLocale } = useSettingsStore()
  const navigate = useNavigate()
  const [appDetails, setAppDetails] = useState<InstalledAppDetails | null>(null)

  useEffect(() => {
    let active = true
    void getInstalledAppDetails().then((details) => {
      if (active) setAppDetails(details)
    })
    return () => { active = false }
  }, [])

  const displayedDetails: InstalledAppDetails = appDetails ?? {
    version: '—',
    build: null,
    platform: 'web',
  }
  const platform = appDetails?.platform === 'android' ? 'Android'
    : appDetails?.platform === 'ios' ? 'iOS' : appDetails?.platform === 'web' ? 'Web' : '—'

  return (
    <div className="min-h-dvh bg-[#101014] text-[#F5F3EF]">
      <Header backTo="/" title={t('settings.title')} />
      <section className="px-5 py-7">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">{t('settings.language')}</h2>
        <Card className="mt-3 overflow-hidden">
          {supportedLocales.map((item) => (
            <button
              className={cn('flex min-h-14 w-full items-center justify-between border-b border-white/10 px-4 text-left last:border-0', item === locale && 'bg-lime-400/10 text-lime-300')}
              key={item}
              onClick={() => void setLocale(item)}
              type="button"
              aria-pressed={item === locale}
            >
              <span className="font-semibold">{localeLabels[item]}</span>
              {item === locale ? <Check size={19} aria-hidden="true" /> : null}
            </button>
          ))}
        </Card>

        <section className="mt-8" aria-labelledby="about-heading">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400" id="about-heading">
            {t('settings.aboutSupport')}
          </h2>
          <Card className="mt-3 p-5">
            <div className="flex items-center gap-4">
              <img alt="" aria-hidden="true" className="size-14 rounded-2xl bg-[#D2F86A]/10 p-2" src="/assets/brand/galerows-mark.svg" />
              <div>
                <h3 className="text-xl font-black tracking-tight">Galerows</h3>
                <p className="mt-1 text-sm leading-5 text-slate-300">{t('settings.tagline')}</p>
              </div>
            </div>
            <div className="mt-5 flex items-start gap-2 rounded-2xl bg-[#B8A0FF]/10 px-3 py-3 text-sm leading-5 text-slate-200">
              <Wifi aria-hidden="true" className="mt-0.5 shrink-0 text-[#B8A0FF]" size={18} />
              <p>{t('settings.connectivity')}</p>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-3 gap-y-4 border-t border-white/10 pt-4 text-sm">
              <div>
                <dt className="text-slate-400">{t('settings.versionLabel')}</dt>
                <dd className="mt-1 font-bold">{displayedDetails.version}</dd>
              </div>
              <div>
                <dt className="text-slate-400">{t('settings.buildLabel')}</dt>
                <dd className="mt-1 font-bold">{displayedDetails.build || '—'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-slate-400">{t('settings.platformLabel')}</dt>
                <dd className="mt-1 font-bold">{platform}</dd>
              </div>
            </dl>
          </Card>
        </section>

        <div className="mt-5 grid gap-3">
          <a
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/15"
            href={createFeedbackMailto(displayedDetails, locale)}
          >
            <Mail size={18} aria-hidden="true" />
            {t('settings.reportProblem')}
          </a>
          <Button className="w-full" variant="secondary" onClick={() => navigate('/settings/guide')}>
            <BookOpen size={18} aria-hidden="true" />
            {t('guide.reopen')}
          </Button>
          <Button className="w-full" variant="secondary" onClick={() => navigate('/settings/privacy')}>
            <ShieldCheck size={18} aria-hidden="true" />
            {t('settings.privacyCenter')}
          </Button>
          {canUseNativeAndroidPlayStore() ? (
            <Button className="w-full" variant="secondary" onClick={() => void PlayStore.openPlayStoreListing()}>
              <Star size={18} aria-hidden="true" />
              {t('settings.rateApp')}
            </Button>
          ) : null}
        </div>

        <p className="mt-5 flex items-start gap-2 text-sm leading-6 text-slate-400">
          <Info className="mt-1 shrink-0" size={16} aria-hidden="true" />
          {t('settings.offlineNote')}
        </p>

        {contentAdminEnabled ? (
          <Button className="mt-6 w-full" variant="secondary" onClick={() => navigate('/admin/content')}>
            <FileJson size={18} />Administrar conteúdo
          </Button>
        ) : null}
      </section>
    </div>
  )
}
