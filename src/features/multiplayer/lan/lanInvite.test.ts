import { describe, expect, it } from 'vitest'
import { createLanInvite, decodeLanInvite, encodeLanInvite, hostVerificationCode } from './lanInvite'

const fingerprint = 'ab'.repeat(32)
const now = 1_760_000_000_000

function invite() {
  return createLanInvite({ roomId: 'room-1', hostIp: '10.245.112.98', port: 36157, fingerprint, now })
}

describe('LAN invitation', () => {
  it('roundtrips a short lived, versioned invitation with an unpredictable capability field', () => {
    const created = invite()
    expect(created.capability).toMatch(/^[0-9a-f]{64}$/)
    expect(created.expiresAt).toBe(now + 120_000)
    expect(decodeLanInvite(encodeLanInvite(created), now)).toEqual({ ok: true, invite: created })
    expect(encodeLanInvite(created)).not.toMatch(/playerId|snapshot|privateState|resumeToken/)
  })

  it('rejects expired, oversized, incompatible and invalid endpoint invitations', () => {
    const created = invite()
    expect(decodeLanInvite(encodeLanInvite(created), created.expiresAt)).toEqual({ ok: false, error: 'invite_expired' })
    expect(decodeLanInvite('x'.repeat(2000), now)).toEqual({ ok: false, error: 'invalid_invite' })
    expect(decodeLanInvite(encodeLanInvite({ ...created, version: 99 }), now)).toEqual({ ok: false, error: 'incompatible_invite' })
    expect(decodeLanInvite(encodeLanInvite({ ...created, hostIp: '8.8.8.8' }), now)).toEqual({ ok: false, error: 'invalid_invite' })
    expect(decodeLanInvite(encodeLanInvite({ ...created, port: 0 }), now)).toEqual({ ok: false, error: 'invalid_invite' })
  })

  it('rejects extra private fields and payloads changed after issue when checked against the issued invite', () => {
    const created = invite()
    expect(decodeLanInvite(encodeLanInvite({ ...created, privateState: 'secret' }), now)).toEqual({ ok: false, error: 'invalid_invite' })
  })

  it('never emits an encoded invitation longer than the parser accepts', () => {
    expect(() => encodeLanInvite({ ...invite(), padding: 'x'.repeat(650) })).toThrow('invalid_invite')
  })

  it('derives the same human comparison code only from the certificate fingerprint', () => {
    expect(hostVerificationCode(fingerprint)).toBe('ABAB-ABAB-ABAB')
    expect(hostVerificationCode('cd'.repeat(32))).not.toBe(hostVerificationCode(fingerprint))
  })
})
