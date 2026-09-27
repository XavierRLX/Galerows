import type { Clock } from './clock'
import type { Command, CommandErrorCode, PlayerId } from './protocol'

export interface GameAdapterContext {
  clock: Clock
  random: () => number
}

export type GameCommandParseResult<TGameCommand> =
  | { ok: true; command: TGameCommand }
  | { ok: false; error: Extract<CommandErrorCode, 'invalid_payload' | 'unauthorized' | 'invalid_phase'> }

export type RoomEffect =
  | {
    type: 'open_barrier'
    id: string
    barrierType: string
    expectedPlayerIds: readonly PlayerId[]
  }
  | {
    type: 'complete_barrier'
    id: string
    playerId: PlayerId
  }

interface AcceptedTransitionBase {
  accepted: true
  roomEffects?: readonly RoomEffect[]
}

export type GameTransition<TState> =
  | (AcceptedTransitionBase & { changed: false })
  | (AcceptedTransitionBase & { changed: true; state: TState })
  | {
    accepted: false
    error: Extract<CommandErrorCode, 'invalid_payload' | 'unauthorized' | 'invalid_phase'>
  }

export interface GameAdapter<TState, TGameCommand, TPublic, TPrivate> {
  createInitialState(context: GameAdapterContext): TState
  parseCommand(command: Command): GameCommandParseResult<TGameCommand>

  // Treat state as immutable. changed:false must leave it untouched;
  // changed:true must return a new state rather than mutating it in place.
  // roomEffects are declarative requests interpreted atomically by the runtime.
  applyCommand(
    state: Readonly<TState>,
    command: TGameCommand,
    context: GameAdapterContext,
  ): GameTransition<TState>

  projectPublic(state: Readonly<TState>): TPublic
  projectPrivate(state: Readonly<TState>, playerId: PlayerId): TPrivate | null
}
