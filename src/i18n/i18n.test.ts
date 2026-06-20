import { beforeAll, describe, expect, it } from 'vitest'
import i18n, { initializeI18n, supportedLocales } from '.'

beforeAll(async () => { await initializeI18n() })

describe('i18n', () => {
  it('provides the required Hub copy in every supported locale', async () => {
    for (const locale of supportedLocales) {
      await i18n.changeLanguage(locale)
      expect(i18n.t('subtitle', { ns: 'hub' })).not.toBe('subtitle')
      expect(i18n.t('games.nem-ferrando.name', { ns: 'hub' })).toBeTruthy()
      expect(i18n.t('games.impostor-da-palavra.name', { ns: 'hub' })).toBeTruthy()
      expect(i18n.t('name', { ns: 'cidade-dorme' })).toBeTruthy()
      expect(i18n.t('roles.killer.name', { ns: 'cidade-dorme' })).toBeTruthy()
      expect(i18n.t('name', { ns: 'impostor-da-palavra' })).toBeTruthy()
      expect(i18n.t('name', { ns: 'quem-sou-eu' })).toBeTruthy()
    }
    await i18n.changeLanguage('pt-BR')
  })
})
