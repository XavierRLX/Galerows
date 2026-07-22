import { ExternalLink, Mail, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Header } from '../../components/layout/Header'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { privacyPolicyUrl } from './privacy.config'
import { clearAllLocalData, clearGameplayData } from './privacy.service'

type ClearMode = 'gameplay' | 'all' | null

export function PrivacyScreen() {
  const { t } = useTranslation('common')
  const [clearMode, setClearMode] = useState<ClearMode>(null)
  const [clearing, setClearing] = useState(false)

  const confirmClear = async () => {
    if (!clearMode) return
    setClearing(true)
    if (clearMode === 'gameplay') await clearGameplayData()
    else await clearAllLocalData()
    window.location.replace('/')
  }

  return (
    <div className="min-h-dvh pb-10">
      <Header backTo="/settings" title={t('privacy.title')} />
      <section className="px-5 py-7">
        <Card className="border-lime-300/20 bg-lime-300/[0.07] p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 shrink-0 text-lime-300" size={22} />
            <div><h1 className="text-xl font-black">{t('privacy.summaryTitle')}</h1><p className="mt-2 text-sm leading-6 text-slate-300">{t('privacy.summary')}</p></div>
          </div>
        </Card>

        <h2 className="mt-7 text-sm font-bold uppercase tracking-wider text-slate-400">{t('privacy.storedTitle')}</h2>
        <Card className="mt-3 p-5"><p className="text-sm leading-6 text-slate-300">{t('privacy.storedDescription')}</p></Card>

        <div className="mt-6 grid gap-3">
          <a className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/15" href={privacyPolicyUrl} rel="noopener noreferrer" target="_blank">
            <ExternalLink size={18} />{t('privacy.openPolicy')}
          </a>
          <a className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/15" href="mailto:galerowsjdg@gmail.com">
            <Mail size={18} />{t('privacy.contact')}
          </a>
        </div>

        <h2 className="mt-8 text-sm font-bold uppercase tracking-wider text-slate-400">{t('privacy.deleteTitle')}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">{t('privacy.deleteDescription')}</p>
        <div className="mt-4 grid gap-3">
          <Button className="w-full" variant="secondary" onClick={() => setClearMode('gameplay')}><Trash2 size={18} />{t('privacy.clearGameplay')}</Button>
          <Button className="w-full" variant="danger" onClick={() => setClearMode('all')}><Trash2 size={18} />{t('privacy.clearAll')}</Button>
        </div>
      </section>

      <Modal open={clearMode !== null} title={t(clearMode === 'all' ? 'privacy.confirmAllTitle' : 'privacy.confirmGameplayTitle')} onClose={() => { if (!clearing) setClearMode(null) }}>
        <p className="text-sm leading-6 text-slate-300">{t(clearMode === 'all' ? 'privacy.confirmAllDescription' : 'privacy.confirmGameplayDescription')}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button disabled={clearing} variant="secondary" onClick={() => setClearMode(null)}>{t('privacy.cancel')}</Button>
          <Button disabled={clearing} variant="danger" onClick={() => void confirmClear()}>{clearing ? t('privacy.clearing') : t('privacy.confirm')}</Button>
        </div>
      </Modal>
    </div>
  )
}
