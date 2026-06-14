import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Header } from '../../components/layout/Header'
import { EmptyState } from '../../components/ui/EmptyState'

export function PremiumScreen() { const { t } = useTranslation('common'); return <div className="min-h-dvh"><Header backTo="/" title={t('premium.title')} /><section className="px-5 py-8"><EmptyState icon={<Sparkles className="text-lime-300" size={32} />} title={t('premium.placeholderTitle')} description={t('premium.placeholderDescription')} /></section></div> }
