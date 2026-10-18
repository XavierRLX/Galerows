export type LanConnectionHelpState = {
  busy: boolean
  connected: boolean
  error: string
  inRoom?: boolean
}

/** Derives presentation only from current state. Never scans, connects or retries. */
export function getLanConnectionHelpKey(state: LanConnectionHelpState): string | null {
  if (state.busy) return 'help.connecting'
  if (state.error) return 'help.connectionError'
  if (state.inRoom && !state.connected) return 'help.reconnect'
  return null
}
