import type { PlayerId } from './protocol'

export interface BarrierState {
  id: string
  type: string
  expectedPlayerIds: readonly PlayerId[]
  completedPlayerIds: readonly PlayerId[]
  isComplete: boolean
}

export interface BarrierUpdate {
  barrier: BarrierState
  changed: boolean
  completedNow: boolean
}

export function createBarrier(
  id: string,
  type: string,
  expectedPlayerIds: readonly PlayerId[],
): BarrierState {
  const expected = [...new Set(expectedPlayerIds)]
  return {
    id,
    type,
    expectedPlayerIds: expected,
    completedPlayerIds: [],
    isComplete: expected.length === 0,
  }
}

export function completeBarrier(
  barrier: BarrierState,
  playerId: PlayerId,
): BarrierUpdate {
  if (
    barrier.isComplete
    || !barrier.expectedPlayerIds.includes(playerId)
    || barrier.completedPlayerIds.includes(playerId)
  ) {
    return { barrier, changed: false, completedNow: false }
  }

  const completedPlayerIds = [...barrier.completedPlayerIds, playerId]
  const isComplete = barrier.expectedPlayerIds.every((id) => completedPlayerIds.includes(id))
  return {
    barrier: { ...barrier, completedPlayerIds, isComplete },
    changed: true,
    completedNow: isComplete,
  }
}
