import { describe, expect, it } from 'vitest'
import { createLanInvite, encodeLanInvite, decodeLanInvite } from './lanInvite'
import { createPersistentLanInvite, encodePersistentLanInvite, decodePersistentLanInvite,
  samePersistentLanInvite } from './lanPersistentInvite'

const now = 1_760_000_000_000
const fingerprint = 'ab'.repeat(32)
const options = { roomId: 'room-2', hostIp: '10.245.112.98', port: 43111, fingerprint, now }

describe('PL-02B secure v2 invitation', () => {
  it('uses an isolated prefix and strict versioned 120s payload, without leaking credentials', () => {
    const invite = createPersistentLanInvite(options)
    const encoded = encodePersistentLanInvite(invite)
    expect(invite.version).toBe(2)
    expect(invite.expiresAt).toBe(now + 120_000)
    expect(invite.capability).toMatch(/^[0-9a-f]{64}$/)
    expect(encoded).toMatch(/^galerows-lan-v2:/)
    expect(encoded).not.toMatch(/resumeToken|playerId|privateState/)
    expect(decodePersistentLanInvite(encoded, now)).toEqual({ ok: true, invite })
    expect(decodeLanInvite(encoded, now).ok).toBe(false)
    expect(decodePersistentLanInvite(encodeLanInvite(createLanInvite(options)), now).ok).toBe(false)
  })

  it('fails closed for modified fields, expired tickets, invalid IP and unknown fields', () => {
    const invite = createPersistentLanInvite(options)
    expect(decodePersistentLanInvite(encodePersistentLanInvite(invite), invite.expiresAt))
      .toEqual({ ok: false, error: 'invite_expired' })
    expect(decodePersistentLanInvite(encodePersistentLanInvite({ ...invite, version: 1 }), now))
      .toEqual({ ok: false, error: 'incompatible_invite' })
    expect(decodePersistentLanInvite(encodePersistentLanInvite({ ...invite, hostIp: '8.8.8.8' }), now))
      .toEqual({ ok: false, error: 'invalid_invite' })
    expect(decodePersistentLanInvite(encodePersistentLanInvite({ ...invite, privateState: 'secret' }), now))
      .toEqual({ ok: false, error: 'invalid_invite' })
    expect(decodePersistentLanInvite('galerows-lan-v2:!!!', now))
      .toEqual({ ok: false, error: 'invalid_invite' })
    expect(samePersistentLanInvite(invite, { ...invite, capability: 'cd'.repeat(32) })).toBe(false)
  })
})
