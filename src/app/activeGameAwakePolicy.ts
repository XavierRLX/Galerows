/** Only active gameplay surfaces, never home, setup, results or a waiting lobby. */
export function shouldKeepScreenAwake(pathname: string, lanPhase: string | null): boolean {
  if (/^\/games\/[^/]+\/play$/.test(pathname)) return true
  return pathname.startsWith('/__lan-lobby-v2') && lanPhase === 'playing'
}
