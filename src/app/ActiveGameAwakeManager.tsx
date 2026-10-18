import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AppLifecycle } from '../lib/capacitor/app'
import { createScreenAwakeCoordinator, setScreenAwakeEnabled } from '../lib/capacitor/screenAwake'
import { useRoomSessionOptional } from '../features/multiplayer/lan/lobby/RoomSessionContext'
import { shouldKeepScreenAwake } from './activeGameAwakePolicy'

/** One coordinator for all games; Android Activity also clears the flag on pause. */
export function ActiveGameAwakeManager() {
  const { pathname } = useLocation()
  const room = useRoomSessionOptional()
  const lanPhase = room?.snapshot?.roomState.phase ?? null
  const desired = shouldKeepScreenAwake(pathname, lanPhase)
  const [coordinator] = useState(() => createScreenAwakeCoordinator(setScreenAwakeEnabled))

  useEffect(() => {
    void coordinator.setWanted(desired)
    return () => { void coordinator.setWanted(false) }
  }, [coordinator, desired])

  useEffect(() => {
    const onVisibility = () => { void coordinator.setForeground(document.visibilityState === 'visible') }
    document.addEventListener('visibilitychange', onVisibility)
    const removeNativeListener = AppLifecycle.onAppStateChange((isActive) => {
      void coordinator.setForeground(isActive)
    })
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      void removeNativeListener.then((remove) => remove())
      void coordinator.release()
    }
  }, [coordinator])

  return null
}
