import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import pt from '../../i18n/locales/pt-BR/common.json'
import en from '../../i18n/locales/en-US/common.json'
import es from '../../i18n/locales/es-419/common.json'
import { PRIVACY_NOTICE_VERSION } from './privacy.config'

const policy = readFileSync('public/privacy.html', 'utf8')

describe('LAN-aware privacy disclosures', () => {
  it('explains peer-to-peer sharing, camera permissions and local deletion in public policy', () => {
    expect(policy).toMatch(/rede local|rede Wi-Fi/i)
    expect(policy).toMatch(/QR Codes? de (convites|salas)/i)
    expect(policy).toMatch(/transmitid[oa]s? diretamente/i)
    expect(policy).toMatch(/outros aparelhos/i)
    expect(policy).toMatch(/exclusão|apag[aá]/i)
    expect(policy).not.toContain('Os dados de jogo ficam no dispositivo e não são enviados a servidores')
  })

  it('informs users in all three supported languages and versions the new notice', () => {
    expect(PRIVACY_NOTICE_VERSION).toBe('2026-10-17')
    for (const strings of [pt, en, es]) {
      expect(strings.privacyNotice.description).toMatch(/(LAN|rede local|local network|red local)/i)
      expect(strings.privacy.summary).toMatch(/(aparelhos|devices|dispositivos)/i)
      expect(strings.privacy.storedDescription).toMatch(/QR/i)
    }
  })
})
