import { describe, expect, it } from 'vitest'
import { closestLoopIndex, getCardPose, getFlingTarget, wrapIndex } from './coverflowMotion'

describe('coverflow physics', () => {
  it('uses the shortest circular route, including the last-to-first transition', () => {
    expect(closestLoopIndex(0, 9, 10)).toBe(10)
    expect(closestLoopIndex(9, 0, 10)).toBe(-1)
    expect(wrapIndex(-1, 10)).toBe(9)
    expect(wrapIndex(10, 10)).toBe(0)
  })

  it('keeps individual cards moving continuously through fractional carousel positions', () => {
    const before = getCardPose(1, 0.35, 10, 234)
    const after = getCardPose(1, 0.36, 10, 234)
    expect(Math.abs(before.translateX - after.translateX)).toBeLessThan(4)
    expect(before.scale).toBeLessThan(after.scale)
    expect(getCardPose(1, 1, 10, 234).translateX).toBeCloseTo(0)
    expect(getCardPose(0, 9.9, 10, 234).translateX).toBeGreaterThan(-15)
  })

  it('shows second neighbors and gives side cards reduced perspective', () => {
    const first = getCardPose(1, 0, 10, 234)
    const second = getCardPose(2, 0, 10, 234)
    expect(first.scale).toBeGreaterThan(second.scale)
    expect(first.rotateY).toBeLessThan(22)
    expect(second.opacity).toBeGreaterThan(0.25)
  })

  it('lets quick flicks travel farther but never jump more than three cards', () => {
    expect(getFlingTarget(0.35, 0.1)).toBe(0)
    expect(getFlingTarget(0.6, 0.1)).toBe(1)
    expect(getFlingTarget(0.35, 8)).toBe(3)
    expect(getFlingTarget(0.35, -8)).toBe(-2)
  })
})
