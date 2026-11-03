import { ChevronLeft, ChevronRight, Grid2X2, Heart } from 'lucide-react'
import {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
  type PointerEvent, type WheelEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import type { GameModule } from '../games/games.types'
import { closestLoopIndex, getCardPose, getFlingTarget, wrapIndex } from './coverflowMotion'
import { GameCard } from './GameCard'
import './hub-coverflow.css'

type GameCoverflowProps = {
  games: readonly GameModule[]
  getBadges: (gameId: string) => string[]
  isFavorite: (gameId: string) => boolean
  onOpenGame: (gameId: string) => Promise<void> | void
}

type DragSession = {
  startX: number
  startY: number
  from: number
  lastX: number
  lastTime: number
  velocity: number
  horizontal: boolean
}

const DRAG_STEP_RATIO = .78
const MAX_SPRING_DT = .034
const SPRING_STIFFNESS = 155
const SPRING_DAMPING = 18

/**
 * A single persistent DOM element per game.
 * Continuous fractional positions are painted directly on the wrappers to avoid
 * 60 React component rerenders per second on entry-level Android hardware.
 */
export function GameCoverflow({ games, getBadges, isFavorite, onOpenGame }: GameCoverflowProps) {
  const { t } = useTranslation('hub')
  const [selectedId, setSelectedId] = useState<string | undefined>(games[0]?.id)

  const gameIds = games.map(game => game.id).join('|')
  const gamesRef = useRef(games)
  const selectedRef = useRef(selectedId)
  const cardsRef = useRef(new Map<string, HTMLDivElement>())
  const stageRef = useRef<HTMLDivElement | null>(null)
  const positionRef = useRef(0)
  const targetRef = useRef(0)
  const velocityRef = useRef(0)
  const frameRef = useRef<number | null>(null)
  const dragRef = useRef<DragSession | null>(null)
  const suppressClickUntilRef = useRef(0)
  const lastWheelRef = useRef(0)

  const selectedIndex = Math.max(0, games.findIndex(game => game.id === selectedId))
  const selected = games[selectedIndex]

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

  const getCardWidth = useCallback(() => {
    const node = cardsRef.current.values().next().value
    return node?.offsetWidth || 234
  }, [])

  const repaint = useCallback((position: number) => {
    const currentGames = gamesRef.current
    const width = getCardWidth()
    currentGames.forEach((game, index) => {
      const element = cardsRef.current.get(game.id)
      if (!element) return
      const pose = getCardPose(index, position, currentGames.length, width)
      element.style.transform =
        `translate3d(-50%, -50%, 0) translate3d(${pose.translateX.toFixed(2)}px, 0, 0) rotateY(${pose.rotateY.toFixed(2)}deg) scale(${pose.scale.toFixed(4)})`
      element.style.opacity = String(pose.opacity)
      element.style.zIndex = String(pose.zIndex)
      element.style.visibility = pose.visible ? 'visible' : 'hidden'
      element.style.setProperty('--card-focus', String(pose.focus))
    })
  }, [getCardWidth])

  const stopAnimation = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
  }, [])

  const moveTo = (destination: number) => {
    const currentGames = gamesRef.current
    if (!currentGames.length) return
    targetRef.current = destination
    setSelectedId(currentGames[wrapIndex(Math.round(destination), currentGames.length)].id)

    if (prefersReducedMotion()) {
      stopAnimation()
      positionRef.current = destination
      velocityRef.current = 0
      repaint(destination)
      return
    }

    if (frameRef.current !== null) return
    let lastTime: number | null = null
    const tick = (now: number) => {
      const dt = lastTime === null ? 1 / 60 : Math.min(MAX_SPRING_DT, (now - lastTime) / 1000)
      lastTime = now
      const distance = targetRef.current - positionRef.current
      velocityRef.current = (velocityRef.current + distance * SPRING_STIFFNESS * dt) *
        Math.exp(-SPRING_DAMPING * dt)
      positionRef.current += velocityRef.current * dt

      if (Math.abs(targetRef.current - positionRef.current) < .002 &&
          Math.abs(velocityRef.current) < .03) {
        positionRef.current = targetRef.current
        velocityRef.current = 0
        repaint(positionRef.current)
        frameRef.current = null
        return
      }

      repaint(positionRef.current)
      frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
  }

  function selectIndex(index: number) {
    const count = gamesRef.current.length
    if (count < 2) return
    moveTo(closestLoopIndex(index, positionRef.current, count))
  }

  function step(direction: -1 | 1) {
    if (gamesRef.current.length < 2) return
    moveTo(Math.round(targetRef.current) + direction)
  }

  function getDragStep() {
    return Math.max(90, getCardWidth() * DRAG_STEP_RATIO)
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (!(event.target instanceof Element) || !event.target.closest('.hub-coverflow-stage')) return
    if (gamesRef.current.length < 2) return
    dragRef.current = {
      startX: event.clientX, startY: event.clientY, from: positionRef.current,
      lastX: event.clientX, lastTime: event.timeStamp, velocity: 0, horizontal: false,
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag) return
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY

    if (!drag.horizontal) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx) * 1.2) {
        dragRef.current = null // Native vertical page scroll is never hijacked.
        return
      }
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.15) return
      drag.horizontal = true
      stopAnimation()
      targetRef.current = positionRef.current
      velocityRef.current = 0
      event.currentTarget.setPointerCapture?.(event.pointerId)
    }

    const elapsed = Math.max(12, event.timeStamp - drag.lastTime)
    const instantVelocity = -((event.clientX - drag.lastX) / getDragStep()) / (elapsed / 1000)
    drag.velocity = .35 * drag.velocity + .65 * instantVelocity
    drag.lastTime = event.timeStamp
    drag.lastX = event.clientX
    positionRef.current = drag.from - dx / getDragStep()
    repaint(positionRef.current)
    const candidate = gamesRef.current[wrapIndex(Math.round(positionRef.current), gamesRef.current.length)]
    if (candidate && candidate.id !== selectedRef.current) {
      selectedRef.current = candidate.id
      setSelectedId(candidate.id)
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (!drag.horizontal && (Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy) * 1.2)) {
      return // A normal tap must not interrupt a card already animating into focus.
    }
    stopAnimation()
    const current = drag.from - dx / getDragStep()
    positionRef.current = current
    const velocity = event.timeStamp - drag.lastTime > 90 ? 0 : drag.velocity
    suppressClickUntilRef.current = event.timeStamp + 220
    moveTo(getFlingTarget(current, velocity))
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (Math.abs(event.deltaX) <= Math.max(12, Math.abs(event.deltaY) * 1.25)) return
    if (event.timeStamp - lastWheelRef.current < 190) return
    lastWheelRef.current = event.timeStamp
    step(event.deltaX > 0 ? 1 : -1)
  }

  useLayoutEffect(() => {
    gamesRef.current = games
    selectedRef.current = selectedId
  }, [games, selectedId])

  useLayoutEffect(() => {
    stopAnimation()
    const currentGames = gamesRef.current
    const index = Math.max(0, currentGames.findIndex(game => game.id === selectedRef.current))
    positionRef.current = index
    targetRef.current = index
    velocityRef.current = 0
    if (currentGames[index]?.id !== selectedRef.current) setSelectedId(currentGames[index]?.id)
    repaint(index)
  }, [gameIds, repaint, stopAnimation])

  useLayoutEffect(() => { repaint(positionRef.current) }, [selectedId, repaint])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => repaint(positionRef.current))
    observer.observe(stage)
    return () => observer.disconnect()
  }, [repaint])

  useEffect(() => () => stopAnimation(), [stopAnimation])

  if (!selected) {
    return <p className="hub-carousel-empty" role="status">{t('carousel.empty')}</p>
  }

  return (
    <div className="hub-discovery">
      <div
        className="hub-coverflow"
        role="region"
        aria-roledescription="carrossel"
        aria-label={t('carousel.ariaLabel')}
        tabIndex={0}
        onKeyDown={event => {
          if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1) }
          if (event.key === 'ArrowRight') { event.preventDefault(); step(1) }
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          if (dragRef.current?.horizontal) moveTo(Math.round(positionRef.current))
          dragRef.current = null
        }}
        onClickCapture={event => {
          if (event.timeStamp < suppressClickUntilRef.current &&
              event.target instanceof Element && event.target.closest('.hub-coverflow-stage')) {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
        onWheel={handleWheel}
      >
        <div className="hub-coverflow-stage" ref={stageRef}>
          {games.map(game => {
            const active = game.id === selected.id
            const index = games.findIndex(item => item.id === game.id)
            const name = t(`games.${game.id}.name`, { defaultValue: game.name })
            return (
              <div
                key={game.id}
                data-testid={`coverflow-card-${game.id}`}
                className="hub-coverflow-item"
                data-active={active}
                ref={node => {
                  if (node) cardsRef.current.set(game.id, node)
                  else cardsRef.current.delete(game.id)
                }}
              >
                <GameCard
                  game={game}
                  badgeLabels={getBadges(game.id)}
                  isFavorite={isFavorite(game.id)}
                  onOpenGame={onOpenGame}
                  presentation="coverflow"
                  isActive={active}
                />
                <span className="hub-coverflow-side-title" aria-hidden="true">{name}</span>
                {!active ? (
                  <button
                    type="button"
                    className="hub-coverflow-select"
                    aria-label={t('carousel.view', { name })}
                    onClick={() => selectIndex(index)}
                  />
                ) : null}
              </div>
            )
          })}
        </div>
        <div className="hub-carousel-controls">
          {games.length > 1
            ? <button type="button" aria-label={t('carousel.previous')} onClick={() => step(-1)}><ChevronLeft size={20} aria-hidden="true" /></button>
            : <span />}
          <span className="hub-carousel-position" aria-live="polite" aria-atomic="true">
            {selectedIndex + 1} <span>/</span> {games.length}
          </span>
          {games.length > 1
            ? <button type="button" aria-label={t('carousel.next')} onClick={() => step(1)}><ChevronRight size={20} aria-hidden="true" /></button>
            : <span />}
        </div>
        <div className="hub-carousel-dots" role="group" aria-label={t('carousel.pagination')}>
          {games.map((game, index) => {
            const name = t(`games.${game.id}.name`, { defaultValue: game.name })
            return (
              <button
                key={game.id}
                type="button"
                aria-label={t('carousel.goTo', { name })}
                aria-current={selected.id === game.id ? 'true' : undefined}
                onClick={() => selectIndex(index)}
              >
                <span />
              </button>
            )
          })}
        </div>
      </div>
      <section className="hub-quick-access" aria-label={t('carousel.allGames')}>
        <div className="hub-quick-heading">
          <h3><Grid2X2 aria-hidden="true" size={17} />{t('carousel.allGames')}</h3>
          <span>{t('carousel.availableCount', { count: games.length })}</span>
        </div>
        <div className="hub-quick-list">
          {games.map(game => {
            const name = t(`games.${game.id}.name`, { defaultValue: game.name })
            return (
              <button
                key={game.id}
                type="button"
                className="hub-quick-card"
                aria-label={t('carousel.select', { name })}
                aria-pressed={game.id === selected.id}
                onClick={() => selectIndex(games.findIndex(item => item.id === game.id))}
              >
                {game.coverImage ? <img src={game.coverImage} alt="" loading="lazy" decoding="async" /> : null}
                {isFavorite(game.id)
                  ? <span className="hub-quick-favorite" aria-label={t('favoriteBadge')}><Heart fill="currentColor" aria-hidden="true" size={12} /></span>
                  : null}
                <span>{name}</span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
