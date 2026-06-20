import { Download, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { PlayStore } from '../../lib/capacitor/playStore'
import { checkUpdatePrompt, dismissUpdatePrompt, subscribeToAppForeground, type UpdatePromptState } from './updatePrompt.service'

const initialState: UpdatePromptState = { status: 'hidden', updateInfo: null }

export function AppUpdateBanner() {
  const { t } = useTranslation('common')
  const location = useLocation()
  const [state, setState] = useState<UpdatePromptState>(initialState)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(() => {
    let active = true
    void checkUpdatePrompt(location.pathname).then((nextState) => {
      if (active) setState(nextState)
    })
    return () => { active = false }
  }, [location.pathname])

  useEffect(() => refresh(), [refresh])
  useEffect(() => {
    let remove: () => void = () => undefined
    void subscribeToAppForeground(refresh).then((unsubscribe) => { remove = unsubscribe })
    return () => remove()
  }, [refresh])
  useEffect(() => {
    let remove: () => void = () => undefined
    void PlayStore.onUpdateStateChanged((updateInfo) => {
      if (updateInfo.downloaded) refresh()
    }).then((unsubscribe) => { remove = unsubscribe })
    return () => remove()
  }, [refresh])

  if (state.status === 'hidden' || !state.updateInfo) return null
  const updateInfo = state.updateInfo

  const title = state.status === 'downloaded' ? t('updates.downloadedTitle') : t('updates.availableTitle')
  const description = state.status === 'downloaded' ? t('updates.downloadedDescription') : t('updates.availableDescription')
  const actionLabel = state.status === 'downloaded' ? t('updates.restart') : t('updates.update')

  return <section className="px-5 pt-4">
    <div className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-4 text-cyan-50">
      <div className="flex items-start gap-3">
        <Download className="mt-0.5 shrink-0 text-cyan-200" size={20} />
        <div className="min-w-0 flex-1 text-left">
          <h2 className="text-sm font-black">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-cyan-100/80">{description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button className="bg-cyan-200 text-slate-950 hover:bg-cyan-100" disabled={busy} onClick={async () => {
              setBusy(true)
              if (state.status === 'downloaded') await PlayStore.completeFlexibleUpdate()
              else {
                await PlayStore.startFlexibleUpdate()
                refresh()
              }
              setBusy(false)
            }}>
              <RefreshCw size={17} />
              {actionLabel}
            </Button>
            {state.status === 'available' ? <Button disabled={busy} variant="ghost" onClick={async () => {
              await dismissUpdatePrompt(updateInfo)
              setState(initialState)
            }}>
              <X size={17} />
              {t('updates.later')}
            </Button> : null}
          </div>
        </div>
      </div>
    </div>
  </section>
}
