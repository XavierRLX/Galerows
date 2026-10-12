import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import jsQR from 'jsqr'
import { createLobbyInviteQr } from './lobbyInviteQr'

describe('PL-03 scannable invitation QR', () => {
  it('recovers the complete long v2 invitation from the generated PNG', async () => {
    const invite = 'galerows-lan-v2:' + 'x'.repeat(426)
    const pngUrl = await createLobbyInviteQr(invite)
    expect(pngUrl).toMatch(/^data:image\/png;base64,/)
    const { data, info } = await sharp(Buffer.from(pngUrl.slice(pngUrl.indexOf(',') + 1), 'base64'))
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    expect(info.width).toBeGreaterThanOrEqual(384)
    expect(jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data).toBe(invite)
  })
})
