import { defineMultiplayerGame } from './multiplayerGames'

interface ToyState { rounds: number; clueCount: number; startedAt: number;
  secrets: Readonly<Record<string, string>>; participants: readonly string[] }
const toy = defineMultiplayerGame<{ rounds: number }, ToyState>({
  gameId: 'toy', minPlayers: 2, maxPlayers: 12,
  validateConfig: input => {
    if (!record(input) || !Number.isSafeInteger(input.rounds) || (input.rounds as number) < 1
      || (input.rounds as number) > 5) return { ok: false }
    return { ok: true, config: { rounds: input.rounds as number } }
  },
  createInitialState: (config, participants, context) => {
    const seed = Math.floor(context.random() * 1_000_000)
    return { rounds: config.rounds, clueCount: 0, startedAt: context.clock.now(), participants: [...participants],
      secrets: Object.fromEntries(participants.map((id, index) => [id, `${seed}-${index + 1}`])) }
  },
  applyCommand: (state, action) => {
    if (action.type === 'TOY_CLUE' && action.payload === null) {
      return { accepted: true, changed: true, state: { ...state, clueCount: state.clueCount + 1 } }
    }
    if (action.type === 'TOY_CHECKPOINT' && record(action.payload)
      && typeof action.payload.id === 'string' && action.payload.id.length > 0) {
      return { accepted: true, changed: false, roomEffects: [{ type: 'open_barrier',
        id: action.payload.id, barrierType: 'checkpoint', expectedPlayerIds: state.participants }] }
    }
    return { accepted: false, error: 'invalid_payload' }
  },
  projectPublic: state => ({ rounds: state.rounds, clueCount: state.clueCount, startedAt: state.startedAt }),
  projectPrivate: (state, playerId) => state.secrets[playerId] ? { secret: state.secrets[playerId] } : null,
})

interface CounterState { count: number; target: number }
const counter = defineMultiplayerGame<{ target: number }, CounterState>({
  gameId: 'counter', minPlayers: 2, maxPlayers: 12,
  validateConfig: input => record(input) && Number.isSafeInteger(input.target)
    && (input.target as number) >= 1 && (input.target as number) <= 20
    ? { ok: true, config: { target: input.target as number } } : { ok: false },
  createInitialState: config => ({ count: 0, target: config.target }),
  applyCommand: (state, action) => action.type === 'INCREMENT' && action.payload === null
    ? { accepted: true, changed: true, state: { ...state, count: Math.min(state.target, state.count + 1) } }
    : { accepted: false, error: 'invalid_payload' },
  projectPublic: state => ({ count: state.count, target: state.target }),
  projectPrivate: () => null,
})

/** PL-02A-only fixtures; never used by the solo game catalog or production LAN v1. */
export const syntheticMultiplayerGames = [toy, counter] as const

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
