import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/** Display-only clock. The session records the start; reaching zero never decides the group vote. */
export function ImpostorLocalTimer({ startedAt, durationSeconds }: {
  startedAt: number | null | undefined
  durationSeconds: number | undefined
}) {
  const { t } = useTranslation('impostor-da-palavra')
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!durationSeconds || startedAt == null) return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [startedAt, durationSeconds])
  if (!durationSeconds || startedAt == null) return null

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000))
  const remaining = Math.max(0, durationSeconds - elapsed)
  const formatted = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`
  return <div className="mx-auto mt-6 flex max-w-lg flex-col items-center gap-2 rounded-2xl border border-violet-400/30 bg-violet-400/10 px-5 py-4 text-center">
    <span className="text-sm font-bold text-violet-200">{t('play.timerLabel')}</span>
    <span role="timer" aria-live="off" className="text-3xl font-black tabular-nums text-white">{formatted}</span>
    {remaining === 0 && <span className="text-sm text-slate-300">{t('play.timerDone')}</span>}
  </div>
}
