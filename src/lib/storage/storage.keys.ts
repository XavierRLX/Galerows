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
  gameUsage: 'galerows.games.usage',
  gameFavorites: 'galerows.games.favorites',
  galeraResults: 'galerows.galera.results',
  top10Session: 'galerows.games.top-10.session',
  ultimaPistaProgress: 'galerows.games.ultima-pista.progress',
  quemSouEuSession: 'galerows.games.quem-sou-eu.session',
  pistaUnicaSession: 'galerows.games.pista-unica.session',
  adedonhaSession: 'galerows.games.adedonha.session',
  cidadeDormeSession: 'galerows.games.cidade-dorme.session',
  premiumSnapshot: 'galerows.premium.snapshot',
  appFirstOpenedAt: 'galerows.app.first-opened-at',
  appReviewPrompt: 'galerows.app.review-prompt',
  appUpdatePrompt: 'galerows.app.update-prompt',
  privacyNoticeVersion: 'galerows.privacy.notice-version',
} as const

export function contentOverrideKey(gameId: string, locale: string) {
  return `galerows.content.override.${gameId}.${locale}`
}
