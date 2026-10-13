import { describe, expect, it } from 'vitest'
import { describeRoomSessionError } from './roomSessionErrors'

describe('safe, actionable LAN admission messages', () => {
  it.each([
    ['invite_expired', /convite venceu/i],
    ['invite_used', /convite já foi usado/i],
    ['too_many_attempts', /tentativas/i],
    ['room_full', /sala está cheia/i],
    ['incompatible_invite', /incompatível/i],
    ['invalid_invite', /convite não é válido/i],
    ['host_identity_mismatch', /não confere/i],
    ['secure_lan_connect_failed', /mesma rede Wi-Fi/i],
    ['secure_lan_connection_closed', /conexão caiu/i],
    ['room_closed', /encerrada/i],
    ['invalid_resume', /retomar a sala/i],
  ])('explains %s without requiring a second device', (code, explanation) => {
    expect(describeRoomSessionError(new Error(code))).toMatch(explanation)
  })

  it('never includes secrets or unknown raw exception text in user-visible output', () => {
    const sensitive = 'SESSION_TOKEN_PRIVATE_abcdef'
    expect(describeRoomSessionError(new Error('secure_lan_connect_failed: ' + sensitive))).not.toContain(sensitive)
    expect(describeRoomSessionError(new Error('unexpected ' + sensitive))).not.toContain(sensitive)
  })
})
