import { describe, expect, it } from 'vitest'
import { isContentAdminEnabled } from './contentAdmin'

describe('content admin flag', () => {
  it('is enabled only by the explicit true string', () => {
    expect(isContentAdminEnabled('true')).toBe(true)
    expect(isContentAdminEnabled('false')).toBe(false)
    expect(isContentAdminEnabled(undefined)).toBe(false)
  })
})
