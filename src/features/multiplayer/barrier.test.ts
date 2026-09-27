import { describe, expect, it } from 'vitest'
import { completeBarrier, createBarrier } from './barrier'

describe('multiplayer barrier', () => {
  it('does not count a player outside the expected set', () => {
    const barrier = createBarrier('ready', 'ready', ['p1', 'p2'])
    const update = completeBarrier(barrier, 'p3')

    expect(update).toEqual({ barrier, changed: false, completedNow: false })
  })

  it('completes only when every expected player is satisfied', () => {
    const barrier = createBarrier('ready', 'ready', ['p1', 'p2'])
    const first = completeBarrier(barrier, 'p1')
    const second = completeBarrier(first.barrier, 'p2')

    expect(first.barrier.isComplete).toBe(false)
    expect(second.barrier.isComplete).toBe(true)
    expect(second.completedNow).toBe(true)
  })

  it('does not complete twice when the same completion is repeated', () => {
    const barrier = createBarrier('ready', 'ready', ['p1'])
    const first = completeBarrier(barrier, 'p1')
    const retry = completeBarrier(first.barrier, 'p1')

    expect(first.completedNow).toBe(true)
    expect(retry).toEqual({
      barrier: first.barrier,
      changed: false,
      completedNow: false,
    })
  })
})
