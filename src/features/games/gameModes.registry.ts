import type { GameModule } from './games.types'

export type LocalGameMode = 'sharedDevice' | 'localPersonalSheet' | 'existingDevice' | 'unavailable'
export type LanGameMode = 'available' | 'comingSoon' | 'unsupported'

export type GameModeCapabilities = Readonly<{
  local: Readonly<{ kind: LocalGameMode; label: string }>
  lan: LanGameMode
}>

// Catalog support mirrors the games registered in RoomSessionProvider.
// Platform/build availability is enforced by the room entry points.
// QR-sharing a local worksheet is not a synchronized multiplayer GameSession.
const specialModes: Readonly<Record<string, GameModeCapabilities>> = {
  'impostor-da-palavra': {
    local: { kind: 'sharedDevice', label: 'Jogar neste celular' },
    lan: 'available',
  },
  'cidade-dorme': {
    local: { kind: 'sharedDevice', label: 'Jogar neste celular' },
    lan: 'available',
  },
  'pista-unica': {
    local: { kind: 'sharedDevice', label: 'Jogar neste celular' },
    lan: 'available',
  },
  adedonha: {
    local: { kind: 'localPersonalSheet', label: 'Minha folha no celular' },
    lan: 'comingSoon',
  },
}

const existingGame: GameModeCapabilities = {
  local: { kind: 'existingDevice', label: 'Neste celular' },
  lan: 'unsupported',
}

const unavailableGame: GameModeCapabilities = {
  local: { kind: 'unavailable', label: 'Em breve' },
  lan: 'unsupported',
}

export function getGameModeCapabilities(game: GameModule): GameModeCapabilities {
  if (game.status !== 'available') return unavailableGame
  return specialModes[game.id] ?? existingGame
}
