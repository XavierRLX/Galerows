import { describe, expect, it } from 'vitest'
import capacitorConfig from '../../../../capacitor.config'

describe('LAN credential logging policy', () => {
  it('disables Capacitor bridge logging even in debuggable builds', () => {
    // Capacitor logs full native methodData (including WSS token payloads) when enabled.
    expect(capacitorConfig.android?.loggingBehavior).toBe('none')
  })
})
