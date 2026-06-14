export const STORAGE_KEYS = {
  locale: 'galerows.locale',
  playerGroup: 'galerows.players.group',
  nemFerrandoSession: 'galerows.games.nem-ferrando.session',
  nemFerrandoOpeningHistory: 'galerows.games.nem-ferrando.opening-history',
  impostorDaPalavraSession: 'galerows.games.impostor-da-palavra.session',
  impostorDaPalavraOpeningHistory: 'galerows.games.impostor-da-palavra.opening-history',
  tabooSession: 'galerows.games.taboo.session',
  tabooOpeningHistory: 'galerows.games.taboo.opening-history',
} as const

export function contentOverrideKey(gameId: string, locale: string) {
  return `galerows.content.override.${gameId}.${locale}`
}
