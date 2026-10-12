import type { Clock } from './clock'
import type { RoomEffect } from './gameAdapter'
import type { RoomCommandError } from './persistentProtocol'

export interface MultiplayerGameContext { clock: Clock; random: () => number }
export interface MultiplayerGameAction { playerId: string; type: string; payload: unknown }
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
}

export function defineMultiplayerGame<TConfig, TState>(definition: MultiplayerGameDefinition<TConfig, TState>): RegisteredMultiplayerGame {
  return {
    gameId: definition.gameId, minPlayers: definition.minPlayers, maxPlayers: definition.maxPlayers,
    validateConfig: input => definition.validateConfig(input),
    createInitialState: (config, participants, context) => definition.createInitialState(config as TConfig, participants, context),
    applyCommand: (state, action, context) => definition.applyCommand(state as TState, action, context),
    projectPublic: state => definition.projectPublic(state as TState),
    projectPrivate: (state, playerId) => definition.projectPrivate(state as TState, playerId),
  }
}
