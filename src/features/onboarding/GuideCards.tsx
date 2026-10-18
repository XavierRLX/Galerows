import { Smartphone, Users, Wifi } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function GuideCards() {
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
