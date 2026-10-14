import { expect, it } from 'vitest'
import { describeRoomSessionError } from './roomSessionErrors'

it.each(['invalid_invite', 'host_identity_mismatch'])('guides %s failures back to the physical QR instead of a manual invitation or verification code', code => {
  const message = describeRoomSessionError(new Error(code))
  expect(message).toMatch(/QR/)
  expect(message).toMatch(/renov/i)
  expect(message).not.toMatch(/texto|código|digite|digitar|cole|colar/i)
})
