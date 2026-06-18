export const STORAGE_KEYS = {
  locale: 'galerows.locale',
  playerGroup: 'galerows.players.group',
  nemFerrandoSession: 'galerows.games.nem-ferrando.session',
  nemFerrandoOpeningHistory: 'galerows.games.nem-ferrando.opening-history',
  impostorDaPalavraSession: 'galerows.games.impostor-da-palavra.session',
  impostorDaPalavraOpeningHistory: 'galerows.games.impostor-da-palavra.opening-history',
  tabooSession: 'galerows.games.taboo.session',
  tabooOpeningHistory: 'galerows.games.taboo.opening-history',
  mimicaSession: 'galerows.games.mimica.session',
  mimicaOpeningHistory: 'galerows.games.mimica.opening-history',
  top10Session: 'galerows.games.top-10.session',
  quemSouEuSession: 'galerows.games.quem-sou-eu.session',
  adedonhaSession: 'galerows.games.adedonha.session',
  premiumSnapshot: 'galerows.premium.snapshot',
} as const

export function contentOverrideKey(gameId: string, locale: string) {
  return `galerows.content.override.${gameId}.${locale}`
}
