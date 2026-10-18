import { Check } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { hasSeenCurrentPrivacyNotice } from '../privacy/privacy.service'
import { GuideCards } from './GuideCards'
import { hasCompletedGuide, markGuideComplete } from './guide.service'

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
