import { describe, expect, it } from 'vitest'
import { LocalPreferences } from './preferences'

describe('LocalPreferences', () => {
  it('stores, reads, and removes typed JSON values', async () => {
    const key = 'test.preferences'
    await LocalPreferences.setJson(key, { locale: 'pt-BR' })
    await expect(LocalPreferences.getJson<{ locale: string }>(key)).resolves.toEqual({ locale: 'pt-BR' })
    await LocalPreferences.remove(key)
    await expect(LocalPreferences.getJson(key)).resolves.toBeNull()
  })
})
