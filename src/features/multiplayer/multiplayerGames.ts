import type { Clock } from './clock'
import type { RoomEffect } from './gameAdapter'
import type { RoomCommandError } from './persistentProtocol'

export interface MultiplayerGameContext { clock: Clock; random: () => number }
export interface MultiplayerGameAction { playerId: string; role?: 'host' | 'guest';
  connectedParticipantIds?: readonly string[]; type: string; payload: unknown }
export type MultiplayerGameTransition<TState> =
  | { accepted: false; error: RoomCommandError }
  | { accepted: true; changed: false; roomEffects?: readonly RoomEffect[] }
  | { accepted: true; changed: true; state: TState; roomEffects?: readonly RoomEffect[] }

export interface MultiplayerGameDefinition<TConfig, TState> {
  gameId: string
  minPlayers: number
  maxPlayers: number
  validateConfig(input: unknown): { ok: true; config: TConfig } | { ok: false }
  createInitialState(config: TConfig, participantIds: readonly string[], context: MultiplayerGameContext): TState
  applyCommand(state: Readonly<TState>, action: MultiplayerGameAction,
    context: MultiplayerGameContext): MultiplayerGameTransition<TState>
  projectPublic(state: Readonly<TState>): unknown
  projectPrivate(state: Readonly<TState>, playerId: string): unknown | null
  /** Privileged moderator-only projection, never part of public state or guest snapshots. */
  projectModerator?(state: Readonly<TState>): unknown | null
  /** Trusted game-authoritative award at completion. Exactly one 0–2 value per participant. */
  awardPoints?(state: Readonly<TState>): Readonly<Record<string, number>> | null
}

/** Type erasure is confined to registration; each game's reducer keeps its own typed state/config. */
export interface RegisteredMultiplayerGame {
  gameId: string
  minPlayers: number
  maxPlayers: number
  validateConfig(input: unknown): { ok: true; config: unknown } | { ok: false }
  createInitialState(config: unknown, participantIds: readonly string[], context: MultiplayerGameContext): unknown
  applyCommand(state: unknown, action: MultiplayerGameAction,
    context: MultiplayerGameContext): MultiplayerGameTransition<unknown>
  projectPublic(state: unknown): unknown
  projectPrivate(state: unknown, playerId: string): unknown | null
  projectModerator?: (state: unknown) => unknown | null
  awardPoints?: (state: unknown) => Readonly<Record<string, number>> | null
}

export function defineMultiplayerGame<TConfig, TState>(definition: MultiplayerGameDefinition<TConfig, TState>): RegisteredMultiplayerGame {
  return {
    gameId: definition.gameId, minPlayers: definition.minPlayers, maxPlayers: definition.maxPlayers,
    validateConfig: input => definition.validateConfig(input),
    createInitialState: (config, participants, context) => definition.createInitialState(config as TConfig, participants, context),
    applyCommand: (state, action, context) => definition.applyCommand(state as TState, action, context),
    projectPublic: state => definition.projectPublic(state as TState),
    projectPrivate: (state, playerId) => definition.projectPrivate(state as TState, playerId),
    ...(definition.projectModerator ? { projectModerator: (state: unknown) =>
      definition.projectModerator!(state as TState) } : {}),
    ...(definition.awardPoints ? { awardPoints: (state: unknown) => definition.awardPoints!(state as TState) } : {}),
  }
}
