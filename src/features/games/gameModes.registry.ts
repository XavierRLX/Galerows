import type { GameModule } from './games.types'

export type LocalGameMode = 'sharedDevice' | 'localPersonalSheet' | 'existingDevice' | 'unavailable'
export type LanGameMode = 'comingSoon' | 'unsupported'

export type GameModeCapabilities = Readonly<{
  local: Readonly<{ kind: LocalGameMode; label: string }>
  lan: LanGameMode
}>

// LAN availability is intentionally impossible here until a real adapter passes its gate.
// QR-sharing a local worksheet is not a synchronized multiplayer GameSession.
const specialModes: Readonly<Record<string, GameModeCapabilities>> = {
  'impostor-da-palavra': {
    local: { kind: 'sharedDevice', label: 'Jogar neste celular' },
    lan: 'comingSoon',
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
