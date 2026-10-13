import { createContext, useContext } from 'react'
import type { RoomSession } from './RoomSessionProvider'

export const RoomSessionContext = createContext<RoomSession | null>(null)

export function useRoomSessionOptional() {
  return useContext(RoomSessionContext)
}

export function useRoomSession() {
  const session = useRoomSessionOptional()
  if (!session) throw new Error('room_session_provider_missing')
  return session
}
