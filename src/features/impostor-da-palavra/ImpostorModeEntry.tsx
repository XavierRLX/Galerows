import { Smartphone, Wifi } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'

type Props = {
  lanAvailable: boolean
  localReady: boolean
  continuingLocal: boolean
  onLocal: () => void
  onCreateRoom: () => void
  onJoinRoom: () => void
}

/** Distinct entry points: local games never depend on an active LAN Room. */
export function ImpostorModeEntry({
  lanAvailable, localReady, continuingLocal, onLocal, onCreateRoom, onJoinRoom,
}: Props) {
  const { t } = useTranslation('impostor-da-palavra')

  return <Card className="mx-auto mt-8 max-w-lg p-5">
    <h2 className="text-xl font-black">{t('modeEntry.title')}</h2>
    <p className="mt-2 text-sm text-slate-400">{t('modeEntry.description')}</p>
    <div className="mt-4 grid gap-3">
      <div className="rounded-2xl border border-violet-400/40 bg-violet-400/10 p-4">
        <div className="flex items-center gap-2 font-black text-violet-200">
          <Smartphone size={19} aria-hidden="true" />{t('modeEntry.singleTitle')}
        </div>
        <p className="my-3 text-sm text-slate-300">{t('modeEntry.singleDescription')}</p>
        <Button className="w-full bg-violet-400 text-slate-950 hover:bg-violet-300" disabled={!localReady} onClick={onLocal}>
          {continuingLocal ? t('modeEntry.continueSingle') : t('modeEntry.singleAction')}
        </Button>
      </div>
      <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
        <div className="flex items-center gap-2 font-black text-white">
          <Wifi size={19} aria-hidden="true" />{t('modeEntry.multiTitle')}
        </div>
        <p className="my-3 text-sm text-slate-300">{t('modeEntry.multiDescription')}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={!lanAvailable} onClick={onCreateRoom}>{t('modeEntry.createAction')}</Button>
          <Button variant="secondary" disabled={!lanAvailable} onClick={onJoinRoom}>{t('modeEntry.joinAction')}</Button>
        </div>
        {!lanAvailable && <p className="mt-3 text-xs text-amber-200">{t('modeEntry.unavailable')}</p>}
      </div>
    </div>
  </Card>
}
