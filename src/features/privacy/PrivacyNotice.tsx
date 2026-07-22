import { ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { hasSeenCurrentPrivacyNotice, markCurrentPrivacyNoticeSeen } from './privacy.service'

export function PrivacyNotice() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let active = true
    void hasSeenCurrentPrivacyNotice().then((seen) => {
      if (active && !seen) setOpen(true)
    })
    return () => { active = false }
  }, [])

  const dismiss = async () => {
    await markCurrentPrivacyNoticeSeen()
    setOpen(false)
  }

  return (
    <Modal open={open} title={t('privacyNotice.title')} onClose={() => void dismiss()}>
      <div className="flex gap-3 rounded-2xl border border-lime-300/20 bg-lime-300/10 p-4">
        <ShieldCheck className="mt-0.5 shrink-0 text-lime-300" size={21} />
        <p className="text-sm leading-6 text-slate-200">{t('privacyNotice.description')}</p>
      </div>
      <div className="mt-5 grid gap-3">
        <Button className="w-full" onClick={() => void dismiss()}>{t('privacyNotice.continue')}</Button>
        <Button className="w-full" variant="secondary" onClick={async () => { await dismiss(); navigate('/settings/privacy') }}>{t('privacyNotice.readPolicy')}</Button>
      </div>
    </Modal>
  )
}
