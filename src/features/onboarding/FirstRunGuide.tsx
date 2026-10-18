import { Check, Smartphone, Users, Wifi } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { hasSeenCurrentPrivacyNotice } from '../privacy/privacy.service'
import { hasCompletedGuide, markGuideComplete } from './guide.service'

function GuideCards() {
  const { t } = useTranslation('common')
  const items = [
    { title: t('guide.sharedTitle'), description: t('guide.sharedDescription'), icon: Smartphone, accent: '#D2F86A' },
    { title: t('guide.lanTitle'), description: t('guide.lanDescription'), icon: Wifi, accent: '#B8A0FF' },
    { title: t('guide.groupTitle'), description: t('guide.groupDescription'), icon: Users, accent: '#D2F86A' },
  ]
  return <div className="grid gap-3">
    {items.map(({ title, description, icon: Icon, accent }) => (
      <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3" key={title}>
        <div className="shrink-0 rounded-xl p-2" style={{ color: accent, background: '#101014' }}>
          <Icon aria-hidden="true" size={21} />
        </div>
        <div><h3 className="text-sm font-black text-[#F5F3EF]">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-300">{description}</p></div>
      </div>
    ))}
  </div>
}

/** Appears only on the home after the informational privacy notice has been dismissed. */
export function FirstRunGuide() {
  const { pathname } = useLocation()
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)

  const checkVisibility = useCallback(async () => {
    try {
      const [privacySeen, guideSeen] = await Promise.all([
        hasSeenCurrentPrivacyNotice(), hasCompletedGuide(),
      ])
      if (pathname === '/' && privacySeen && !guideSeen) setOpen(true)
    } catch {
      // A storage failure must never block access to games.
    }
  }, [pathname])

  useEffect(() => {
    if (pathname !== '/') { return }
    void Promise.resolve().then(checkVisibility)
  }, [pathname, checkVisibility])

  useEffect(() => {
    const onPrivacyDismissed = () => { void checkVisibility() }
    window.addEventListener('galerows:privacy-notice-dismissed', onPrivacyDismissed)
    return () => window.removeEventListener('galerows:privacy-notice-dismissed', onPrivacyDismissed)
  }, [checkVisibility])

  const dismiss = async () => {
    setOpen(false)
    try { await markGuideComplete() } catch { /* guide must be non-blocking */ }
  }

  return <Modal open={open && pathname === '/'} title={t('guide.title')} onClose={() => void dismiss()}>
    <div className="max-h-[58dvh] overflow-y-auto pr-1"><GuideCards /></div>
    <div className="mt-4 grid grid-cols-2 gap-3">
      <Button variant="secondary" onClick={() => void dismiss()}>{t('guide.skip')}</Button>
      <Button onClick={() => void dismiss()}><Check size={17} aria-hidden="true" />{t('guide.gotIt')}</Button>
    </div>
  </Modal>
}

export function GuideScreen() {
  const { t } = useTranslation('common')
  return <div className="min-h-dvh bg-[#101014] text-[#F5F3EF]">
    <Header backTo="/settings" title={t('guide.title')} />
    <section className="px-5 py-6">
      <Card className="border-[#B8A0FF]/25 p-4">
        <p className="mb-4 text-sm text-slate-300">{t('guide.intro')}</p>
        <GuideCards />
      </Card>
    </section>
  </div>
}
