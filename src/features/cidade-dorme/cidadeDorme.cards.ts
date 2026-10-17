import type { RoleKey } from './cidadeDorme.types'

// The full illustrated deck includes three roles reserved for future game rules.
export type CidadeDormeCardKey = RoleKey | 'watchman' | 'sleepwalker' | 'traitor'

export const CIDADE_DORME_CARDS = {
  killer: { name: 'Assassino', src: '/assets/games/cidade-dorme/cards/assassino.webp' },
  detective: { name: 'Detetive', src: '/assets/games/cidade-dorme/cards/detetive.webp' },
  doctor: { name: 'Médica', src: '/assets/games/cidade-dorme/cards/medica-v2.webp' },
  watchman: { name: 'Vigia', src: '/assets/games/cidade-dorme/cards/vigia-v2.webp' },
  sleepwalker: { name: 'Sonâmbulo', src: '/assets/games/cidade-dorme/cards/sonambulo-v2.webp' },
  traitor: { name: 'Traidor', src: '/assets/games/cidade-dorme/cards/traidor.webp' },
  jester: { name: 'Coringa', src: '/assets/games/cidade-dorme/cards/coringa.webp' },
  citizen: { name: 'Cidadão', src: '/assets/games/cidade-dorme/cards/cidadao.webp' },
} as const satisfies Record<CidadeDormeCardKey, { name: string; src: string }>

export const CIDADE_DORME_CITIZEN_CARDS = [
  CIDADE_DORME_CARDS.citizen,
  { name: 'Cidadã', src: '/assets/games/cidade-dorme/cards/cidada-01.webp' },
  { name: 'Cidadã', src: '/assets/games/cidade-dorme/cards/cidada-02.webp' },
  { name: 'Cidadão', src: '/assets/games/cidade-dorme/cards/cidadao-02.webp' },
] as const
