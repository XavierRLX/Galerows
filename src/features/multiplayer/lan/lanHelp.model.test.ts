import { describe, expect, it } from 'vitest'
import { getLanConnectionHelpKey } from './lanHelp.model'

describe('LAN help from existing connection state', () => {
  it('distinguishes wait, recoverable errors and disconnected rooms without initiating a connection', () => {
    expect(getLanConnectionHelpKey({ busy: true, connected: false, error: '' })).toBe('help.connecting')
    expect(getLanConnectionHelpKey({ busy: false, connected: false, error: 'failed' })).toBe('help.connectionError')
    expect(getLanConnectionHelpKey({ busy: false, connected: false, error: '', inRoom: true })).toBe('help.reconnect')
    expect(getLanConnectionHelpKey({ busy: false, connected: true, error: '' })).toBeNull()
  })
})
