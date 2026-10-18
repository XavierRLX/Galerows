import { Capacitor, registerPlugin } from '@capacitor/core'

type NativeScreenAwakePlugin = {
  setEnabled(options: { enabled: boolean }): Promise<void>
}

const NativeScreenAwake = registerPlugin<NativeScreenAwakePlugin>('ScreenAwake')

/** Android Window FLAG_KEEP_SCREEN_ON; no third-party plugin or extra permission. */
export async function setScreenAwakeEnabled(enabled: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return
  await NativeScreenAwake.setEnabled({ enabled })
}

/** Serializes native calls so a delayed "enable" cannot outlive a later "disable". */
export function createScreenAwakeCoordinator(setEnabled: (enabled: boolean) => Promise<void>) {
  let wanted = false
  let foreground = true
  let applied = false
  let forceNext = false
  let pending = Promise.resolve()

  const schedule = () => {
    const update = pending.then(async () => {
      const target = wanted && foreground
      const force = forceNext
      forceNext = false
      if (target === applied && !force) return
      try {
        await setEnabled(target)
        applied = target
      } catch {
        // Android also clears the flag in Activity.onPause.
        // Keep it recoverable on the next lifecycle event.
        applied = false
      }
    })
    pending = update.catch(() => undefined)
    return pending
  }

  return {
    setWanted(enabled: boolean) {
      wanted = enabled
      return schedule()
    },
    setForeground(active: boolean) {
      foreground = active
      // Android clears its window flag when paused; reapply after resume.
      if (active) forceNext = true
      return schedule()
    },
    release() {
      wanted = false
      foreground = false
      return schedule()
    },
  }
}
