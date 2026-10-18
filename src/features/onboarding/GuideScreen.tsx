import { useTranslation } from 'react-i18next'
import { Header } from '../../components/layout/Header'
import { Card } from '../../components/ui/Card'
import { GuideCards } from './GuideCards'

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
