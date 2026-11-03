/** Pure carousel geometry and swipe projection: no browser state or dependencies. */
export const wrapIndex = (index: number, count: number) =>
  count > 0 ? ((index % count) + count) % count : 0

export function closestLoopIndex(index: number, current: number, count: number) {
  if (count < 2) return 0
  return index + Math.round((current - index) / count) * count
}

export function circularDistance(index: number, position: number, count: number) {
  if (count < 2) return 0
  const delta = index - position
  return ((delta + count / 2) % count + count) % count - count / 2
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))

export function getCardPose(index: number, position: number, count: number, width: number) {
  const distance = circularDistance(index, position, count)
  const amount = Math.abs(distance)
  const direction = Math.sign(distance)
  const lead = Math.min(1, amount)
  const tail = Math.max(0, amount - 1)
  return {
    distance,
    translateX: direction * width * (.37 * lead + .63 * tail),
    scale: clamp(1 - .28 * lead - .15 * tail, .35, 1),
    rotateY: -direction * Math.min(26, 14 * lead + 4 * tail),
    opacity: clamp(1 - Math.max(0, amount - 1.65) * .56, 0, 1),
    focus: clamp(1 - amount * 1.6, 0, 1),
    zIndex: Math.round(100 - amount * 12),
    visible: amount < 3.35,
  }
}

/** Momentum projection is capped so a forceful flick skips at most a few cards. */
export function getFlingTarget(position: number, velocityInCardsPerSecond: number) {
  return Math.round(position + clamp(velocityInCardsPerSecond * .35, -2.5, 2.5))
}
