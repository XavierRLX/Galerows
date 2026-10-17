import { describe, expect, it } from 'vitest'
import { createFeedbackMailto } from './feedback'

describe('feedback email', () => {
  it('prepares a useful, privacy-preserving diagnostic summary', () => {
    const url = createFeedbackMailto({ version: '1.0.6', build: '11', platform: 'android' }, 'pt-BR')
    expect(url.startsWith('mailto:galerowsjdg@gmail.com?')).toBe(true)
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('subject')).toContain('Galerows')
    expect(params.get('body')).toContain('1.0.6')
    expect(params.get('body')).toContain('11')
    expect(params.get('body')).toContain('Android')
    expect(params.get('body')).not.toMatch(/token|senha|playerId|palavra secreta|roomId/i)
  })

  it('remains valid when build metadata is unavailable', () => {
    const url = createFeedbackMailto({ version: '1.0.6', build: null, platform: 'web' }, 'en-US')
    expect(decodeURIComponent(url)).toContain('Web')
    expect(decodeURIComponent(url)).not.toContain('null')
  })
})
